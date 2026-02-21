
import os
"""Helper wrappers around the Groq client.

We previously created a module-level ``AsyncGroq`` instance which
would attempt to resolve ``GROQ_API_KEY`` during import time.  That
meant that if the environment variable was missing the entire backend
would fail to start (see traceback logged from the Render deploy).

Instead we now lazily construct the client the first time it's needed
and raise a clearer error if the key is missing.  This keeps imports
safe and gives calling code a chance to recover or log a friendlier
message.
"""

from groq import AsyncGroq
from app.core.config import GROQ_API_KEY

# The client is created on demand so that importing this module doesn't
# blow up when the environment isn't configured yet.  This happens in
# tests, in deployment health checks, etc.
_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        if not GROQ_API_KEY:
            # raise a runtime error rather than letting groq.GroqError bubble
            # up during import.  callers can catch and handle this if they
            # want to provide a fallback response.
            raise RuntimeError(
                "GROQ_API_KEY environment variable is not set; cannot create Groq client"
            )
        _client = AsyncGroq(api_key=GROQ_API_KEY)
    return _client

async def get_groq_response(messages, model="llama-3.3-70b-versatile"):
    try:
        client = _get_client()
        chat_completion = await client.chat.completions.create(
            messages=messages,
            model=model,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        import traceback
        print(f"Error calling Groq: {e}")
        traceback.print_exc()
        return "Sorry, I'm having trouble thinking right now."

async def extract_traits(text: str, model="llama-3.3-70b-versatile"):
    """
    Extracts a concrete, specific fact about the user.
    Returns a dict with 'trait' and 'category' or None if no fact found.
    """
    system_prompt = """
    Extract ONE concrete, specific, and permanent fact about this user that is true TODAY.

    RULES:
    1. For locations: Output only current permanent residence (e.g., "Lives in [City Name]").
    2. IGNORE future plans: Do not extract "moving to", "planning to", or "next month". 
    3. IGNORE temporary stays: Do not extract vacations or short trips.
    4. For relationships: Output only "[Relationship Type]: [Person]".
    5. For goals: Output only "Goal: [Specific Action]".
    6. NO descriptive adjectives or soft verbs (feels, likes, enjoys).
    7. If the fact is future-tense, temporary, or not concrete, return exactly "NULL".

    Return JSON only: {"trait": "...", "category": "location|personality|goal|relationship"}
    """
    
    try:
        client = _get_client()
        chat_completion = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            model=model,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        import json
        res = json.loads(chat_completion.choices[0].message.content)
        
        if not res.get("trait") or res["trait"] == "NULL":
            return None
            
        return res
    except Exception as e:
        print(f"Error extracting traits: {e}")
        return None
