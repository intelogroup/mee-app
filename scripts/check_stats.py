import os
from pinecone import Pinecone
from dotenv import load_dotenv
load_dotenv(dotenv_path="backend/.env")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("mee-memory")
stats = index.describe_index_stats()
print(stats)
