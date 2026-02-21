
import asyncio
import os
import sys

# Add backend to path for imports
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.groq import transcribe_audio

async def test_transcription():
    sample_path = "backend/tests/sample_speech.ogg"
    if not os.path.exists(sample_path):
        print(f"Sample file not found at {sample_path}")
        return

    print(f"Reading sample file: {sample_path}")
    with open(sample_path, "rb") as f:
        audio_bytes = f.read()

    print(f"Testing transcription with Groq Whisper (multilingual)...")
    text = await transcribe_audio(audio_bytes, filename="sample.mp3")
    
    if text:
        print(f"\nSUCCESS! Transcribed text: \n\"{text}\"")
    else:
        print("\nFAILED: Transcription returned None.")

if __name__ == "__main__":
    asyncio.run(test_transcription())
