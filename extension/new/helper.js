export async function getTokens(tokenizer, text) {
    let encoded = await tokenizer(text, {
        padding: true,            
        truncation: true,
        max_length: 128,          
    });

    let inputIdsFlat = Array.from(encoded.input_ids.data);
    let attnMaskFlat = Array.from(encoded.attention_mask.data);

    while (inputIdsFlat.length < 128) {
        inputIdsFlat.push(0); 
        attnMaskFlat.push(0);
    }
    
    // Ensure it's not LONGER than 128
    inputIdsFlat = inputIdsFlat.slice(0, 128);
    attnMaskFlat = attnMaskFlat.slice(0, 128);

    const inputIds = BigInt64Array.from(inputIdsFlat.map(BigInt));
    const attnMask = BigInt64Array.from(attnMaskFlat.map(BigInt));

    const feeds = {
        input_ids_head1: new ort.Tensor("int64", inputIds, [1, inputIds.length]),
        attention_mask_head1: new ort.Tensor("int64", attnMask, [1, attnMask.length]),
        input_ids_head2: new ort.Tensor("int64", inputIds, [1, inputIds.length]),
        attention_mask_head2: new ort.Tensor("int64", attnMask, [1, attnMask.length]),        
    }
    
    const tokenStrings = inputIdsFlat.map(id => tokenizer.decode([id]));
    return { tokenStrings, feeds };
}

export function softMax(logits) {
    // Subtract max for numerical stability (plugging in to exp() can diverge)
    const max = Math.max(...logits);

    // Exponentiate 
    const exps = logits.map(x => Math.exp(x - max));

    // Normalize values
    const sum = exps.reduce((a, b) => a + b, 0); // get sum of exponentiated logits
    const probs = exps.map(e => e / sum); // normalize exponentiated logits

    return probs
}

export function isContextual(mask) {
    return mask.some(v => v === 1);
}

export function mergeSubwords(tokens) {
    if(!tokens) return;

    const merged = [];
    let buffer = null;
    let fullText = "";

    tokens.forEach((t) => {
        if(!t) return;
        const token = t.token;
        const probs = t.probs;

        if(token === "[CLS]" || token === "[SEP]") return;
        if(token.startsWith("##")) {
            if(buffer) {
                buffer.token += token.slice(2); // remove '##'
                buffer.probs = probs;
            }
        } else {
            if (buffer) merged.push(buffer);
            buffer = { token, probs };
        }
    });

    if (buffer) merged.push(buffer);

    fullText = merged.map(t => t.token).join(" ");
    return { mergedTokens: merged, fullText };
}