
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
from app.core.config import TELEGRAM_BOT_TOKEN, BOT_WEBHOOK_SECRET
from app.services.groq import get_groq_response
from app.services.pinecone import save_memory, get_recent_memories, pc, PINECONE_INDEX # accessing embedding logic directly or via service
from app.services.supabase import link_telegram_account, get_user_by_telegram_id, increment_message_count, supabase
from app.services.embeddings import get_embedding
import os

router = APIRouter()

import logging
import httpx
import requests
import asyncio
import subprocess
import json

logger = logging.getLogger(__name__)

# Helper to send message
async def send_telegram_message(chat_id: int, text: str):
    logger.info(f"Sending message to chat_id {chat_id}: {text[:50]}...")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    
    try:
        # Nuclear option: Use curl via subprocess because Python's SSL is being blocked by local proxy
        # This is a dev-environment hack to bypass SSLV3_ALERT_HANDSHAKE_FAILURE
        cmd = [
            "curl", "-s", "-k", "-X", "POST", url,
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload)
        ]
        
        process = await asyncio.to_thread(
            subprocess.run, cmd, capture_output=True, text=True
        )
        
        if process.returncode == 0:
             logger.info(f"Successfully sent message to {chat_id} (via curl)")
        else:
             logger.error(f"Failed to send via curl: {process.stderr}")

    except Exception as e:
        logger.error(f"Failed to send message to {chat_id}: {e}")

async def process_telegram_update(update: dict):
    try:
        message = update.get("message")
        if not message:
            return

        chat_id = message.get("chat", {}).get("id")
        text = message.get("text")
        username = message.get("from", {}).get("username", "User")
        telegram_user_id = str(message.get("from", {}).get("id"))

        if not text:
            return

        logger.info(f"Processing update for chat_id {chat_id}, text: {text}")

        # 1. Handle /start <token> linking
        if text.startswith("/start"):
            logger.info(f"Linking attempt for chat_id {chat_id}")
            parts = text.split(" ")
            if len(parts) > 1:
                token = parts[1]
                success, msg = await link_telegram_account(token, telegram_user_id)
                await send_telegram_message(chat_id, msg)
                if success:
                     await send_telegram_message(chat_id, "You can now chat with me!")
                return
            else:
                await send_telegram_message(chat_id, "Welcome! Link your account via the commands on the dashboard.")
                return

        # 2. Parallel: Check Profile + Get Embedding for Retrieval
        # This saves ~400ms by running I/O tasks simultaneously
        logger.info(f"Parallelizing profile fetch and embedding for {telegram_user_id}")
        user_profile_task = get_user_by_telegram_id(telegram_user_id)
        embedding_task = get_embedding(text, input_type="query")
        
        user_profile, vector = await asyncio.gather(user_profile_task, embedding_task)

        if not user_profile:
            logger.warning(f"User {telegram_user_id} not linked (chat_id: {chat_id})")
            await send_telegram_message(chat_id, "Account not linked. Please use the link from your dashboard.")
            return

        # 3. Memory Retrieval
        user_id = user_profile.get("id")
        context_str = ""
        
        # Check interaction count first to avoid cold start on new users
        # Uses lightweight Supabase integer read instead of heavy Pinecone scan
        message_count = user_profile.get("message_count", 0)
        
        if vector and message_count > 3:
            memories = await get_recent_memories(user_id, vector)
            if memories:
                # Format memories: "User: text" or "Assistant: text"
                context_str = "\n".join([f"- {m['role'].capitalize()}: {m['text']}" for m in memories])
                logger.info(f"Retrieved {len(memories)} memories for context")
        else:
            logger.info(f"Skipping memory retrieval (New user: {message_count} messages)")

        # 4. Generate AI Response
        user_traits_list = user_profile.get("traits", [])
        user_traits = ", ".join(user_traits_list) if user_traits_list else "Still getting to know this user"
        
        system_prompt = f"""You are Mee, a sharp and playful social coach 
for introverts who want to thrive socially without faking it.

YOUR ROLE:
- Lead with a specific, actionable tip or insight
- Back it with a quick reason why it works (psychology, not fluff)
- Keep it grounded in the user's actual situation

YOUR TONE:
- Playful and witty — you make social anxiety feel less heavy
- Confident but never preachy
- Talk like a clever friend, not a self-help book

STRICT RULES:
- Never give generic advice like "just be yourself" or "practice makes perfect"
- Every tip must be specific to what the user just said
- Ask maximum ONE follow-up question per response
- Keep responses under 4 sentences unless explaining a technique
- No emojis unless the user uses them first
- Never mention other apps, tools, or therapists

CONTEXT:
User's known traits: {user_traits}
Recent memory: {context_str if context_str else "No recent memories yet."}
"""
        
        chat_history = [{"role": "system", "content": system_prompt}]
        chat_history.append({"role": "user", "content": text})

        logger.info(f"Calling Groq for user: {username}")
        response_text = await get_groq_response(chat_history)
        logger.info(f"Received Groq response: {response_text[:50]}...")

        # 5. Send Response
        logger.info(f"Sending response to chat_id {chat_id}")
        await send_telegram_message(chat_id, response_text)

        # 6. Save Memory (Async / Background)
        if vector:
            # We don't necessarily need to await these before the function finishes if we just want them saved
            # but for reliability in the background task loop, we await them here.
            await save_memory(user_id, text, "user", vector)
            resp_vector = await get_embedding(response_text, input_type="passage")
            if resp_vector:
                await save_memory(user_id, response_text, "assistant", resp_vector)
                logger.info("Saved chat interaction to Pinecone")
                
                # Increment message count for future optimization checks
                await increment_message_count(user_id)

    except Exception as e:
        logger.error(f"Error processing update: {e}", exc_info=True)


@router.post("/webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks, x_telegram_bot_api_secret_token: str = Header(None)):
    # 1. Validate Secret
    if BOT_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != BOT_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 2. Parse Update
    try:
        update = await request.json()
        logger.info(f"Incoming update: {update}")
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # 3. Process Async via Background Tasks
    background_tasks.add_task(process_telegram_update, update)

    return {"status": "ok"}
