
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env
load_dotenv("backend/.env")

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.groq import get_groq_response

async def test_agent_decision():
    print("--- Testing Agentic Search Decision ---")
    
    test_cases = [
        "What is the weather in London?",
        "Tell me a joke.",
        "Who won the Super Bowl last month?",
        "How are you doing today?",
        "What are the top news headlines right now?"
    ]
    
    search_decision_prompt = """
    Does this message require real-time web information (e.g., local events, current weather, specific locations, news)?
    If YES, output only a short search query.
    If NO, output exactly "NONE".
    """
    
    for text in test_cases:
        print(f"\nUser: {text}")
        messages = [
            {"role": "system", "content": search_decision_prompt},
            {"role": "user", "content": text}
        ]
        decision = await get_groq_response(messages)
        print(f"Decision: {decision.strip()}")

if __name__ == "__main__":
    asyncio.run(test_agent_decision())
