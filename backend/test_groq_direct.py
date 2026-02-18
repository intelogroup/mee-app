
import sys
import os

# Add the project root to sys.path
sys.path.append("/Users/kalinovdameus/Developer/mee-app/backend")

from app.services.groq import get_groq_response

def test_groq():
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello world in a creative way."}
    ]
    print("Sending request to Groq...")
    response = get_groq_response(messages)
    print(f"Groq Response: {response}")

if __name__ == "__main__":
    test_groq()
