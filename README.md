# OBSERVE-PII Extension

## Description
OBSERVE-PII detects Personally Identifiable Information (PII) in real-time on user-highlighted text in web pages. All processing is performed locally using a bundled ONNX TinyBERT model; no data is stored or transmitted externally.

## Contents
- `background.js` - Background service handling ONNX model initialization and inference
- `content.js` - Content script for detecting highlighted text
- `inference.js` - Functions for running the ONNX model on selected text
- `helper.js` - Utility functions used by the extension
- `manifest.json` - Extension manifest
- `model/dualhead.onnx` - ONNX TinyBERT model
- `lib/ort.min.js` - ONNX Runtime core
- `lib/ort-wasm-simd-threaded.jsep.mjs` - ONNX WASM helper module
- `lib/ort-wasm-simd-threaded.jsep.wasm` - ONNX WASM binary
- `lib/transformers.min.js` - Transformers.js library
- `icons/observepii_logo1_48` - Extension icons -> 48x48
- `icons/observepii_logo1_96` - Extension icons -> 96x96
- `icons/observepii_logo1_512`  - Extension icons -> 512x512

## Build / Installation Instructions
1. Extract the ZIP.
2. All scripts, models, and libraries are already included.
3. No build script is required; the extension is distributed in its final form.
4. Load the extension in Firefox via `about:debugging` or install through the add-on system.

## Environment Requirements
- Firefox version 140 or newer
- No other dependencies required

## Reproducibility Note
- The add-on submitted as a ZIP on Mozilla Add-ons can be reproduced exactly using the source code provided in this package.  
- All scripts, models, WASM files, and libraries are included as-is. The current `init()` logic (including the `if () await init()` safety guard) is identical to what runs in the published add-on.  
- No additional build, minification, or bundling is required.

## Version 1.x and 2.x Changes
- See CHANGELOG.md
