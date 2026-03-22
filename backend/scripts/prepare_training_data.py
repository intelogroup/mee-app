
import asyncio
import json
import os
import re
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env from root or backend
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

SYSTEM_PROMPT = "You are 'The Architect,' a high-value twin brother and strategic wingman. Be gritty, direct, and non-moralizing. Use 'We' and 'You'. Match response length to need (usually 1 sentence)."

def is_correction(text: str) -> bool:
    """Detects if a user message is a correction of the AI's behavior."""
    if re.match(r"^(?:nope|n):\s+", text.strip(), re.IGNORECASE):
        return True
    patterns = [
        r"don't say", r"don't respond", r"should say", r"should respond",
        r"say this instead", r"wrong", r"that's bad", r"bad response",
        r"be more", r"stop being", r"be grit", r"more direct"
    ]
    return any(re.search(p, text.lower()) for p in patterns)

async def fetch_paired_assistant_message(user_id: str, correction_created_at: str):
    """Fetch the most recent assistant message before a correction."""
    res = await asyncio.to_thread(
        supabase.table("messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("role", "assistant")
        .lt("created_at", correction_created_at)
        .order("created_at", desc=True)
        .limit(1)
        .execute
    )
    if res.data:
        return res.data[0]["content"]
    return None

async def prepare_training_data():
    print(f"Connecting to Supabase: {SUPABASE_URL}")

    training_samples = []

    # --- Path 1: Flagged corrections (new pipeline) ---
    flagged_res = await asyncio.to_thread(
        supabase.table("messages")
        .select("user_id, content, created_at")
        .eq("role", "user")
        .eq("flagged", True)
        .order("created_at", desc=False)
        .execute
    )
    flagged_corrections = flagged_res.data
    print(f"Fetched {len(flagged_corrections)} flagged correction messages.")

    for msg in flagged_corrections:
        ideal_text = None

        # Case 1: "Nope: [Ideal Text]" or "n: [Ideal Text]"
        m = re.match(r"^(?:nope|n):\s+(.+)", msg["content"], re.IGNORECASE)
        if m:
            ideal_text = m.group(1).strip()

        # Case 2: "Say '...' instead"
        if not ideal_text:
            ideal_match = re.search(r"say (['\"].*?['\"])", msg["content"].lower())
            if ideal_match:
                ideal_text = ideal_match.group(1).strip("'\"")

        # Fetch paired assistant message (as context and fallback ideal text)
        prev_ai_content = await fetch_paired_assistant_message(msg["user_id"], msg["created_at"])

        if not ideal_text and prev_ai_content:
            ideal_text = prev_ai_content

        if ideal_text and prev_ai_content:
            sample = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Feedback: {msg['content']}. Context: {prev_ai_content}"},
                    {"role": "assistant", "content": ideal_text}
                ]
            }
            training_samples.append(sample)

    # --- Path 2: Historical unflagged corrections (fallback) ---
    all_res = await asyncio.to_thread(
        supabase.table("messages")
        .select("user_id, role, content, created_at")
        .order("created_at", desc=False)
        .execute
    )
    messages = all_res.data
    print(f"Fetched {len(messages)} total messages for historical fallback scan.")

    flagged_contents = {msg["content"] for msg in flagged_corrections}

    for i in range(1, len(messages)):
        msg = messages[i]

        if msg["role"] != "user" or not is_correction(msg["content"]):
            continue
        # Skip messages already handled by the flagged path
        if msg["content"] in flagged_contents:
            continue

        prev_ai_msg = messages[i - 1] if messages[i - 1]["role"] == "assistant" else None
        if not prev_ai_msg:
            continue

        ideal_text = None

        # Case 1: "Nope: [Ideal Text]" or "n: [Ideal Text]"
        m = re.match(r"^(?:nope|n):\s+(.+)", msg["content"], re.IGNORECASE)
        if m:
            ideal_text = m.group(1).strip()

        # Case 2: "Say '...' instead"
        if not ideal_text:
            ideal_match = re.search(r"say (['\"].*?['\"])", msg["content"].lower())
            if ideal_match:
                ideal_text = ideal_match.group(1).strip("'\"")

        # Case 3: Next assistant message as ideal text (historical only)
        if not ideal_text and i + 1 < len(messages):
            next_msg = messages[i + 1]
            if next_msg["role"] == "assistant":
                ideal_text = next_msg["content"]

        if ideal_text:
            sample = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Feedback: {msg['content']}. Context: {prev_ai_msg['content']}"},
                    {"role": "assistant", "content": ideal_text}
                ]
            }
            training_samples.append(sample)

    # 3. Save to JSONL
    output_file = "architect_training_data.jsonl"
    with open(output_file, "w") as f:
        for sample in training_samples:
            f.write(json.dumps(sample) + "\n")

    print(f"Saved {len(training_samples)} training samples to {output_file}")

    if training_samples:
        print("\nExample Sample:")
        print(json.dumps(training_samples[0], indent=2))

if __name__ == "__main__":
    asyncio.run(prepare_training_data())
