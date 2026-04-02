// Multi-class Mapping
const LABEL_MAP = [
  "Other",
  "Name_Relationship",
  "Email_Accounts",
  "Birth Info",
  "Address_Location",
  "Phone_Financial",
  "Religion",
  "Geotag_Schedule",
  "IDs_Credentials",
  "Demographics"
];


// PII DETECTION CONTENT SCRIPT
// 1. Monitor user text selection (DOM and Inputs).
// 2. Communicate with background.js for inference.
// 3. Render floating UI elements (Warning Icon & Results Popup).
 
// 1. INITIALIZATION: Inject Stylesheet
(function injectPIICSS() {
    if (document.getElementById("pii-css")) return;
    const link = document.createElement("link");
    link.id = "pii-css";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = browser.runtime.getURL("content.css");
    document.head.appendChild(link);
})();

const UI = {};
const Position = {};
const Select = {};
const Core = {};

// const UI = { createIcon, createPopup };
// const Position = { center, icon, popup };
// const Select = { getText };
// const Core = { highlight, renderPopup, sendText };

// 2. GLOBAL STATE
let piiIcon = null;
let piiPopup = null;
let piiIconConsumed = false;   // prevent duplicate triggers for the same selection
let lastSelectedText = "";     // used to detect if the selection actually changed

// 3. SELECTION UTILITIES
Select.getText = function () {
    const activeEl = document.activeElement;
    // Case 1: input or textarea
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        return (start !== end) ? activeEl.value.substring(start, end).trim() : "";
    }
    // Case 2: normal DOM selection
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
};
 
// 4. POSITIONING LOGIC
Position.center = function (element) {
    element.style.top = `${window.scrollY + window.innerHeight / 2}px`;
    element.style.left = `${window.scrollX + window.innerWidth / 2}px`;
};

Position.icon = function (selection) {
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range || range.collapsed) return; // ignore empty/collapsed selection

    const rects = range.getClientRects();
    if (!rects.length) return;
    const lastRect = rects[rects.length - 1];
    const icon = UI.createIcon();

    icon.style.top = `${window.scrollY + lastRect.bottom + 5}px`;
    icon.style.left = `${window.scrollX + lastRect.right}px`;
};

Position.popup = function (selection) {
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!rect) return;
    const popup = UI.createPopup();

    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
}

Position.popupFromRect = function (rect) {
    const popup = UI.createPopup();

    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
};

// 5. DOM ELEMENT CREATION (SINGLETONS)
UI.createIcon = function () {
    if (piiIcon) return piiIcon;
    piiIcon = document.createElement("div");
    piiIcon.id = "pii-icon-floating";
    piiIcon.innerHTML = "⚠️";
    document.body.appendChild(piiIcon);
    return piiIcon;
}

UI.createPopup = function () {
    if (piiPopup) return piiPopup;
    piiPopup = document.createElement("div");
    piiPopup.id = "pii-popup";
    document.body.appendChild(piiPopup);
    return piiPopup;
}

// 6. CORE FUNCTIONALITY AND RENDERING
// Highlighting logic: Wraps detected PII tokens in <span class="pii-inline">
Core.highlight = function (selection, piiTokens) {
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
            [...node.childNodes].forEach(child => {
                const result = processNode(child);
                if (result) {
                    child.replaceWith(result);
                }
            });
        }
        return null;
    };

    // 3. Process the fragment and put it back
    const processed = processNode(fragment) || fragment;
    range.insertNode(processed);
    selection.removeAllRanges(); // Clear selection to stop recursive loops
}

// Builds and displays the detailed PII info popup
Core.renderPopup = function (result) {
    const popup = UI.createPopup();
    const isPII = result.head1;

    let tokensHTML = "<em class='pii-no-tokens'>No sensitive tokens detected.</em>";
    let newcat;

    if (result.head2 && result.head2.length > 0) {
        // tokensHTML = result.head2.map(t => `<span class="pii-token-chip">${t.token}</span>`).join("");
        
        // Initial mapping of multi-class labels with the token
        tokensHTML = result.head2.map(t => {
            const labelName = LABEL_MAP[t.label] || "Other";  // fallback
            return `<span class="pii-token-chip">${t.token} (${labelName})</span>`;
        }).join("");

        const categories = [...new Set(
            result.head2.map(t => LABEL_MAP[t.label] || "Other")
        )];
        newcat = categories.join(", ");

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
                <strong>Categories:</strong>
                <div class="pii-tokens-container">${newcat || "None"}</div>
            </div>
        </div>
    `;
            // <div class="pii-tokens-section">
            //     <strong>PII Tokens:</strong>
            //     <div class="pii-tokens-container">${tokensHTML}</div>
            // </div>

    popup.style.display = "block";
    requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "scale(1)";
    });
}

// Sends text to background.js for AI analysis
Core.sendText = function (text, context = {}) {
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
            Position.icon(selection);
        } else {
            Position.center(UI.createIcon());
        }

        const icon = UI.createIcon();
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

// 7. EVENT LISTENERS
// ICON CLICK: Triggers the actual highlighting and shows the detailed popup
const icon = UI.createIcon();
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

        const rect = range.getBoundingClientRect();

        Core.highlight(selection, result.head2);

        // Use stored rect instead of selection
        Position.popupFromRect(rect);

    } else {
        // For inputs: just show popup in center
        Position.center(UI.createPopup());
    }

    Core.renderPopup(result);
});

// DISMISSAL: Hides UI when clicking elsewhere
document.addEventListener("pointerdown", (e) => {
    // Hide everything as soon as the user starts a new interaction
    if (piiIcon && !piiIcon.contains(e.target)) {
        piiIcon.style.display = "none";
    }
    if (piiPopup && !piiPopup.contains(e.target)) {
        piiPopup.style.display = "none";
    }
});

// SELECTION TRIGGER: Detects when the user finishes selecting text
document.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;

    const activeEl = document.activeElement;
    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    const isEditable = activeEl && activeEl.isContentEditable;

    setTimeout(() => {
        const text = Select.getText();

        if (text && text.length > 1) {
            console.log("Highlighted text:", text); // print for debugging

            if (text !== lastSelectedText) {
                piiIconConsumed = false;
                lastSelectedText = text;
            }
            Core.sendText(text, { isInput, isEditable });
        } else {
            if (piiIcon) piiIcon.style.display = "none";
        }
    }, 100);
});