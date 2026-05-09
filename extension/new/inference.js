// Helper Functions
import { getTokenChunks, softMax, mergeSubwords } from './helper.js';

export async function runInference(session, tokenizer, text) {
    const chunks = await getTokenChunks(tokenizer, text);
    const allRawTokens = [];
    const allRawOffsets = [];
    let isTextContextual = false;

    const SENTENCE_THRESHOLD = 0.5;
    const TOKEN_THRESHOLD = 0.7;

    const HEAD1_TEMP = 1.0308;
    const HEAD2_TEMP = 0.9638;

    try {
        for (const chunk of chunks) {
            const results = await session.run(chunk.feeds);
            const logits1 = Array.from(results.logits_head1.data);
            const scaledHead1 = [logits1[0], logits1[1]].map(v => v / HEAD1_TEMP);
            const probsHead1 = softMax(scaledHead1);
            
            if (probsHead1[1] > SENTENCE_THRESHOLD) isTextContextual = true;

            console.log(probsHead1[1])

            const contextualMask = Array.from(results.contextual_mask.data); 
            const logitsHead2 = Array.from(results.logits_head2.data);
            const numLabels = 10;

            const chunkTokens = chunk.tokenStrings.map((token, i) => {
                const start = i * numLabels;
                const logits = logitsHead2.slice(start, start + numLabels);
                const scaledLogits = logits.map(v => v / HEAD2_TEMP);
                const probs = softMax(scaledLogits);

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