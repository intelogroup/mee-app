import time
from pinecone import Pinecone, ServerlessSpec
from app.core.config import PINECONE_API_KEY, PINECONE_INDEX

pc = Pinecone(api_key=PINECONE_API_KEY)

def recreate_index():
    index_name = PINECONE_INDEX
    
    # Check if index exists
    existing_indexes = pc.list_indexes().names()
    if index_name in existing_indexes:
        print(f"Deleting existing index: {index_name} (Dimension mismatch likely)")
        pc.delete_index(index_name)
        time.sleep(5) # Wait for deletion
    
    print(f"Creating new index: {index_name} with dimension 1024")
    try:
        pc.create_index(
            name=index_name,
            dimension=1024, # Matches multilingual-e5-large
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print("Index created successfully!")
    except Exception as e:
        print(f"Error creating index: {e}")

if __name__ == "__main__":
    recreate_index()
