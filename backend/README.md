
# Mee App Bot Backend

FastAPI service for handling Telegram Bot webhooks, Groq AI responses, and Pinecone memory.

## Setup

1.  **Install Dependencies**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **Environment Variables**:
    Ensure your `.env` (or system env) has:
    - `TELEGRAM_BOT_TOKEN`
    - `GROQ_API_KEY`
    - `PINECONE_API_KEY`
    - `PINECONE_INDEX`
    - `OPENAI_API_KEY` (for embeddings)
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_KEY`
    - `BOT_WEBHOOK_SECRET` (optional but recommended)

3.  **Run Locally**:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```

## API Endpoints

-   `POST /api/telegram/webhook`: The webhook endpoint for Telegram.
-   `GET /health`: Health check.

## Testing

1.  Start the server.
2.  Use `curl` or Postman to simulate a webhook:
    ```bash
    curl -X POST http://localhost:8000/api/telegram/webhook \
         -H "Content-Type: application/json" \
         -d '{"update_id": 1, "message": {"message_id": 1, "chat": {"id": 12345}, "from": {"id": 12345, "username": "testuser"}, "text": "Hello bot"}}'
    ```
