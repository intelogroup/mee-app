
import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "mee-memory")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BOT_WEBHOOK_SECRET = os.getenv("BOT_WEBHOOK_SECRET")


if not all([TELEGRAM_BOT_TOKEN, GROQ_API_KEY, PINECONE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    print("WARNING: Some environment variables are missing.")
