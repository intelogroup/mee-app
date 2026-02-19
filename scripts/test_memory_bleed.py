
import requests
import json
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="backend/.env")
SECRET = os.getenv("BOT_WEBHOOK_SECRET")
WEBHOOK_URL = "http://localhost:8000/api/telegram/webhook"

HEADERS = {
    "Content-Type": "application/json",
    "X-Telegram-Bot-Api-Secret-Token": SECRET
}

def send_message(user_id, text, msg_id):
    payload = {
        "update_id": msg_id,
        "message": {
            "message_id": msg_id,
            "from": {"id": user_id, "is_bot": False, "first_name": "User", "username": f"User{user_id}"},
            "chat": {"id": user_id, "type": "private"},
            "date": int(time.time()),
            "text": text
        }
    }
    response = requests.post(WEBHOOK_URL, headers=HEADERS, json=payload)
    print(f"Sent: '{text}' from {user_id}. Status: {response.status_code}")
    return response

# 1. User 1 (Jim) plants a memory
print("--- Step 1: User 1 plants a memory ---")
send_message(8538224711, "I have a huge fear of dogs.", 5001)
time.sleep(5) # Wait for processing

# 2. User 2 (New) asks a question
print("\n--- Step 2: User 2 asks a question ---")
# User ID 999999999 triggers the mock profile "user-2-uuid"
send_message(999999999, "What do you know about my fears?", 5002)

print("\n--- Test Complete. Check logs for User 2's response. ---")
