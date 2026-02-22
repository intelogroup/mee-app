import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")
USER_ID = "164be941-19ab-4368-8bc3-4314fbe1062b" # Jim

def debug_brain():
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    
    print(f"Checking traits for user: {USER_ID}")
    
    # Query for traits
    res = index.query(
        namespace=USER_ID,
        vector=[0.1]*1024,
        top_k=50,
        filter={"role": {"$eq": "trait"}},
        include_metadata=True
    )
    
    print(f"Found {len(res.matches)} traits:")
    for m in res.matches:
        print(f"- {m.metadata.get('text')} (Category: {m.metadata.get('category', 'N/A')})")

if __name__ == "__main__":
    debug_brain()
