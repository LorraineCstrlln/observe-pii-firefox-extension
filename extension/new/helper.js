export async function getTokenChunks(tokenizer, text, max_length=128) {
    let encoded = await tokenizer(text, {
        padding: false,            
        truncation: false
    });

    const allInputIds = Array.from(encoded.input_ids.data);
    const allAttnMask = Array.from(encoded.attention_mask.data);
    console.log("Token Length", encoded.input_ids.data.length);

    const chunks = [];
    let currentPos = 0;
    const lowerText = text.toLowerCase();

    for (let i = 0; i < allInputIds.length; i += max_length) {
        let chunkIds = allInputIds.slice(i, i + max_length);
        let chunkMask = allAttnMask.slice(i, i + max_length);

        // Pad if smaller than 128
        while (chunkIds.length < max_length) {
            chunkIds.push(0);
            chunkMask.push(0);
        }

        const chunkOffsets = [];
        const chunkStrings = [];

        for (const id of chunkIds) {
            const token = tokenizer.decode([id], { skip_special_tokens: false});
            chunkStrings.push(token);

            if (id === 0 || id === 101 || id === 102 || id === 103) {
                chunkOffsets.push([0, 0]);
                continue;
            }

            const cleanToken = token.replace("##", "");
            let start = lowerText.indexOf(cleanToken, currentPos);

            if (start !== -1) {
                let end = start + cleanToken.length;
                chunkOffsets.push([start, end]);
                currentPos = end; // Move cursor forward
            } else {
                chunkOffsets.push([0, 0]);
            }
        }

        const inputIds = BigInt64Array.from(chunkIds.map(BigInt));
        const attnMask = BigInt64Array.from(chunkMask.map(BigInt));

        const feeds = {
            input_ids_head1: new ort.Tensor("int64", inputIds, [1, inputIds.length]),
            attention_mask_head1: new ort.Tensor("int64", attnMask, [1, attnMask.length]),
            input_ids_head2: new ort.Tensor("int64", inputIds, [1, inputIds.length]),
            attention_mask_head2: new ort.Tensor("int64", attnMask, [1, attnMask.length]),        
        };

        chunks.push({ feeds, offsets: chunkOffsets, tokenStrings: chunkStrings });
    }
    return chunks;
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

export function mergeSubwords(tokens, offsets) {
    if(!tokens || !offsets ) return [];

    const merged = [];
    let buffer = null;

    tokens.forEach((t, i) => {
        if(!t) return;
        const [start, end] = offsets[i];

        if(t.token === "[CLS]" || t.token === "[SEP]" || (start === 0 && end === 0)) return;
        if(t.token.startsWith("##")) {
            if(buffer) {
                buffer.token += t.token.slice(2); // remove '##'
                buffer.probs = Math.max(buffer.prob, t.probs[1]);
                buffer.end = end;
            }
        } else {
            if (buffer && buffer.isContextual) merged.push(buffer);
            buffer = { 
                token: t.token, 
                probs: t.probs[1], // Probability of being PII
                start: start,
                end: end,
                isContextual: t.isContextual
            };
        }
    });

    if (buffer && buffer.isContextual) merged.push(buffer);
    return merged;
}