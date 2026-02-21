
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.guardrails import validate_response

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

if __name__ == "__main__":
    asyncio.run(test_response_length_guardrails())
    asyncio.run(test_keyword_logic())
