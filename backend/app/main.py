import logging
import os
from fastapi import FastAPI
from app.routers import telegram
from app.services.embeddings import get_embedding
from dotenv import load_dotenv

load_dotenv()

# Configure logging centrally
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("telegram_bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mee App Bot Backend")

app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])

@app.on_event("startup")
async def warmup():
    logger.info("Warming up embedding model...")
    try:
        await get_embedding("warmup", input_type="query")
        logger.info("Embedding model warmed up")
    except Exception as e:
        logger.error(f"Warmup failed: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok"}
