# Mee App — Claude Context

## Scope
Read `scope.md` before any task. Do not touch out-of-scope files or features.
If a requested change conflicts with scope.md, say so and stop.

## Stack
- Next.js (frontend), FastAPI (backend, Python)
- Supabase (auth + storage)
- Groq SDK (LLM inference), OpenAI SDK (embeddings)
- Pinecone (vector DB), grammy (Telegram bot)
- Render deployment (render.yaml)

## Key Constraints
- Telegram webhook must validate secret token before processing
- LLM calls must not log message content (PII/coaching conversations)
- Pinecone namespace per user — do not mix user vectors
- Supabase RLS must be respected — never bypass with service role key in user-facing routes

## Test Requirement
Run `npm test` (frontend) and `pytest` (backend) after any change.
No new failures allowed.
