// Multi-class Mapping
const LABEL_MAP = [
  "Other / Unclassified",
  "Names & Relationships",
  "Emails & Online Accounts",
  "Birth Information",
  "Address & Location",
  "Phone & Financial Info",
  "Religious Information",
  "Location & Activity (Geotag/Schedule)",
  "IDs & Login Credentials",
  "Personal Demographics"
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
// Icon Center Show
Position.center = function (element) {
    element.style.top = `${window.scrollY + window.innerHeight / 2}px`;
    element.style.left = `${window.scrollX + window.innerWidth / 2}px`;
};

// Icon Text Show (non-input fields)
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

// Icon Text Show (input fields)
Position.noElementPosition = function (element, insideIcon) {
    const rect = element.getBoundingClientRect();

    insideIcon.style.top = `${window.scrollY + rect.bottom + 5}px`;
    insideIcon.style.left = `${window.scrollX + rect.left + 25}px`;
}

// Popup
Position.popup = function (selection) {
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!rect) return;
    const popup = UI.createPopup();

    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
}

// Popup based on icon (dynamic positioning)
Position.popupFromIcon = function () {
    const icon = UI.createIcon();
    const popup = UI.createPopup();

    // Ensure content is rendered first
    popup.style.display = "block";
    popup.style.opacity = "0";       // invisible for measurement
    popup.style.transform = "scale(1)";

    // Get the rendered size of the popup
    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;

    // Get icon position and viewport size
    const iconRect = icon.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Compute available space around icon
    const spaceBelow = viewportHeight - iconRect.bottom - 8; // margin
    const spaceAbove = iconRect.top - 8;

    // Vertical Position
    let top;

    if (spaceBelow >= popupHeight) {
        top = window.scrollY + iconRect.top + 8;
    } 
    else if (spaceAbove >= popupHeight) {
        top = window.scrollY + iconRect.top - (popupHeight + iconRect.height/2)- 8;
    } 
    else {
        // Clamp and allow scrolling
        top = window.scrollY + iconRect.bottom + 8;
        popup.style.maxHeight = `${Math.max(spaceBelow, spaceAbove)}px`;
        popup.style.overflowY = "auto";
    }

    // Horizontal Position
    let left = window.scrollX + iconRect.left;
    if (left + popupWidth > viewportWidth - 10) {
        left = window.scrollX + viewportWidth - popupWidth - 10;
    }
    if (left < 10) left = window.scrollX + 10;

    // Apply final position
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.opacity = "1"; // restore visibility
};

// 5. DOM ELEMENT CREATION (SINGLETONS)
UI.createIcon = function () {
    if (piiIcon) return piiIcon;

    piiIcon = document.createElement("div");
    piiIcon.id = "pii-icon-floating";

    piiIcon.style.display = "none";

    // Create the image element
    const logo = document.createElement("img");
    
    // Use browser.runtime.getURL to get the extension's internal path
    logo.src = browser.runtime.getURL("observepii_logo1.png");
    
    // Basic styling to make sure it fits your div
    logo.style.width = "100%";
    logo.style.height = "100%";
    logo.style.display = "block";
    logo.alt = "PII Warning";

    piiIcon.appendChild(logo);
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

    const activeEl = document.activeElement;

    if (activeEl && (activeEl.isContentEditable ||
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA")) {
        return; // NEVER touch editable fields
    }

    if (!piiTokens || piiTokens.length === 0 || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const piiWords = piiTokens.map(t => t.token.toLowerCase());

    console.log("PII Tokens received:", piiWords);
    // 1. Create a document fragment from the selection
    const fragment = range.extractContents();


    // 2. Helper function to process only text nodes
    const processNode = (node) => {
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            console.log("Processing Document Fragment...");
            [...node.childNodes].forEach(child => {
                const result = processNode(child);
                if (result) child.replaceWith(result);
            });
            return node; 
        }

        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent;
            let hasMatch = false;
            
            // Sort tokens by length (longest first) to prevent partial matching
            const sortedTokens = [...piiWords].sort((a, b) => b.length - a.length);

            console.log("SORTED TOKENS", sortedTokens);
            
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
                console.log("Match found! New HTML:", tempHTML);
                return newSpan;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recursively check children if the selection spans multiple elements
            if (node.classList && node.classList.contains("pii-inline")) {
                return null;
            }
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

    const debugContainer = document.createElement("div");
    debugContainer.appendChild(processed.cloneNode(true));
    
    console.log("FINAL HTML RESULT:", debugContainer.innerHTML);

    range.insertNode(processed);
    selection.removeAllRanges(); // Clear selection to stop recursive loops
}

Core.removeHighlight = function () {
    const highlights = document.querySelectorAll('.pii-inline');
    
    highlights.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });

    // Pinagdidikit ang mga text nodes na naghiwalay dahil sa span
    document.body.normalize();
    console.log("PII: Highlights removed and DOM normalized.");
};

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
        newcat = categories.map(cat => `<span>${cat}</span>`).join("");

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

            <div class="pii-categories-section">
                <strong>Categories:</strong>
                <div class="pii-categories">${newcat || "None"}</div>
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
        const activeEl = context?.activeEl;

        if (!context?.isInput) {
            if (!selection || selection.rangeCount === 0) return;
            window.piiLastRange = selection.getRangeAt(0).cloneRange();
        } else {
            window.piiLastRange = null;
        }

        window.piiLastResult = response.text;
        window.piiLastContext = context;

        const insideIcon = UI.createIcon();

        if (!context?.isInput && selection && selection.rangeCount > 0) {
            // DOM or contenteditable with valid selection
            Position.icon(selection);

        } else if (activeEl) {
            // Fallback for inputs OR broken contenteditable (Gmail headers)
            Position.noElementPosition(activeEl, insideIcon);

        } else {
            // Last fallback (should rarely happen)
            Position.center(insideIcon);
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

    const range = window.piiLastRange;
    const result = window.piiLastResult;
    const context = window.piiLastContext;

    if (!result) return;

    Core.renderPopup(result);
    Position.popupFromIcon();

    if (piiIcon) {
        piiIcon.style.display = "none";
    }

    // Only restore + highlight for normal DOM
    const selection = window.getSelection();
    if (!context?.isInput && !context?.isEditable && range) {
        selection.removeAllRanges();
        selection.addRange(range);
        // Core.highlight(selection, result.head2); // remove highlighting for now
    }
});

// DISMISSAL: Hides UI when clicking elsewhere
document.addEventListener("pointerdown", (e) => {
    // Hide everything as soon as the user starts a new interaction
    if (piiIcon && !piiIcon.contains(e.target)) {
        piiIcon.style.display = "none";
    }
    if (piiPopup && !piiPopup.contains(e.target)) {
        piiPopup.style.display = "none";
        // Core.removeHighlight();
    }
});

// SELECTION TRIGGER: Detects when the user finishes selecting text
let highlightTimeout;

document.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;

    if (
        (piiIcon && piiIcon.contains(event.target)) ||
        (piiPopup && piiPopup.contains(event.target))
    ) {
        return;
    }

    // Debounce for last highlighting activity after 100ms
    clearTimeout(highlightTimeout); // cancel previous pending call
    highlightTimeout = setTimeout(() => {
        const text = Select.getText();

        if (text && text.length > 1) {
            console.log("Highlighted text:", text); // print for debugging
            piiIconConsumed = false;
            lastSelectedText = text;

            const activeEl = document.activeElement;
            const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
            const isEditable = activeEl && activeEl.isContentEditable;

            Core.sendText(text, { isInput, isEditable, activeEl });
        } else if (piiIcon) {
            piiIcon.style.display = "none";
        }
    }, 100); // wait 100 ms after last pointerup
});