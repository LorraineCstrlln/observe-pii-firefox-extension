(function injectPIICSS() {
    if (document.getElementById("pii-css")) return;

    const link = document.createElement("link");
    link.id = "pii-css";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = browser.runtime.getURL("content.css");

    document.head.appendChild(link);
})();

// MOUSE HIGHLIGHT
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

        if (!response || !response.text) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        positionPopup(selection);
        renderPopup(response.text);
        highlightTokens(selection, response.text.head2);

    }).catch(err => {
        console.error("Failed to send text:", err);
    })
}

// PII POPUP UI
let piiPopup = null;

function createPopup() {
    if (piiPopup) return piiPopup;

    piiPopup = document.createElement("div");
    piiPopup.id = "pii-popup";

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    piiPopup.classList.add(isDark ? "dark" : "light");

    document.body.appendChild(piiPopup);
    return piiPopup;
}


function positionPopup(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const popup = createPopup();

    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
}

function renderPopup(result) {
    const popup = createPopup();

    const isPII = result.head1;

    let tokensHTML = "<em style='opacity:0.7;'>No sensitive tokens detected.</em>";

    if (result.head2 && result.head2.length > 0) {
        tokensHTML = result.head2.map(t => `
            <span class="pii-token-chip">${t.token}</span>
        `).join("");
    }

    popup.innerHTML = `
        <div class="pii-header">
            <div class="pii-icon ${isPII ? "danger" : "safe"}">
                ${isPII ? "⚠️" : "✅"}
            </div>
            <div>
                <div style="font-weight:600;">PII Detection</div>
                <div style="font-size:12px; opacity:0.8;">
                    ${isPII ? "Sensitive content detected" : "Text appears safe"}
                </div>
            </div>
        </div>

        <div>
            <strong>Contains PII:</strong>
            <span style="font-weight:600;">
                ${isPII ? "Yes" : "No"}
            </span>
        </div>

        <div style="margin-top:6px;">
            <strong>PII Tokens</strong>
            <div style="margin-top:6px;">
                ${tokensHTML}
            </div>
        </div>
    `;

    popup.style.display = "block";
    requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "scale(1)";
    });
}

// TOKEN HIGHLIGHTING IN PAGE
function highlightTokens(selection, piiTokens) {
    if (!piiTokens || piiTokens.length === 0) return;
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Extract selected content instead of deleting it
    const contents = range.extractContents();

    const temp = document.createElement("span");
    temp.appendChild(contents);

    let html = temp.innerHTML;

    piiTokens.forEach(tok => {
        const escaped = tok.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "g");

        html = html.replace(
            regex,
            `<span class="pii-inline">${tok.token}</span>`
        );
    });

    temp.innerHTML = html;

    // Insert back exactly where it was
    range.insertNode(temp);

}

// AUTO HIDE POPUP
document.addEventListener("click", (e) => {
    if (piiPopup && !piiPopup.contains(e.target)) {
        piiPopup.style.display = "none";
    }
});

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