
import pinecone
import inspect
print(f"Pinecone location: {inspect.getfile(pinecone)}")
try:
    from pinecone import Pinecone
    print("Import successful!")
except ImportError as e:
    print(f"Import failed: {e}")
    print(f"Dir: {dir(pinecone)}")
