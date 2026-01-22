let worker;
let readyResolve;
let readyPromise;

const ext = typeof browser !== "undefined" ? browser : chrome;

function waitReady() {
  return new Promise(r => (readyResolve = r));
}

function createWorker() {
  console.log("[bg] creating worker");

  worker = new Worker(ext.runtime.getURL("inference.worker.js"));

  readyPromise = waitReady();

  worker.onmessage = (e) => {
    console.log("[bg] message", e.data);

    if (e.data.type === "ready") {
      readyResolve();
    }

    if (e.data.type === "error") {
      console.error("[worker error]", e.data.message);
    }
  };
}

async function init(modelBuffer) {
  createWorker();

  console.log("[bg] waiting for boot");
  await readyPromise;

  console.log("[bg] sending model");
  readyPromise = waitReady();

  worker.postMessage(
    { type: "init", model: modelBuffer },
    [modelBuffer]
  );

  await readyPromise;
  console.log("[bg] worker fully ready");
}

fetch(ext.runtime.getURL("model/dualhead.onnx"))
  .then(r => r.arrayBuffer())
  .then(init)
  .catch(err => console.error("Model load failed", err));

// console.log("Background loaded");

// // The Worker is created here in the extension's privileged context
// console.log("Worker initializing..");
// const worker = new Worker(browser.runtime.getURL("inference.worker.js"));
// console.log("Worker initialized.");

// console.log("ONNX initializing..");
// // background.js
// async function initONNX() {
//   const onnxUrl = browser.runtime.getURL("model/dualhead.onnx");
//   const wasmUrl = browser.runtime.getURL("lib/ort-wasm.wasm");

//   // Fetch the WASM and create a Blob URL to bypass NetworkErrors
//   const wasmResponse = await fetch(wasmUrl);
//   const wasmBlob = await wasmResponse.blob();
//   // const wasmBlobUrl = URL.createObjectURL(wasmBlob);
//   const wasmBlobUrl = URL.createObjectURL(new Blob([wasmBlob], { type: 'application/wasm' }));

//   // Fetch the model
//   const modelResponse = await fetch(onnxUrl);
//   const modelBuffer = await modelResponse.arrayBuffer();

//   worker.postMessage({
//     type: "INIT",
//     ortUrl: browser.runtime.getURL("lib/ort.min.js"),
//     wasmBlobUrl: wasmBlobUrl, // Pass the Blob URL instead of a path
//     modelBuffer: modelBuffer
//   }, [modelBuffer]);
// }

// initONNX();

// browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.type === "RUN_INFERENCE") {
    
//     // Create a temporary listener for this specific request
//     const onWorkerMessage = (e) => {
//       if (e.data.type === "RESULT") {
//         worker.removeEventListener("message", onWorkerMessage);
//         sendResponse({ status: "success", outputs: e.data.outputs });
//       }
//     };
    
//     worker.addEventListener("message", onWorkerMessage);
    
//     // Forward the content script's payload to the worker
//     worker.postMessage({
//       type: "RUN_ONNX",
//       ...request.payload
//     });

//     return true; // Required for asynchronous sendResponse
//   }
// });

// // // Chrome: background.js
// // async function ensureOffscreen() {
// //   const exists = await chrome.offscreen.hasDocument();
// //   if (!exists) {
// //     await chrome.offscreen.createDocument({
// //       url: "offscreen.html",
// //       reasons: ["WORKERS"],
// //       justification: "Run ONNX Runtime in Web Worker"
// //     });
// //   }
// // }

// // chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
// //   (async () => {
// //     await ensureOffscreen();
// //     chrome.runtime.sendMessage(msg, sendResponse);
// //   })();
// //   return true;
// // });
