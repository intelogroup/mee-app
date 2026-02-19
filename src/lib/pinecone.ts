import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

export async function saveMemory(
    userId: string,
    text: string,
    role: 'user' | 'assistant'
) {
    if (!process.env.PINECONE_INDEX) {
        throw new Error('PINECONE_INDEX is not set');
    }

    try {
        // 1. Generate Embedding using Pinecone Inference
        // @ts-ignore: SDK type definition mismatch (expects 1 arg, runtime supports 3)
        const embeddingResponse = await pinecone.inference.embed(
            'multilingual-e5-large',
            [text],
            { inputType: 'passage' }
        );

        const embedding = embeddingResponse[0].values;

        // 2. Upsert to Pinecone
        const index = pinecone.index(process.env.PINECONE_INDEX);

        // Create a unique ID for the memory (timestamp-random)
        const memoryId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

        console.log(`[Memory] Embedding length: ${embedding.length}`);
        const record = {
            id: memoryId,
            values: embedding,
            metadata: {
                user_id: userId,
                text: text,
                role: role,
                created_at: Date.now(),
            },
        };

        // Use default namespace
        const ns = index.namespace('default');
        console.log('[Memory] Upserting to default namespace:', memoryId);

        await ns.upsert([record] as any);

        console.log(`[Memory] Saved ${role} message for user ${userId}`);
        return { success: true, id: memoryId };
    } catch (error) {
        console.error('[Memory] Error saving to Pinecone:', error);
        return { success: false, error };
    }
}
