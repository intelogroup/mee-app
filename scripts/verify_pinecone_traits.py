
import os
from pinecone import Pinecone
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="backend/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")

def verify_traits():
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)

    print(f"Querying index: {PINECONE_INDEX} for traits...")
    
    # We can't "list" all vectors easily without a scan, but we can query with a dummy vector
    # and a metadata filter for role='trait' to find them.
    # Alternatively, we can use the 'list' (pagination) feature if available, or fetch by ID if known.
    # Since we don't know IDs, we'll query using a generic vector.
    
    # Create a dummy vector of 1024 dimensions (typical for multilingual-e5-large)
    # Adjust dimension if your model is different (e.g. 1536 for openai)
    # Based on logs, we are using "multilingual-e5-large" via Pinecone Inference which is 1024.
    dummy_vector = [0.1] * 1024 

    try:
        results = index.query(
            vector=dummy_vector,
            top_k=50,
            include_metadata=True,
            filter={
                "role": {"$eq": "trait"}
            }
        )

        if not results.matches:
            print("No traits found.")
            return

        print(f"Found {len(results.matches)} traits:")
        for match in results.matches:
            print(f"- ID: {match.id}")
            print(f"  Trait: {match.metadata.get('text')}")
            print(f"  User: {match.metadata.get('role')}") # Checking role key usage
            print("---")

    except Exception as e:
        print(f"Error querying Pinecone: {e}")

if __name__ == "__main__":
    verify_traits()
