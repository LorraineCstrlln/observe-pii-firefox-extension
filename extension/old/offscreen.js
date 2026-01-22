const worker = new Worker(chrome.runtime.getURL("onnxWorker.js"));

let ready = false;
let pending = [];

worker.addEventListener("message", (e) => {
  if (e.data.type === "READY") {
    ready = true;
    pending.forEach(r => r());
    pending = [];
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_ONNX" && !ready) {
    pending.push(() => {
      worker.postMessage(msg);
      sendResponse({ type: "ERROR", error: "Model not ready yet" });
    });
    return true;
  }

  worker.postMessage(msg);

  const handler = (e) => {
    worker.removeEventListener("message", handler);
    sendResponse(e.data);
  };

  worker.addEventListener("message", handler);
  return true;
});
