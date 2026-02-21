import httpx
import logging
from app.core.config import TAVILY_API_KEY

logger = logging.getLogger(__name__)

async def search_web(query: str, search_depth: str = "basic") -> str:
    """
    Search the web using Tavily API.
    Returns a string summary of findings.
    """
    if not TAVILY_API_KEY:
        logger.error("TAVILY_API_KEY not configured")
        return ""

    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": search_depth,
        "include_answer": False,
        "max_results": 3
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("results", [])
            if not results:
                return "No relevant information found on the web."

            # Format results into a clean string for the LLM
            formatted = "\n".join([
                f"- {r['title']}: {r['content']} (Source: {r['url']})"
                for r in results
            ])
            return formatted

    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return "Failed to search the web."