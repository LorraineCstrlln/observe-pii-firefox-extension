(function injectPIICSS() {
    if (document.getElementById("pii-css")) return;

    const link = document.createElement("link");
    link.id = "pii-css";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = browser.runtime.getURL("content.css");

    document.head.appendChild(link);
})();

// GLOBAL STATE
let piiIcon = null;
let piiPopup = null;

let piiIconConsumed = false;   // tracks if icon was already clicked
let lastSelectedText = "";     // tracks last selection

// Gets what user highlighted
function getSelectedText() {
    const activeEl = document.activeElement;

    // Case 1: input or textarea
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;

        if (start !== end) {
            return activeEl.value.substring(start, end).trim();
        }
        return "";
    }

    // Case 2: normal DOM selection
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
}

function positionIconNearCursor() {
    const icon = createIcon();

    icon.style.top = `${window.scrollY + window.innerHeight / 2}px`;
    icon.style.left = `${window.scrollX + window.innerWidth / 2}px`;
}

function positionPopupFallback() {
    const popup = createPopup();

    popup.style.top = `${window.scrollY + window.innerHeight / 2}px`;
    popup.style.left = `${window.scrollX + window.innerWidth / 2}px`;
}

// Sends selected text to background.js
function sendSelectedText(text, context = {}) {
    if (!text || piiIconConsumed) return;

    context = context || {};

    if (piiIcon) piiIcon.style.display = "none";

    browser.runtime.sendMessage({
        type: "runInference",
        text: text
    }).then(response => { 
        if (!response || !response.text) return;

        const selection = window.getSelection();

        if (!context?.isInput) {
            if (!selection || selection.rangeCount === 0) return;
            window.piiLastRange = selection.getRangeAt(0).cloneRange();
        } else {
            window.piiLastRange = null;
        }

        window.piiLastResult = response.text;
        window.piiLastContext = context;

        if (!context?.isInput && selection && selection.rangeCount > 0) {
            positionIcon(selection);
        } else {
            positionIconNearCursor();
        }

        const icon = createIcon();
        icon.style.opacity = "0";
        icon.style.display = "flex";

        requestAnimationFrame(() => {
            icon.style.transition = "opacity 0.2s ease-in-out, transform 0.2s ease-out";
            icon.style.opacity = "1";
        });

    }).catch(err => {
        console.error("Failed to send text:", err);
    });
}
// Highlight words inside text
function highlightTokens(selection, piiTokens) {
    if (!piiTokens || piiTokens.length === 0 || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const piiWords = piiTokens.map(t => t.token.toLowerCase());

    // 1. Create a document fragment from the selection
    const fragment = range.extractContents();

    // 2. Helper function to process only text nodes
    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent;
            let hasMatch = false;
            
            // Sort tokens by length (longest first) to prevent partial matching
            const sortedTokens = [...piiWords].sort((a, b) => b.length - a.length);
            
            const wrapper = document.createElement('span');
            let tempHTML = text;

            sortedTokens.forEach(token => {
                const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                // The regex \b ensures we only match whole words
                const regex = new RegExp(`(\\b${escaped}\\b)`, "gi");
                
                if (regex.test(tempHTML)) {
                    hasMatch = true;
                    tempHTML = tempHTML.replace(regex, `<span class="pii-inline">$1</span>`);
                }
            });

            if (hasMatch) {
                const newSpan = document.createElement('span');
                newSpan.innerHTML = tempHTML;
                return newSpan;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recursively check children if the selection spans multiple elements
            for (let i = 0; i < node.childNodes.length; i++) {
                const result = processNode(node.childNodes[i]);
                if (result) {
                    node.replaceChild(result, node.childNodes[i]);
                }
            }
        }
        return null;
    };

    // 3. Process the fragment and put it back
    processNode(fragment);
    range.insertNode(fragment);
    selection.removeAllRanges(); // Clear selection to stop recursive loops
}

// Icon Position
function positionIcon(selection) {
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    // Use the last rect to place the icon at the end of the selection
    const lastRect = rects[rects.length - 1]; 
    const icon = createIcon();

    icon.style.top = `${window.scrollY + lastRect.bottom + 5}px`;
    icon.style.left = `${window.scrollX + lastRect.right}px`;
}

// Icon container
function createIcon() {
    if (piiIcon) return piiIcon;

    piiIcon = document.createElement("div");
    piiIcon.id = "pii-icon-floating";
    piiIcon.innerHTML = "⚠️";

    document.body.appendChild(piiIcon);
    return piiIcon;
}


// Main popup positions 
function positionPopup(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect(); //gets position of highlighted text
    const popup = createPopup();

    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
}

// Main popup container
function createPopup() {
    if (piiPopup) return piiPopup;

    piiPopup = document.createElement("div");
    piiPopup.id = "pii-popup";

    document.body.appendChild(piiPopup);
    return piiPopup;
}

function renderPopup(result) {
    const popup = createPopup();
    const isPII = result.head1;

    let tokensHTML = "<em class='pii-no-tokens'>No sensitive tokens detected.</em>";

    if (result.head2 && result.head2.length > 0) {
        tokensHTML = result.head2.map(t => `<span class="pii-token-chip">${t.token}</span>`).join("");
    }

    popup.innerHTML = `
        <div class="pii-pixel-frame">
            <div class="pii-header">
                <div class="pii-icon ${isPII ? "danger" : "safe"}">
                    ${isPII ? "⚠️" : "✅"}
                </div>
                <div>
                    <div class="pii-header-title">PII Detection</div>
                    <div class="pii-header-sub">
                        ${isPII ? "Oops! Sensitive info detected!" : "Text appears safe"}
                    </div>
                </div>
            </div>

            <div class="pii-status-row">
                <strong>Contains PII:</strong>
                <span class="pii-status ${isPII ? "danger" : "safe"}">${isPII ? "Yes" : "No"}</span>
            </div>

            <div class="pii-tokens-section">
                <strong>PII Tokens</strong>
                <div class="pii-tokens-container">${tokensHTML}</div>
            </div>
        </div>
    `;

    popup.style.display = "block";
    requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "scale(1)";
    });
}

const icon = createIcon();
icon.addEventListener("click", (e) => {
    e.stopPropagation(); 

    piiIconConsumed = true;

    if (piiIcon) {
        piiIcon.style.display = "none";
    }

    const range = window.piiLastRange;
    const result = window.piiLastResult;
    const context = window.piiLastContext;

    if (!result) return;

    const selection = window.getSelection();

    // Only restore + highlight for normal DOM
    if (!context?.isInput && range) {
        selection.removeAllRanges();
        selection.addRange(range);

        highlightTokens(selection, result.head2);
        positionPopup(selection);
    } else {
        // For inputs: just show popup in center
        positionPopupFallback();
    }

    renderPopup(result);
});

document.addEventListener("pointerdown", (e) => {
    // Hide everything as soon as the user starts a new interaction
    if (piiIcon && !piiIcon.contains(e.target)) {
        piiIcon.style.display = "none";
    }
    if (piiPopup && !piiPopup.contains(e.target)) {
        piiPopup.style.display = "none";
    }
});

document.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;

    const activeEl = document.activeElement;
    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    const isEditable = activeEl && activeEl.isContentEditable;

    setTimeout(() => {
        const text = getSelectedText();

        if (text && text.length > 1) {

            if (text !== lastSelectedText) {
                piiIconConsumed = false;
                lastSelectedText = text;
            }
            sendSelectedText(text, { isInput, isEditable });
        } else {
            if (piiIcon) piiIcon.style.display = "none";
        }
    }, 100);
});