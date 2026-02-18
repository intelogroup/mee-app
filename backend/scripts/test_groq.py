
import os
import sys
from dotenv import load_dotenv

# Add parent directory to path to import app services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

load_dotenv()

from app.services.groq import get_groq_response

def test_groq():
    print("Testing Groq AI connectivity...")
    messages = [
        {"role": "system", "content": "You are a test bot."},
        {"role": "user", "content": "Hello! Can you hear me?"}
    ]
    
    response = get_groq_response(messages)
    print(f"\nAI Response: {response}")
    
    if "Error" in response or "Sorry" in response:
        print("\n❌ Connectivity check failed or returned an error message.")
    else:
        print("\n✅ Connectivity check successful!")

if __name__ == "__main__":
    test_groq()
