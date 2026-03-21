
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BOT_WEBHOOK_SECRET = os.getenv("BOT_WEBHOOK_SECRET")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
CRON_SECRET = os.getenv("CRON_SECRET")


if not all([TELEGRAM_BOT_TOKEN, GROQ_API_KEY, PINECONE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    logger.warning("Some environment variables are missing.")

if not CRON_SECRET:
    logger.warning("CRON_SECRET is not set. Cron endpoints will reject all requests.")
