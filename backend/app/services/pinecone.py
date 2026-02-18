from pinecone import Pinecone
from app.core.config import PINECONE_API_KEY, PINECONE_INDEX
import time
import logging

logger = logging.getLogger(__name__)

pc = Pinecone(api_key=PINECONE_API_KEY)

import asyncio

def get_index():
    """Lazily get the Pinecone index."""
    return pc.Index(PINECONE_INDEX)


async def save_memory(user_id: str, text: str, role: str, vector: list[float]):
    try:
        index = get_index()
        memory_id = f"{int(time.time())}-{role}"
        
        # index.upsert is synchronous, wrap in to_thread
        await asyncio.to_thread(
            index.upsert,
            vectors=[
                {
                    "id": memory_id,
                    "values": vector,
                    "metadata": {
                        "text": text,
                        "role": role,
                        "created_at": int(time.time())
                    }
                }
            ],
            namespace=str(user_id)
        )
        return True
    except Exception as e:
        logger.error(f"Error saving to Pinecone: {e}")
        return False


async def get_recent_memories(user_id: str, vector: list[float], top_k: int = 5):
    try:
        index = get_index()
        
        # index.query is synchronous, wrap in to_thread
        results = await asyncio.to_thread(
            index.query,
            namespace=str(user_id),
            vector=vector,
            top_k=top_k,
            include_metadata=True
        )
        
        memories = []
        for match in results.matches:
            if match.metadata:
                memories.append({
                    "text": match.metadata.get("text"),
                    "role": match.metadata.get("role"),
                    "created_at": match.metadata.get("created_at")
                })
        
        return memories
    except Exception as e:
        logger.error(f"Error querying Pinecone: {e}")
        return []
