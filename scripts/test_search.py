
import asyncio
import os
import sys
from dotenv import load_dotenv

# Try to load env from root .env first
load_dotenv()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.services.search as search_service

async def test():
    # If it's not set in search_service (due to early import), force it here
    if not search_service.TAVILY_API_KEY:
        search_service.TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
    
    print(f"Testing Tavily Search (Key prefix: {search_service.TAVILY_API_KEY[:5] if search_service.TAVILY_API_KEY else 'None'})...")
    
    res = await search_service.search_web("What is the weather in Manchester today?")
    
    if "Failed" in res or "not configured" in res:
        print(f"\nError: {res}")
    else:
        print("\nResults found (sample):")
        print(res[:300] + "...")

if __name__ == "__main__":
    asyncio.run(test())
