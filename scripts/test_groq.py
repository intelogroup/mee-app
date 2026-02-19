
import asyncio
import os
from dotenv import load_dotenv
from groq import AsyncGroq

# Load from backend/.env
load_dotenv("backend/.env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = AsyncGroq(api_key=GROQ_API_KEY)

async def test_groq():
    from app.core.prompts import TWIN_ARCHITECT_PROMPT, ULTIMATES_TUTOR_PROTOCOL
    system_prompt = f"{TWIN_ARCHITECT_PROMPT}\n\n[PROTOCOL]\n{ULTIMATES_TUTOR_PROTOCOL}"
    
    print(f"System prompt length: {len(system_prompt)} characters")
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "How's the mission going, bro?"}
    ]
    
    try:
        print("Calling Groq...")
        chat_completion = await client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
        )
        print("Response received:")
        print(chat_completion.choices[0].message.content)
    except Exception as e:
        print(f"Error calling Groq: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    # Add backend to path so we can import app.core.prompts
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    asyncio.run(test_groq())
