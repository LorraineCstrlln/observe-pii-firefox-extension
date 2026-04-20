// Helper Functions
import { getTokenChunks, softMax, mergeSubwords } from './helper.js';

export async function runInference(session, tokenizer, text) {
    const chunks = await getTokenChunks(tokenizer, text);
    const allRawTokens = [];
    const allRawOffsets = [];
    let isTextContextual = false;

    const TOKEN_THRESHOLD = 0.5;

    try {
        for (const chunk of chunks) {
            const results = await session.run(chunk.feeds);
            const logits1 = Array.from(results.logits_head1.data);
            const probsHead1 = softMax([logits1[0], logits1[1]]);
            
            if (probsHead1[1] > 0.5) isTextContextual = true;

            console.log(probsHead1[1])

            const contextualMask = Array.from(results.contextual_mask.data); 
            const logitsHead2 = Array.from(results.logits_head2.data);
            const numLabels = 10;

            const chunkTokens = chunk.tokenStrings.map((token, i) => {
                const start = i * numLabels;
                const logits = logitsHead2.slice(start, start + numLabels);
                const probs = softMax(logits);

                // Multi-class logic
                const piiProbs = probs.slice(1);                // Ignore Other (Class 0)
                const maxPII = Math.max(...piiProbs);           // best PII score
                const labelIndex = piiProbs.indexOf(maxPII) + 1 // shift back to rel index
                
                const isAttention = chunk.offsets[i][0] !== 0 || chunk.offsets[i][1] !== 0;
                const isPII = maxPII > TOKEN_THRESHOLD;
                const isContextual = isAttention && contextualMask[i] === 1 && isPII

                return {
                    token: token,
                    probs: probs,
                    maxPII: maxPII,
                    label: labelIndex,
                    isContextual: isContextual
                };
            });

            allRawTokens.push(...chunkTokens);
            allRawOffsets.push(...chunk.offsets);
        }

        const finalMergedPII = mergeSubwords(allRawTokens, allRawOffsets, TOKEN_THRESHOLD);
        console.log(finalMergedPII)

        return {
            head1: isTextContextual ? true : false, // simplified return
            head2: finalMergedPII // contains PII from the WHOLE text
        };

    } catch (err) {
        console.error("Inference Error:", err);
    }
}

globalThis.runInference = runInference;