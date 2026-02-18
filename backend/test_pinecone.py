import logging
import time
import asyncio
from app.services.embeddings import get_embedding
from app.core.config import PINECONE_API_KEY

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_embedding():
    logger.info("Starting embedding test...")
    text = "Hello, world!"
    start = time.time()
    embedding = await get_embedding(text)
    duration = time.time() - start
    
    if embedding:
        logger.info(f"Successfully generated embedding. Length: {len(embedding)}")
        logger.info(f"Duration: {duration:.2f}s")
    else:
        logger.error("Failed to generate embedding.")

if __name__ == "__main__":
    asyncio.run(test_embedding())
