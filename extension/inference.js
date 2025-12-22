let session = null;
let tokenizer = null;

console.log("inference.js loaded");

async function initModel() {
    console.log("initModel called");

    // ✅ Dynamically import transformers
    const transformers = await import(
        browser.runtime.getURL("libs/transformers.min.js")
    );

    // Load tokenizer
    tokenizer = await transformers.AutoTokenizer.from_pretrained(
        browser.runtime.getURL("tokenizer")
    );

    // Load ONNX model
    session = await ort.InferenceSession.create(
        browser.runtime.getURL("model/dualHead_student_tinyBERT_optimized.onnx"),
        { executionProviders: ["wasm"] }
    );

    console.log("PII model loaded");
}

/**
 * Convert JS array to BigInt64Array if needed for int64 inputs
 */
function toBigInt64Array(arr) {
    return BigInt64Array.from(arr.map(x => BigInt(x)));
}

async function runInference(text) {
    if (!session || !tokenizer) {
        console.error("Model not initialized. Please call await initModel() first!");
        return null;
    }

    // Tokenize input
    const encoded = await tokenizer(text, {
        truncation: true,
        padding: true,
        return_tensors: "np" // produces { input_ids: ..., attention_mask: ... }
    });

    // Convert to BigInt64Array for ONNX int64 inputs
    const feeds = {
        input_ids: new ort.Tensor(
            "int64",
            toBigInt64Array(encoded.input_ids.data),
            encoded.input_ids.shape
        ),
        attention_mask: new ort.Tensor(
            "int64",
            toBigInt64Array(encoded.attention_mask.data),
            encoded.attention_mask.shape
        )
    };

    const results = await session.run(feeds);
    console.log("ONNX output:", results);
    return results;
}

// Expose functions globally
window.initModel = initModel;
window.runInference = runInference;
