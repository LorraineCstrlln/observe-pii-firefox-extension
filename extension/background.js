// PII DETECTION BACKGROUND SERVICE
// 1. Initialize the ONNX Runtime (ORT) and AI Model.
// 2. Configure the Tokenizer for local processing.
// 3. Listen for text analysis requests from content scripts.

// 1. IMPORTS
// import { runInference } from './inference.js';
// import { env, AutoTokenizer } from './lib/transformers.min.js';
// import * as ort from './lib/ort.min.js';

// 2. GLOBAL STATE
let session = null;
let tokenizer = null;
let transformers = null;
let runInferenceFn = null;

// Performance Metrics Arrays for Thesis logs
const inferenceLatencies = []
let initializeLatency = 0;

async function loadTransformers() {
    if (!transformers) {
        transformers = await import(browser.runtime.getURL('lib/transformers.min.js'));
    }
    return transformers;
}

async function loadInference() {
    if (!runInferenceFn) {
        const mod = await import(browser.runtime.getURL('inference.js'));
        runInferenceFn = mod.runInference;
    }
}

// 3. ENGINE CONFIGURATION (ORT)
// Sets up the ONNX Runtime (ORT) environment (Maps the necessary WASM files to their local extension paths)
function initOrt() {
    console.log("Initializing ORT...");
    // const ort = globalThis.ort;

    // Explicitly point to local WASM files for performance and security
    ort.env.wasm.wasmPaths = {
        "ort-wasm-simd-threaded.jsep.wasm": browser.runtime.getURL(
            "lib/ort-wasm-simd-threaded.jsep.wasm"
        ),
        "ort-wasm-simd-threaded.jsep.mjs": browser.runtime.getURL(
            "lib/ort-wasm-simd-threaded.jsep.mjs"
        )
    };

    ort.env.wasm.numThreads = 1;    // Keeping threads low to prevent browser lag
    ort.env.wasm.simd = true;       // Enables hardware acceleration if available
    console.log("ORT Initialized!");
}

// Loads the trained AI Model (.onnx) into memory
async function initSession() {
    console.log("Initializing ONNX Model Session...")
    const modelURL = browser.runtime.getURL("model/dualhead.onnx");

    // Fetch the model as bytes
    const res = await fetch(modelURL);
    const buffer = await res.arrayBuffer();

    // Create the session using the WASM execution provider
    const ortSession = await ort.InferenceSession.create(buffer, {
        executionProviders: ["wasm"]
    });

    console.log("Session created!");
    session = ortSession;
}

// Prepares the Tokenizer (converts human words into numbers the AI can understand)
async function initTokenizer() {
    transformers = await loadTransformers();

    const { env, AutoTokenizer } = transformers;

    env.localModelPath = browser.runtime.getURL("").replace(/\/$/, "");
    env.useBrowserCache = false;    // disable default caching
    env.allowRemoteModels = false;  // disable remote models
    env.allowLocalModels = true;    // enable local models

    if (!tokenizer) {
        // 'model' is passed since localModelPath is already set to base URL
        tokenizer = await AutoTokenizer.from_pretrained('model', {
            local_files_only: true,
            use_fast: true
        });
    }

    console.log("Tokenizer Initialized!");
}

// Track if background.js is terminated or restarted automatiically
let initialized = false;

// 4. INITIALIZATION
async function init() {
    if (initialized) return;    // prevents multiple initis
    initialized = true;         // mark as done
    
    const startInitTime = performance.now()
    try {
        initOrt();
        await initSession();
        await loadInference();
        await initTokenizer();
        console.log("PII Extension is ready!");

        // initializationLatency = performance.now() - startInitTime;
        // console.log(`\n=================================================`);
        // console.log(`4.2.2 Initialization Latency: ${initializationLatency.toFixed(2)} ms`);
        // console.log(`=================================================\n`);

        // setTimeout(runThesisBenchmark, 2000);

    } catch (error) {
        console.error("Initialization Failed:", error);
    }
}

// start the engine
init();

// 5. COMMUNICATION (listens to content.js)
browser.runtime.onMessage.addListener(async (msg, _) => {
    if (msg.type === "runInference") {
        // Guard: Prevent errors if the model hasn't finished loading
        if (!session || !tokenizer || !runInferenceFn) {
            await init();
        }

        console.log("Processing PII check for selected text...");

        try {
            // Thesis Logs: const startInferenceTime = performance.now();
            const results = await runInferenceFn(session, tokenizer, msg.text);

            // // Inference Time
            // const totalInferenceTime = performance.now() - startInferenceTime;
            // inferenceLatencies.push(totalInferenceTime);
            
            // const totalSum = inferenceLatencies.reduce((a,b) => a + b, 0)
            // const meanLatency = totalSum / inferenceLatencies.length;

            // const sortedLatencies = [...inferenceLatencies].sort((a, b) => a - b);
            // const p95Index = Math.floor(sortedLatencies.length * 0.95);
            // const p95Latency = sortedLatencies[p95Index];

            return { status: "success", text: results };
        } catch (err) {
            console.error("Inference Error:", err);
            return { status: "error", error: err.message };
        }
    }
});

// Thesis Benchmarking
async function runThesisBenchmark() {
    console.log("Starting Thesis Benchmark: Running 100 inferences...");
    
    const sampleTexts = [
        "My phone number is 555-0199.",
        "John Doe lives at 123 Main Street, New York.",
        "I am a Filipino student studying cybersecurity in the University of the Philippines",
        "The quick brown fox jumps over the lazy dog.",
        "Please forward the confidential PDF directly to Alice Smith at alice.smith@corp.io as soon as possible.",
        "The system kernel version is 5.15.0-generic and requires immediate patching against local exploits.",
        "Her date of birth is October 14, 1995, according to the archived medical registration system files.",
        "The total quarterly revenue increased by twelve percent despite supply chain delays across the region.",
        "You can contact our primary technical support desk directly via email at helpdesk@security-net.com.",
        "An unexpected database authentication failure occurred at 14:32 UTC on the production server cluster.",
        "The patient, Robert Jenkins, was admitted to the clinic after experiencing acute respiratory distress.",
        "We need to schedule a localized vulnerability assessment for the web application firewall configuration.",
        "Her social security card identifier was compromised during the third-party data breach last November.",
        "The quick migration of legacy infrastructure to native cloud environments requires robust container isolation.",
        "Please call my mobile number +1-202-555-0143 if the server goes completely offline tonight.",
        "A regular expression can be used to efficiently parse unstructured logs for sensitive string patterns.",
        "The transaction was completed using credit card number 4111-2222-3333-4444 before the gateway timeout.",
        "Our cybersecurity team recommends implementing strict multi-factor authentication across all active accounts.",
        "He graduated from the Massachusetts Institute of Technology with a master degree in data science.",
        "The project repository is currently hosted on a private enterprise server with restricted access controls.",
        "Mary Turner is the lead software engineer responsible for managing the automated deployment pipeline.",
        "This sample text block contains absolutely no personally identifiable data elements or risk indicators.",
        "Send the password reset token directly to support-admin@internal.net to restore developer console access.",
        "The local execution of machine learning models inside web extensions mitigates user data exfiltration.",
        "David Miller was born on July 23, 1988, and currently works as a cloud solutions architect.",
        "The encryption keys must be rotated every ninety days to maintain baseline compliance standards.",
        "The primary office address is listed as 789 Corporate Boulevard, Suite 400, San Francisco, California.",
        "A deep neural network requires significant memory allocation during the initial session compilation phase.",
        "Please check if the account number 9876543210 has enough active balance for the bank transfer.",
        "The browser extension intercepts text selection events using standard runtime background context scripts.",
        "Professor William Johnson published a comprehensive research paper detailing local privacy frameworks.",
        "We noticed unusual network traffic originating from an unrecognized IP address in eastern Europe.",
        "Her current driver license number is DL-987654321 and it expires early next calendar year.",
        "WebAssembly allows high-performance native compiled binaries to run securely inside client-side browsers.",
        "LMAOOOO... James Wilson can be reached at his personal contact address james.wilson99@gmail.com for inquiries.",
        "The application layer utilizes a tokenized dictionary to map alphanumeric strings into integers.",
        "The patient records indicate that Sarah Davis has no known drug allergies or medical conditions.",
        "An open source distribution model allows global developers to inspect codebases for tracking scripts.",
        "ehehehe keep it a secret but the passport number listed on the official immigration form is temporary passport ID XF1234567.",
        "A local Transformer model eliminates the high operational costs associated with hosting dedicated cloud APIs.",
        "Please review the employment contract for Emily Taylor before sending it out for signature.",
        "The background processing loop evaluates latency variations using the high-resolution performance API.",
        "His current home location is registered at 456 Oak Avenue, Apartment 2B, Chicago, Illinois.",
        "The standard macro F1 score provides a balanced metric for evaluating models on imbalanced datasets.",
        "Contact the emergency security response coordination group via phone number 800-555-0175 immediately.",
        "Local ONNX execution prevents cleartext text strings from being sent over insecure external networks.",
        "Michael Brown was appointed as the chief information security officer during the board meeting.",
        "The dual-head transformer architecture handles sentence filtering and token tracking simultaneously.",
        "The private financial document belongs to Linda Martinez, who oversees the corporate audit trail.",
        "The model weights were successfully compressed using aggressive post-training knowledge distillation methods.",
        "Her corporate email address is linda.martinez@globalfinance.org and should be kept confidential.",
        "A baseline consumer device might experience high latency spikes if the memory heap is throttled.",
        "The target individual lives somewhere near 123 Pine Road, Toronto, Ontario, according to logs.",
        "The 95th percentile latency is an excellent metric for capturing worst-case user interface lag.",
        "Please verify the credentials of Joseph Anderson before granting access to the staging server.",
        "The tokenizer splits complex words into sub-word units using an optimized vocabulary list file.",
        "His temporary identification number is ID-776251 and must be entered during system check-in.",
        "The Firefox extension background environment isolates distinct content scripts using message passing.",
        "Elizabeth Thomas is currently organizing the upcoming international cryptography conference in Manila.",
        "The model session allocation takes under one second during the initial asynchronous loading sequence.",
        "Send the updated invoice sheet directly to billing-dept@services.com to process the payment.",
        "A WebAssembly memory heap allocation error can cause browser extensions to crash unexpectedly.",
        "The legal files mention that Charles Jackson was present during the contract signing ceremony.",
        "The difference between mean latency and P95 latency indicates the overall system performance stability.",
        "Her phone number changed recently to +63-917-555-4321 for her local roaming communication setup.",
        "Did you guys hear? The teacher model transfers its soft probabilities to the student network during the training loop.",
        "Christopher White is the system engineer who configured the local inference execution environment.",
        "The input text selection is processed immediately after the user triggers the context popup icon.",
        "The secure document was signed by Barbara Harris at the headquarters office yesterday morning.",
        "A class-imbalanced dataset requires specific metric evaluation techniques like macro precision and recall.",
        "Please verify if this email address barbara.harris@company.com is registered on our network.",
        "The execution block processes data sequentially to avoid blocking the single-threaded context script.",
        "The home address on file for Matthew Martin is 555 Cedar Lane, Austin, Texas, USA.",
        "The ONNX format optimizes execution graphs by fusing multiple mathematical operators into single layers.",
        "You can confirm the appointment by calling the office administrator at 555-0122 this afternoon.",
        "The web extension pipeline converts selected DOM strings into flat arrays for inference processing.",
        "The audit report was compiled by Jessica Thompson from the internal risk assessment division.",
        "A sub-200 millisecond response time ensures that text checking feels instantaneous to end users.",
        "Her student identity card number is STU-2026-9981 and must be validated at the gate.",
        "The local model layout completely eliminates the privacy concerns tied to corporate data tracking.",
        "Daniel Garcia can be contacted for system maintenance inquiries at d.garcia@techops.net.",
        "The processing overhead remains low because the student model contains significantly fewer parameters.",
        "its amazing that the package delivery address is specified as 999 Maple Court, Seattle, Washington, 98101.",
        "A high variance between test runs suggests that background operating system noise is active.",
        "Please update the records for Nancy Martinez to reflect her new department assignment online.",
        "The Firefox browser scripting environment supports asynchronous execution using standard promise chains.",
        "His official taxpayer identification number was recorded as TIN-443-221-889 in the system.",
        "The distillation constraints preserve global privacy awareness while cutting down overall inference time.",
        "Paul Robinson is the database administrator who discovered the open port on the server.",
        "The model outputs a multi-dimensional array representing token-level entity classification probabilities.",
        "Her work contact email is listed on the public directory as p.robinson@agency.gov.",
        "i didnt know that the high-resolution time API provides sub-millisecond timestamps for accurate performance profiling.",
        "The residential property belongs to Mark Rodriguez and is located at 777 Walnut Way.",
        "The dual-head classification framework successfully decouples sentence filtering from token extraction.",
        "Please send the confirmation letter to m.rodriguez@domain.com to finalize the entry process.",
        "well the consumer-grade device simulation was achieved by throttling hardware acceleration in the browser.",
        "The official corporate registry lists Donald Lewis as the majority stakeholder of the venture.",
        "The model optimization process bridges the gap between massive server layouts and web deployment.",
        "bruhhh His current contact phone number is 555-0164 and is available during standard business hours.",
        "This final test sample marks the end of the 100 element benchmarking dataset array hehhehe"
    ];

    // Loop 100 times
    for (let i = 0; i < sampleTexts.length; i++) {
        const textToTest = sampleTexts[i]; 
        
        try {
            const startTime = performance.now();
            await runInferenceFn(session, tokenizer, textToTest);
            const duration = performance.now() - startTime;
            
            inferenceLatencies.push(duration); 
        } catch (e) {
            console.error(`Error at run ${i}:`, e);
        }
    }

    // 3. Calculate and print results
    const totalSum = inferenceLatencies.reduce((a,b) => a + b, 0);
    const meanLatency = totalSum / inferenceLatencies.length;
    const sorted = [...inferenceLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted[p95Index];

    console.log(`\n============= BENCHMARK RESULTS (n=${sampleTexts.length}) =============`);
    console.log(`Total Samples Tested: ${inferenceLatencies.length}`);
    console.log(`Mean (Average) Latency: ${meanLatency.toFixed(2)} ms`);
    console.log(`P95 (Worst-Case) Latency: ${p95Latency.toFixed(2)} ms`);
    console.log(`=====================================================\n`);
}