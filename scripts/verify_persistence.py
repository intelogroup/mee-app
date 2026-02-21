
import os
import asyncio
from pinecone import Pinecone
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load environment variables
load_dotenv(dotenv_path="backend/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

USER_ID = "164be941-19ab-4368-8bc3-4314fbe1062b"

async def verify_everything():
    print(f"--- Verifying Persistence for User {USER_ID} ---\n")
    
    # 1. Verify Pinecone Episodic Memory
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    
    print(f"Checking Pinecone index '{PINECONE_INDEX}' for episodic memories...")
    dummy_vector = [0.1] * 1024
    res_mem = index.query(
        vector=dummy_vector,
        top_k=5,
        include_metadata=True,
        namespace=USER_ID,
        filter={"role": {"$eq": "episodic"}}
    )
    
    if res_mem.matches:
        print(f"✅ Found {len(res_mem.matches)} episodic memories:")
        for m in res_mem.matches:
            print(f"  - [{m.id}] {m.metadata.get('text')}")
    else:
        print("❌ No episodic memories found in Pinecone.")

    # 2. Verify Supabase Message Logs
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"\nChecking Supabase 'messages' table...")
    msg_res = supabase.table("messages").select("*").eq("user_id", USER_ID).order("created_at", desc=True).limit(5).execute()
    
    if msg_res.data:
        print(f"✅ Found {len(msg_res.data)} message logs (last 5):")
        for msg in msg_res.data:
            print(f"  - [{msg['created_at']}] {msg['role']}: {msg['content'][:100]}...")
    else:
        print("❌ No message logs found in Supabase.")

    # 3. Verify Cron Summarizer state
    print(f"\nChecking Supabase 'profiles' for cron state...")
    prof_res = supabase.table("profiles").select("last_summary_at").eq("id", USER_ID).execute()
    if prof_res.data:
        last_at = prof_res.data[0].get("last_summary_at")
        print(f"✅ last_summary_at: {last_at}")
        if last_at:
            last_ts = datetime.fromisoformat(last_at.replace('Z', '+00:00'))
            diff = datetime.now(timezone.utc) - last_ts
            print(f"   (Last summary was {diff.total_seconds() / 3600:.2f} hours ago)")
    else:
        print("❌ Profile not found.")

if __name__ == "__main__":
    asyncio.run(verify_everything())
