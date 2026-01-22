// // Firefox
// function tokenizeHead1(text) {
//   const len = Math.min(text.length, 128); 
//   return {
//     inputIdsHead1: new Int32Array(len).fill(1),
//     attnMask1: new Int32Array(len).fill(1) // Change name to match payload
//   };
// }

// function tokenizeHead2(text) {
//   const len = Math.min(text.length, 256);
//   return {
//     inputIdsHead2: new Int32Array(len).fill(1),
//     attnMask2: new Int32Array(len).fill(1) // Change name to match payload
//   };
// }

// document.addEventListener("mouseup", async () => {
//   const selection = window.getSelection();
//   const text = selection ? selection.toString().trim() : "";
  
//   if (!text) return;

//   // 1. Tokenize locally in the content script
//   const { inputIdsHead1, attnMask1 } = tokenizeHead1(text);
//   const { inputIdsHead2, attnMask2 } = tokenizeHead2(text);

//   console.log("Sending tokenized data to background...");

//   try {
//     // 2. Send the processed arrays to the background script
//     const response = await browser.runtime.sendMessage({
//       type: "RUN_INFERENCE",
//       payload: {
//         inputIdsHead1,
//         attnMask1,
//         inputIdsHead2,
//         attnMask2
//       }
//     });

//     if (response && response.status === "success") {
//       console.log("AI Results:", response.outputs);
//     }
//   } catch (err) {
//     console.error("Inference failed:", err);
//   }
// });

// // Chrome
// // content.js

// // function tokenizeHead1(text) {
// //   const len = Math.min(text.length, 128);
// //   return {
// //     inputIdsHead1: Array(len).fill(1),
// //     attnMask1: Array(len).fill(1)
// //   };
// // }

// // function tokenizeHead2(text) {
// //   const len = Math.min(text.length, 256);
// //   return {
// //     inputIdsHead2: Array(len).fill(1),
// //     attnMask2: Array(len).fill(1)
// //   };
// // }

// // let modelReady = false;

// // // Initialize ONNX once
// // function waitForChromeAPI(timeout = 5000) {
// //   return new Promise((resolve, reject) => {
// //     const start = Date.now();
// //     const check = () => {
// //       if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
// //         resolve();
// //       } else if (Date.now() - start > timeout) {
// //         reject(new Error("chrome API not available"));
// //       } else {
// //         setTimeout(check, 50);
// //       }
// //     };
// //     check();
// //   });
// // }

// // (async () => {
// //   try {
// //     await waitForChromeAPI();

// //     let modelReady = false;

// //     chrome.runtime.sendMessage({
// //       type: "INIT",
// //       modelUrl: chrome.runtime.getURL("model/dualhead.onnx")
// //     }, (response) => {
// //       if (response?.type === "READY") {
// //         modelReady = true;
// //         console.log("ONNX model ready");
// //       } else if (response?.type === "ERROR") {
// //         console.error("ONNX init error:", response.error);
// //       }
// //     });

// //   } catch (err) {
// //     console.error("chrome API never became available:", err);
// //   }
// // })();



// // document.addEventListener("mouseup", async () => {
// //   if (!modelReady) {
// //     console.log("Model still loading...");
// //     return;
// //   }

// //   const selection = window.getSelection();
// //   const text = selection ? selection.toString().trim() : "";

// //   if (!text) return;

// //   const { inputIdsHead1, attnMask1 } = tokenizeHead1(text);
// //   const { inputIdsHead2, attnMask2 } = tokenizeHead2(text);

// //   try {
// //     const response = await chrome.runtime.sendMessage({
// //       type: "RUN_ONNX",
// //       inputIdsHead1,
// //       attnMask1,
// //       inputIdsHead2,
// //       attnMask2
// //     });

// //     if (response?.type === "RESULT") {
// //       console.log("AI Results:", response.outputs);
// //     } else if (response?.type === "ERROR") {
// //       console.error("ONNX Error:", response.error);
// //     }
// //   } catch (err) {
// //     console.error("Inference failed:", err);
// //   }
// // });
