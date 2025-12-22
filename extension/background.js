console.log("Background script started");

initModel();

browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.type !== "PII_CHECK") return;

    console.log("Running PII detection on:", msg.text);

    const result = await runInference(msg.text);

    // Send result back to content script
    browser.tabs.sendMessage(sender.tab.id, {
        type: "PII_RESULT",
        result
    });
});