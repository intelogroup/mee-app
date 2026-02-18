
import os
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

def setup_pinecone():
    load_dotenv()
    
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX", "mee-memory")
    
    if not api_key:
        print("Error: PINECONE_API_KEY not found in .env")
        return

    pc = Pinecone(api_key=api_key)
    
    # Check if index exists
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    
    if index_name in existing_indexes:
        print(f"Index '{index_name}' already exists.")
    else:
        print(f"Creating index '{index_name}'...")
        try:
            pc.create_index(
                name=index_name,
                dimension=1536, # OpenAI text-embedding-3-small
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
            print(f"Successfully created index '{index_name}'.")
            print("Note: Fast creation might take a minute to be ready.")
        except Exception as e:
            print(f"Error creating index: {e}")

if __name__ == "__main__":
    setup_pinecone()
