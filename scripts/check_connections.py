import os
import sys
from pinecone import Pinecone
from supabase import create_client, Client
from dotenv import load_dotenv

# Add backend to path to ensure imports work if needed, though we use direct libs here
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Load env vars
load_dotenv(dotenv_path="backend/.env")

def check_pinecone():
    print("\n--- Checking Pinecone Connection ---")
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX", "mee-memory")
    
    if not api_key:
        print("❌ PINECONE_API_KEY not found in backend/.env")
        return False

    try:
        pc = Pinecone(api_key=api_key)
        # List indexes to verify connection
        indexes = pc.list_indexes()
        print(f"✅ Connected to Pinecone. Indexes: {[i.name for i in indexes]}")
        
        # Check specific index
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        print(f"✅ Index '{index_name}' Stats:")
        print(f"   - Total Vectors: {stats.total_vector_count}")
        print(f"   - Dimension: {stats.dimension}")
        return True
    except Exception as e:
        print(f"❌ Pinecone Connection Failed: {e}")
        return False

def check_supabase():
    print("\n--- Checking Supabase Connection ---")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not found in backend/.env")
        return False

    try:
        supabase: Client = create_client(url, key)
        # Perform a simple query (e.g., count users or check health)
        # We'll just check if we can select from a public table or auth
        response = supabase.table("profiles").select("count", count="exact").execute()
        print(f"✅ Connected to Supabase.")
        print(f"   - Profiles Count: {response.count}")
        return True
    except Exception as e:
        print(f"❌ Supabase Connection Failed: {e}")
        return False

if __name__ == "__main__":
    p_status = check_pinecone()
    s_status = check_supabase()
    
    if p_status and s_status:
        print("\n🎉 All systems operational!")
    else:
        print("\n⚠️ Connection issues detected.")
