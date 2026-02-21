
import os
import httpx
from dotenv import load_dotenv

# Load local .env
load_dotenv(dotenv_path="backend/.env")

RENDER_API_KEY = os.getenv("RENDER_API_KEY")
SERVICE_ID = "srv-d6b4fdpr0fns73fe75bg"

if not RENDER_API_KEY:
    print("Error: RENDER_API_KEY not found in backend/.env")
    exit(1)

# Variables to sync
VARS_TO_SYNC = [
    "TELEGRAM_BOT_TOKEN",
    "GROQ_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX",
    "TAVILY_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "BOT_WEBHOOK_SECRET"
]

headers = {
    "Authorization": f"Bearer {RENDER_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def update_env_var(key, value):
    url = f"https://api.render.com/v1/services/{SERVICE_ID}/env-vars/{key}"
    # The API expects just the value in a simple JSON or string? 
    # Actually, based on search, it expects a list for the bulk update or a specific body for single.
    # Let's use the bulk update if possible, or single if preferred.
    # Single update for /env-vars/{key} usually takes {"value": "..."} or similar.
    # Documentation says: PUT /services/{serviceId}/env-vars/{envVarKey}
    # Body: {"value": "..."}
    
    payload = {"value": value}
    try:
        response = httpx.put(url, headers=headers, json=payload)
        if response.status_code in [200, 201]:
            print(f"Successfully updated {key}")
        else:
            print(f"Failed to update {key}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Exception updating {key}: {e}")

def main():
    print(f"Starting environment variable sync for service {SERVICE_ID}...")
    for var in VARS_TO_SYNC:
        value = os.getenv(var)
        if value:
            update_env_var(var, value)
        else:
            print(f"Warning: {var} not found in local .env, skipping.")

if __name__ == "__main__":
    main()
