// Helper Functions
import { getTokens, softMax, isContextual, mergeSubwords } from './helper.js';

export async function runInference(session, tokenizer, text) {
    const { tokenStrings, feeds } = await getTokens(tokenizer, text);

    try {
        const results = await session.run(feeds);

        const logits1 = Array.from(results.logits_head1.data);
        const probsHead1 = softMax([logits1[0], logits1[1]]);
        console.log(probsHead1);

        const contextualMask = Array.from(results.contextual_mask.data);
        // const isTextContextual = isContextual(contextualMask);
        const isTextContextual = probsHead1[1] > 0.5;

        let probsHead2 = null;

        if (isTextContextual) {
            const logitsHead2 = Array.from(results.logits_head2.data);
            const numLabels = 2;
            const reshaped = [];

            for (let i = 0; i < contextualMask.length; i++) {
                const start = i * numLabels;
                const end = start + numLabels;
                reshaped.push(logitsHead2.slice(start, end));
            }

            // Apply softmax per token
            const tokenProbs = reshaped.map(tokenLogits => softMax(tokenLogits));
            probsHead2 = tokenProbs.map((probs, i) => {
                if (contextualMask[i] === 1) {
                    return {
                        token: tokenStrings[i],
                        probs
                    };
                }
                return null;
            });
        } else {
            console.log("Head2 skipped (no contextual tokens)");
        }

        return {
            head1: probsHead1,
            head2: mergeSubwords(probsHead2),
            isTextContextual 
        };

    } catch (err) {
        console.error("Failed to run inference on selected text:", err);
    }
}