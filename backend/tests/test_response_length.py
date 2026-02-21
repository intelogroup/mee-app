
import asyncio
import os
import sys
import pytest

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.guardrails import validate_response

@pytest.mark.asyncio
async def test_response_length_guardrails():
    print("--- Testing Response Length Guardrails ---")

    # Test 1: Default length (1 sentence)
    long_resp = "This is the first sentence. This is the second sentence. This is the third sentence."
    val1 = await validate_response(long_resp, {"max_sentences": 1})
    print(f"Step 1 (Default 1 sentence): {val1.cleaned_text}")
    sentences1 = val1.cleaned_text.strip().split('.')
    # Split might leave an empty string if it ends with a dot
    sentences1 = [s for s in sentences1 if s.strip()]
    assert len(sentences1) == 1
    print("Step 1: PASS")

    # Test 2: Extended length for plans/explanations (e.g., 10 sentences)
    # 5 sentences
    medium_resp = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five."
    val2 = await validate_response(medium_resp, {"max_sentences": 10})
    print(f"Step 2 (Extended 10 sentences): {val2.cleaned_text}")
    sentences2 = val2.cleaned_text.strip().split('.')
    sentences2 = [s for s in sentences2 if s.strip()]
    assert len(sentences2) == 5
    print("Step 2: PASS")

    # Test 3: Truncation at 10 sentences
    very_long_resp = ". ".join([f"Sentence {i}" for i in range(1, 15)]) + "."
    val3 = await validate_response(very_long_resp, {"max_sentences": 10})
    print(f"Step 3 (Truncation at 10): {val3.cleaned_text}")
    sentences3 = val3.cleaned_text.strip().split('.')
    sentences3 = [s for s in sentences3 if s.strip()]
    assert len(sentences3) == 10
    print("Step 3: PASS")

@pytest.mark.asyncio
async def test_keyword_logic():
    print("\n--- Testing Keyword Logic (max_sentences calculation) ---")
    
    def get_max_sentences(text):
        is_long_needed = any(word in text.lower() for word in ["plan", "explain", "detail", "strategy", "how", "why"])
        return 10 if is_long_needed else 1

    assert get_max_sentences("Hey bro") == 1
    assert get_max_sentences("Give me a plan") == 10
    assert get_max_sentences("Why is that?") == 10
    assert get_max_sentences("Explain yourself") == 10
    assert get_max_sentences("Just a normal chat") == 1
    print("Keyword Logic: PASS")


@pytest.mark.asyncio
async def test_groq_client_without_key(monkeypatch):
    """Ensure that the groq client path handles a missing API key gracefully.

    Previously the module would attempt to instantiate ``AsyncGroq`` during
    import, causing the entire application to crash if the environment
    variable was unset.  With the new lazy initialization we expect the
    import to succeed and the helper functions to return a harmless error
    string rather than blowing up.
    """

    import app.services.groq as groq_mod

    # Reset the cached client to force re-initialization
    groq_mod._client = None
    
    # simulate a missing environment variable by clearing the value used
    # by our config module; the library caches it at import time so we need
    # to update the attribute directly.
    monkeypatch.setattr(groq_mod, "GROQ_API_KEY", "")

    result = await groq_mod.get_groq_response([{"role": "system", "content": "hi"}])
    # the helper returns the generic failure message on error
    assert "trouble" in result.lower() or "sorry" in result.lower()
    print("Groq missing key handling: PASS")

if __name__ == "__main__":
    asyncio.run(test_response_length_guardrails())
    asyncio.run(test_keyword_logic())
    # run groq client behaviour test last since it may print error logs
    asyncio.run(test_groq_client_without_key(__import__('pytest').MonkeyPatch()))
