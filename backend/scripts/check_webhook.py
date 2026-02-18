
import os
import requests
import urllib3
from dotenv import load_dotenv

# Disable warnings for insecure requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def check_webhook():
    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"
    
    print(f"Checking webhook status...")
    try:
        # Disable SSL verification to bypass local issuer issues
        response = requests.get(api_url, verify=False)
        
        if response.status_code == 200:
            print("✅ Webhook Info:")
            print(response.json())
        else:
            print(f"❌ Failed to get webhook info. Status: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Exception occurred: {e}")

if __name__ == "__main__":
    check_webhook()
