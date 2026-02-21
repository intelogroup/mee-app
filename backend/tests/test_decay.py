
import asyncio
import os
import sys
import pytest

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.prompts import get_active_protocol_fragment, PROTOCOL_PILLARS
from app.core.guardrails import validate_response

@pytest.mark.asyncio
async def test_decay_logic():
    print("--- Testing Conversational Decay Logic ---")

    # Mocking the is_short detection logic from telegram.py
    def is_short(t):
        t_clean = t.lower().strip(",.!?")
        return len(t_clean.split()) <= 2 or any(k in t_clean for k in ["yep", "yup", "yeah", "ok", "oke", "see", "sure", "true", "right"])

    # Test 1: Detection triggers
    assert is_short("Yep") == True
    assert is_short("Sounds good to me") == False
    assert is_short("Yeah.") == True
    print("Step 1 (Detection): PASS")

    # Test 2: Guardrail question dropping
    # When allow_questions=False, guardrail should strip anything after a '?'
    resp = "That's right. What are you doing?"
    val = await validate_response(resp, {"allow_questions": False})
    print(f"Step 2 (Question Stripping): {val.cleaned_text}")
    assert "?" not in val.cleaned_text
    print("Step 2: PASS")

    # Test 3: Prompt Injection for Decay
    # Simulated check of Pillar inclusion
    text = "yep"
    fragment = get_active_protocol_fragment(text)
    # Since 'yep' is in decay triggers
    assert "PILLAR: CONVERSATIONAL DECAY" in fragment
    print("Step 3 (Pillar Injection): PASS")

if __name__ == "__main__":
    asyncio.run(test_decay_logic())
