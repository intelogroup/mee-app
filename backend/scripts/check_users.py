
from dotenv import load_dotenv
import os
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials in .env")
    exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Query for profiles where telegram_chat_id is NOT null
    response = supabase.table("profiles").select("*").not_.is_("telegram_chat_id", "null").execute()
    
    users = response.data
    
    if not users:
        print("No users have connected to the bot yet.")
    else:
        print(f"Found {len(users)} connected user(s):")
        for user in users:
            print(f"- User Data: {user}")  # Print full dict to see keys
            print("---")

except Exception as e:
    print(f"❌ Error querying Supabase: {e}")
