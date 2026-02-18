const { Pinecone } = require('@pinecone-database/pinecone');

async function run() {
    const apiKey = 'pcsk_6Yzp2A_UqsstDarzyvhracAJmVFs1dMCJmM1uc55XwSGi56WEoiVTbDLFqhjBGkygApYB';
    const indexName = 'mee-memory';

    console.log('Initializing Pinecone...');
    const pinecone = new Pinecone({ apiKey });
    const index = pinecone.index(indexName);

    console.log('Upserting dummy record...');
    const record = {
        id: 'debug-record-1',
        values: Array(1536).fill(0.1), // Dummy embedding
        metadata: {
            text: 'Debug test',
            created_at: Date.now()
        }
    };

    try {
        await index.upsert([record]);
        console.log('Success!');
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
