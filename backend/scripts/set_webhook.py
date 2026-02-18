
import os
import requests
import urllib3
from dotenv import load_dotenv

# Disable warnings for insecure requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BOT_WEBHOOK_SECRET = os.getenv("BOT_WEBHOOK_SECRET")

def set_webhook(url):
    webhook_url = f"{url}/api/telegram/webhook"
    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook"
    
    payload = {
        "url": webhook_url,
        "secret_token": BOT_WEBHOOK_SECRET
    }
    
    print(f"Setting webhook to: {webhook_url}")
    try:
        # Disable SSL verification to bypass local issuer issues
        response = requests.post(api_url, json=payload, verify=False)
        
        if response.status_code == 200:
            print("✅ Webhook set successfully!")
            print(response.json())
        else:
            print(f"❌ Failed to set webhook. Status: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Exception occurred: {e}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        set_webhook(sys.argv[1])
    else:
        print("Usage: python3 set_webhook.py <public_url>")
