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

document.addEventListener("pointerup", (event) => {
    // Only fire on left click
    if (event.button !== 0) return;

    // Small delay to ensure the selection is fully captured
    setTimeout(() => {
        const text = getSelectedText();
        if (text) {
            sendSelectedText(text);
        }
    }, 50); 
});