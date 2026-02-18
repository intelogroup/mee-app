from app.services.pinecone import pc
import logging

logger = logging.getLogger(__name__)

import asyncio

async def get_embedding(text: str, input_type: str = "passage") -> list[float]:
    """
    Generates a vector embedding for the given text using Pinecone's hosted inference API.
    Uses asyncio.to_thread to run the sync Pinecone call without blocking.
    Includes 3 retries for handling cold-starts or transient timeouts.
    """
    if not text.strip():
        return []

    for attempt in range(3):
        try:
            logger.info(f"Generating embedding ({input_type}) - Attempt {attempt + 1}")
            
            results = await asyncio.to_thread(
                pc.inference.embed,
                model="multilingual-e5-large",
                inputs=[text],
                parameters={"input_type": input_type}
            )
            
            if results and len(results) > 0:
                return results[0].values
            return []
            
        except Exception as e:
            logger.warning(f"Embedding attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                logger.error(f"Failed to generate embedding after 3 attempts: {e}")
                return []
            # Exponential backoff: 0.5s, 1s
            await asyncio.sleep(0.5 * (attempt + 1))
    
    return []
