
import asyncio
import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

@pytest.mark.asyncio
async def test_decay_trigger_threshold():
    print("--- Testing Decay Trigger Threshold (3 Consecutive Short Messages) ---")

    # We need to simulate the sliding window and the logic in telegram.py
    def is_short(t):
        t_clean = t.lower().strip(",.!?")
        return len(t_clean.split()) <= 2 or any(k in t_clean for k in ["yep", "yup", "yeah", "ok", "oke", "see", "sure", "true", "right"])

    def calculate_decay(text, user_history):
        consecutive_short = 0
        if is_short(text):
            consecutive_short = 1
            if user_history and is_short(user_history[-1]):
                consecutive_short = 2
                if len(user_history) > 1 and is_short(user_history[-2]):
                    consecutive_short = 3
        return consecutive_short

    # Scenario 1: 1 short message
    history1 = []
    text1 = "yep"
    level1 = calculate_decay(text1, history1)
    print(f"Level after 1 short: {level1}")
    assert level1 == 1
    assert level1 < 3 # Should NOT trigger

    # Scenario 2: 2 consecutive short messages
    history2 = ["yep"]
    text2 = "ok"
    level2 = calculate_decay(text2, history2)
    print(f"Level after 2 short: {level2}")
    assert level2 == 2
    assert level2 < 3 # Should NOT trigger (NEW REQUIREMENT)

    # Scenario 3: 3 consecutive short messages
    history3 = ["yep", "ok"]
    text3 = "sure"
    level3 = calculate_decay(text3, history3)
    print(f"Level after 3 short: {level3}")
    assert level3 == 3
    assert level3 >= 3 # SHOULD TRIGGER

    # Scenario 4: Interrupted short messages
    history4 = ["yep", "This is a long message"]
    text4 = "ok"
    level4 = calculate_decay(text4, history4)
    print(f"Level after interrupted flow: {level4}")
    assert level4 == 1
    assert level4 < 3 # Should NOT trigger

    print("\nTrigger Logic Verification: PASS")

if __name__ == "__main__":
    asyncio.run(test_decay_trigger_threshold())
