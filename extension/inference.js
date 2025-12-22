let session;
let tokenizer;

console.log("inference.js loaded");
async function initModel() {
    console.log("initModel called");
    // Use browser.runtime.getURL to get paths
    tokenizer = await Tokenizer.fromFile(
        browser.runtime.getURL("tokenizer/tokenizer.json")
    );

    session = await ort.InferenceSession.create(
        browser.runtime.getURL("model/dualHead_student_tinyBERT_optimized.onnx"),
        { executionProviders: ["wasm"] }
    );

    console.log("PII model loaded");
}

// Expose initModel globally
window.initModel = initModel;