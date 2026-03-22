# Mee App — Agent Scope

## In-Scope (agent may fix)
- Security: unprotected API routes, missing auth, env vars leaking in logs
- Bug fixes with test evidence
- Coaching conversation flow (Groq LLM inference, context management)
- Telegram bot handler logic (grammy)
- Pinecone vector search and embedding pipeline
- Supabase auth and storage
- FastAPI backend: coaching endpoints, bot webhook
- TypeScript and Python type errors
- Dead code removal
- Training data pipeline (`prepare_training_data.py`) and correction flagging (`flagged` column, nope-detection handler)

## Out-of-Scope (agent must NOT touch)
- Adding non-coaching AI use cases (image gen, code assistants, etc.)
- Adding new messaging platforms beyond Telegram
- Payment or subscription billing features
- Analytics dashboards or admin reporting UI
- Changing the LLM provider from Groq without owner approval
- Files with uncommitted user changes (check git status first)

## Test Requirement
Run `npm test` (frontend) and `pytest` (backend) after any change.
No new failures allowed.
