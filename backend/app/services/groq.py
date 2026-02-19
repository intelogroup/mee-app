
import os
from groq import AsyncGroq
from app.core.config import GROQ_API_KEY

client = AsyncGroq(api_key=GROQ_API_KEY)

async def get_groq_response(messages, model="llama-3.3-70b-versatile"):
    try:
        chat_completion = await client.chat.completions.create(
            messages=messages,
            model=model,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Error calling Groq: {e}")
        return "Sorry, I'm having trouble thinking right now."

async def extract_traits(text: str, model="llama-3.3-70b-versatile"):
    """
    Extracts a permanent personality trait or social pattern from text.
    Returns None if no significant trait is found.
    """
    system_prompt = """
    You are an expert psychologist. Your task is to extract ONE permanent personality trait 
    or recurring social pattern from the user's message.
    
    RULES:
    1. Output MUST be 10 words or less.
    2. Output must be a factual statement about the user (e.g., "Has a fear of dogs", "Feels anxious in groups").
    3. If the message is trivial (e.g., "Hello", "Thanks"), output exactly "NULL".
    4. Do not output anything else. No quotes, no preamble.
    """
    
    try:
        chat_completion = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            model=model,
            temperature=0.1 # Keep it deterministic
        )
        trait = chat_completion.choices[0].message.content.strip()
        
        if trait == "NULL" or len(trait) < 3:
            return None
            
        return trait
    except Exception as e:
        print(f"Error extracting traits: {e}")
        return None
