importScripts("lib/ort.min.js");
let session = null;

try {
  console.log("[worker] booting");

  ort.env.wasm.wasmPaths = {
    "ort-wasm.wasm": "lib/ort-wasm.wasm"
  };

  ort.env.wasm.numThreads = 1;

  console.log("[worker] wasm path set");

  self.postMessage({ type: "ready", stage: "boot" });
} catch (err) {
  self.postMessage({
    type: "error",
    message: err.message
  });
}

self.onmessage = async (e) => {
  try {
    if (e.data.type === "init") {
      console.log("[worker] loading model");

      session = await ort.InferenceSession.create(
        e.data.model,
        { executionProviders: ["wasm"] }
      );

      console.log("[worker] model loaded");
      self.postMessage({ type: "ready", stage: "model" });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err.message
    });
  }
};



// // onnxWorker.js
// let session;

// self.onmessage = async (e) => {
//   const msg = e.data;
//   if (msg.type === "INIT") {
//     try {
//       console.log("Worker: Importing ORT...");
//       importScripts(msg.ortUrl);

//       ort.env.wasm.wasmPaths = {
//         "ort-wasm.wasm": msg.wasmBlobUrl
//       };

//       ort.env.wasm.numThreads = 1;
//       ort.env.wasm.proxy = false;
//       ort.env.wasm.simd = false;

//       console.log("Worker: Aligning Buffer...");
//       // const modelUint8 = new Uint8Array(msg.modelBuffer);
//       const alignedBuffer = msg.modelBuffer.slice(0);

//       console.log("Worker: Creating session...");
//       session = await ort.InferenceSession.create(alignedBuffer, {
//         executionProviders: ["wasm"]
//       });

//       console.log("Worker Ready - Session Created");
//       console.log("ONNX initialized.");

//     } catch (err) {
//       console.error("Worker Init Failed!", err);
//     }
//   }


//   if (msg.type === "RUN_ONNX") {
//     if (!session) {
//       console.error("Worker: Inference requested but session not ready.");
//       return;
//     }
    
//     try {
//       const toInt32 = (arr) => Int32Array.from(arr); // <-- no BigInt

//       const feeds = {
//         input_ids_head1: new ort.Tensor("int32", toInt32(msg.inputIdsHead1), [1, msg.inputIdsHead1.length]),
//         attention_mask_head1: new ort.Tensor("int32", toInt32(msg.attnMask1), [1, msg.attnMask1.length]),
//         input_ids_head2: new ort.Tensor("int32", toInt32(msg.inputIdsHead2), [1, msg.inputIdsHead2.length]),
//         attention_mask_head2: new ort.Tensor("int32", toInt32(msg.attnMask2), [1, msg.attnMask2.length])
//       };


//       const outputs = await session.run(feeds);
//       self.postMessage({ type: "RESULT", outputs });
//     } catch (err) {
//       console.error("Inference Run Error:", err);
//     }
//   }
// };

// // Chrome
// // let session = null;
// // let ready = false

// // self.onmessage = async (e) => {
// //   const msg = e.data;

// //   if (msg.type === "INIT") {
// //     try {
// //       importScripts(chrome.runtime.getURL("lib/ort.min.js"));

// //       ort.env.wasm.wasmPaths = {
// //         "ort-wasm.wasm": chrome.runtime.getURL("lib/ort-wasm.wasm")
// //       };

// //       ort.env.wasm.numThreads = 1;
// //       ort.env.wasm.simd = true;

// //       session = await ort.InferenceSession.create(msg.modelUrl, {
// //         executionProviders: ["wasm"],
// //         graphOptimizationLevel: "all"
// //       });

// //       ready = true;
// //       self.postMessage({ type: "READY" });
// //     } catch (err) {
// //       self.postMessage({ type: "ERROR", error: err.message });
// //     }
// //   }

// //   if (msg.type === "RUN_ONNX") {
// //     if (!ready || !session) {
// //       self.postMessage({
// //         type: "ERROR",
// //         error: "Model not ready"
// //       });
// //       return;
// //     }

// //     const feeds = {
// //       input_ids_head1: new ort.Tensor(
// //         "int32",
// //         Int32Array.from(msg.inputIdsHead1),
// //         [1, msg.inputIdsHead1.length]
// //       ),
// //       attention_mask_head1: new ort.Tensor(
// //         "int32",
// //         Int32Array.from(msg.attnMask1),
// //         [1, msg.attnMask1.length]
// //       ),
// //       input_ids_head2: new ort.Tensor(
// //         "int32",
// //         Int32Array.from(msg.inputIdsHead2),
// //         [1, msg.inputIdsHead2.length]
// //       ),
// //       attention_mask_head2: new ort.Tensor(
// //         "int32",
// //         Int32Array.from(msg.attnMask2),
// //         [1, msg.attnMask2.length]
// //       )
// //     };

// //     const outputs = await session.run(feeds);
// //     self.postMessage({ type: "RESULT", outputs });
// //   }
// // };
