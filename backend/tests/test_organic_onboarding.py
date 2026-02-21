
import asyncio
import os
import sys
import pytest

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.groq import get_groq_response
from app.core.prompts import TWIN_ARCHITECT_PROMPT, PROTOCOL_PILLARS, get_active_protocol_fragment

@pytest.mark.asyncio
async def test_simulate_organic_onboarding():
    print("--- Simulating Organic Onboarding Flow ---")
    
    user_text = "hello ima ask to help me with a woman i get a date tonight"
    
    # 1. Logic from telegram.py (Simplified)
    onboarding_pillar = PROTOCOL_PILLARS["onboarding"]
    active_protocol = get_active_protocol_fragment(user_text)
    
    system_prompt = f"""{TWIN_ARCHITECT_PROMPT}

{active_protocol}
{onboarding_pillar}

[CONTEXT]
User Traits: None yet.
Memories: Clean slate.
"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_text}
    ]
    
    print(f"System Prompt Length: {len(system_prompt)}")
    print("Calling Groq...")
    
    response = await get_groq_response(messages)
    
    print("\n--- AI RESPONSE ---")
    print(response)
    print("-------------------\n")
    
    # Verification criteria
    # 1. Does it mention the date/woman?
    # 2. Does it ask a follow-up question?
    
    has_advice = any(word in response.lower() for word in ["date", "woman", "her", "tonight", "lead"])
    has_question = "?" in response
    
    if has_advice and has_question:
        print("Verification: PASS (Advice given + Question asked)")
    else:
        print(f"Verification: FAIL (Advice: {has_advice}, Question: {has_question})")

if __name__ == "__main__":
    asyncio.run(simulate_organic_onboarding())
