import { runInference } from './inference.js';
import { env, AutoTokenizer } from './lib/transformers.min.js';

let session = null;
let tokenizer = null;

async function initTokenizer() {
    env.localModelPath = browser.runtime.getURL("/");
    env.useBrowserCache = false;    // disable default caching
    env.allowRemoteModels = false;  // disable remote models
    env.allowLocalModels = true;    // enable local models

    if (!tokenizer) {
        // 'model' is passed since localModelPath is already set to base URL
        tokenizer = await AutoTokenizer.from_pretrained('model', {});
    }
    console.log("Tokenizer Initialized!");
}

function initOrt() {
    console.log("Initializing ORT...");
    const ort = globalThis.ort;

    ort.env.wasm.wasmPaths = {
    "ort-wasm-simd-threaded.jsep.wasm": browser.runtime.getURL(
        "lib/ort-wasm-simd-threaded.jsep.wasm"
    ),
    "ort-wasm-simd-threaded.jsep.mjs": browser.runtime.getURL(
        "lib/ort-wasm-simd-threaded.jsep.mjs"
    )
    };

    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    console.log("ORT Initialized!");
}

async function initSession() {

    console.log("Initializing ONNX Model Session...")
    const modelURL = browser.runtime.getURL("model/dualhead.onnx");

    // Fetch the model as bytes
    const res = await fetch(modelURL);
    const buffer = await res.arrayBuffer();

    const ortSession = await ort.InferenceSession.create(buffer, {
        executionProviders: ["wasm"]
    });

    console.log("Session created!");
    session = ortSession;
}

async function init() {
    initOrt();
    await initSession();
    await initTokenizer();
    console.log("ORT, Session, and Tokenizer Initialized!");
}

init();
browser.runtime.onMessage.addListener(async (msg, _) => {
    if (msg.type === "runInference") {
        if (!session) return { error: "Session not ready" }; 

        console.log("Received inference request from content script:", msg.text);

        const results = await runInference(session, tokenizer, msg.text);
        return { status: "received", text: results };
    }
});