
import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

# Check backend .env if root one is missing keys
if not os.getenv("PINECONE_API_KEY"):
    load_dotenv("backend/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")
USER_ID = "164be941-19ab-4368-8bc3-4314fbe1062b"

def check_pinecone_traits():
    print(f"Checking Pinecone for traits of user {USER_ID}...")
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    
    try:
        # Query with dummy vector
        res = index.query(
            namespace=USER_ID,
            vector=[0.01]*1024,
            top_k=20,
            filter={"role": {"$eq": "trait"}},
            include_metadata=True
        )
        
        if not res.matches:
            print("❌ No traits found in Pinecone for this user.")
        else:
            print(f"✅ Found {len(res.matches)} traits:")
            for m in res.matches:
                print(f"- {m.metadata.get('text')} (Category: {m.metadata.get('category')})")
                
    except Exception as e:
        print(f"❌ Error querying Pinecone: {e}")

if __name__ == "__main__":
    check_pinecone_traits()
