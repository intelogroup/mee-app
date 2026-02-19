import os
from pinecone import Pinecone
from dotenv import load_dotenv
load_dotenv(dotenv_path="backend/.env")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("mee-memory")
# Query specifically for trait role
res = index.query(
    vector=[0.1]*1024, 
    top_k=10, 
    include_metadata=True, 
    namespace="164be941-19ab-4368-8bc3-4314fbe1062b",
    filter={"role": {"$eq": "trait"}}
)
print(f"\nFound {len(res.matches)} distilled TRAITS in namespace 164be941-19ab-4368-8bc3-4314fbe1062b:")
for m in res.matches:
    print(f"- {m.metadata.get('text')}")
