document.addEventListener("mouseup", () => {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;

    console.log("Selected:", selection);

    browser.runtime.sendMessage({
        type: "PII_CHECK",
        text: selection
    });
});

browser.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "PII_RESULT") return;

    console.log("PII result received:", msg.output);
});