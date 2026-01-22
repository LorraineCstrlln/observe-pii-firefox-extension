// Testing
// browser.runtime.sendMessage({
//     type: "runInference",
//     text: "Hello world"
// }).then(response => {
//     console.log("Model output:", response);
// }).catch(err => {
//     console.error("Message failed:", err);
// });

// Mouse Highlight
function getSelectedText(){
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
}

function sendSelectedText(text) {
    if (!text) return; // nothing is selected

    console.log("Text Selected:", text);

    browser.runtime.sendMessage({
        type: "runInference",
        text: text
    }).then(response => {
        console.log("Model output:", response);
    }).catch(err => {
        console.error("Failed to send text:", err);
    })
}

document.addEventListener("mouseup", () => {
    const text = getSelectedText();
    sendSelectedText(text);
})