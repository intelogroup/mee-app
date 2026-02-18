
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

try:
    response = supabase.table("profiles").select("id, email, telegram_chat_id, is_active").neq("telegram_chat_id", "null").execute()
    users = response.data
    
    if not users:
        print("No linked users found.")
    else:
        print(f"Found {len(users)} linked user(s):")
        for user in users:
            print(f"- User: {user.get('email', 'Unknown')} (ID: {user['id']}) -> Chat ID: {user['telegram_chat_id']}")

except Exception as e:
    print(f"Error querying Supabase: {e}")
