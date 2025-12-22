console.log("Background script started");

initModel();

browser.runtime.onMessage.addListener((msg) => {
    console.log("Page text received:", msg.text.slice(0, 200));
});