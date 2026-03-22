// PII DETECTION BACKGROUND SERVICE
// 1. Initialize the ONNX Runtime (ORT) and AI Model.
// 2. Configure the Tokenizer for local processing.
// 3. Listen for text analysis requests from content scripts.

// 1. IMPORTS
import { runInference } from './inference.js';
import { env, AutoTokenizer } from './lib/transformers.min.js';

// 2. GLOBAL STATE
let session = null;
let tokenizer = null;

// 3. ENGINE CONFIGURATION (ORT)
// Sets up the ONNX Runtime (ORT) environment (Maps the necessary WASM files to their local extension paths)
function initOrt() {
    console.log("Initializing ORT...");
    const ort = globalThis.ort;

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

// 4. INITIALIZATION
async function init() {
    try {
        initOrt();
        await initSession();
        await initTokenizer();
        console.log("PII Extension is ready!");
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
        if (!session || !tokenizer) {
            return { error: "AI Engine is still warming up. Please wait." }; 
        }

        console.log("Processing PII check for selected text...");

        try {
            // runInference is imported from inference.js
            const results = await runInference(session, tokenizer, msg.text);
            return { status: "success", piiTokens: results };
        } catch (err) {
            console.error("Inference Error:", err);
            return { status: "error", error: err.message };
        }
    }
});