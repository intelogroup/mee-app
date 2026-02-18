
import os
import requests
import urllib3
from dotenv import load_dotenv

# Disable warnings for insecure requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def verify_token():
    print(f"Verifying token: {TELEGRAM_BOT_TOKEN[:10]}...{TELEGRAM_BOT_TOKEN[-5:]}")
    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe"
    
    try:
        response = requests.get(api_url, verify=False)
        print(f"Response Status: {response.status_code}")
        print(response.json())
        
        if response.status_code == 200:
            print("✅ Token is VALID.")
        else:
            print("❌ Token is INVALID.")
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    verify_token()
