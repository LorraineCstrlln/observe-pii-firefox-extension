// Helper Functions
import { getTokenChunks, softMax, mergeSubwords } from './helper.js';

export async function runInference(session, tokenizer, text) {
    const chunks = await getTokenChunks(tokenizer, text);
    const allRawTokens = [];
    const allRawOffsets = [];
    let isTextContextual = false;

    try {
        for (const chunk of chunks) {
            const results = await session.run(chunk.feeds);
            const logits1 = Array.from(results.logits_head1.data);
            const probsHead1 = softMax([logits1[0], logits1[1]]);
            
            if (probsHead1[1] > 0.5) isTextContextual = true;

            const contextualMask = Array.from(results.contextual_mask.data); 
            const logitsHead2 = Array.from(results.logits_head2.data);
            const numLabels = 2;

            const chunkTokens = chunk.tokenStrings.map((token, i) => {
                const start = i * numLabels;
                const logits = logitsHead2.slice(start, start + numLabels);
                return {
                    token: token,
                    probs: softMax(logits),
                    isContextual: contextualMask[i] === 1
                };
            });

            allRawTokens.push(...chunkTokens);
            allRawOffsets.push(...chunk.offsets);
        }

        const finalMergedPII = mergeSubwords(allRawTokens, allRawOffsets);

        return {
            head1: isTextContextual ? true : false, // simplified return
            head2: finalMergedPII // contains PII from the WHOLE text
        };

    } catch (err) {
        console.error("Inference Error:", err);
    }
}