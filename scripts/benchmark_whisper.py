import asyncio
import os
import time
import statistics
from groq import AsyncGroq
from dotenv import load_dotenv

# Load env vars
load_dotenv(dotenv_path="backend/.env")

API_KEY = os.getenv("GROQ_API_KEY")
AUDIO_FILE = "backend/tests/sample_speech.ogg"

if not API_KEY:
    print("Error: GROQ_API_KEY not found.")
    exit(1)

client = AsyncGroq(api_key=API_KEY)

async def benchmark_model(model_name, iterations=5):
    print(f"\n--- Benchmarking: {model_name} ---")
    latencies = []
    
    # Read file once
    with open(AUDIO_FILE, "rb") as f:
        file_bytes = f.read()

    for i in range(iterations):
        start = time.perf_counter()
        try:
            # Groq requires a file-like object with a name
            import io
            buffer = io.BytesIO(file_bytes)
            buffer.name = "benchmark.ogg"
            
            completion = await client.audio.transcriptions.create(
                file=buffer,
                model=model_name,
                response_format="json"
            )
            text = completion.text
            
            end = time.perf_counter()
            latency = (end - start) * 1000 # ms
            latencies.append(latency)
            print(f"  Iter {i+1}: {latency:.2f}ms")
            
            if i == 0:
                print(f"  Result: \"{text[:60]}...\"")
                
        except Exception as e:
            print(f"  Iter {i+1}: Failed - {e}")

    if latencies:
        avg = statistics.mean(latencies)
        print(f"  >> Average Latency: {avg:.2f}ms")
    return latencies

async def run_benchmarks():
    print(f"Using Audio File: {AUDIO_FILE}")
    
    # 1. Distil Whisper (Current)
    await benchmark_model("distil-whisper-large-v3-en")
    
    # 2. Whisper Large V3 Turbo (New Candidate)
    await benchmark_model("whisper-large-v3-turbo")

if __name__ == "__main__":
    asyncio.run(run_benchmarks())
