
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
from app.core.config import TELEGRAM_BOT_TOKEN, BOT_WEBHOOK_SECRET
from app.services.groq import get_groq_response, extract_traits, transcribe_audio
from app.services.search import search_web
from app.services.pinecone import save_memory, get_recent_memories, pc, PINECONE_INDEX # accessing embedding logic directly or via service
from app.services.supabase import (
    link_telegram_account, get_user_by_telegram_id, increment_message_count, 
    update_onboarding_step, supabase, log_message, get_stale_profiles
)
from app.services.embeddings import get_embedding
from app.services.memory import run_episodic_summarizer
from app.core.prompts import get_active_protocol_fragment, TWIN_ARCHITECT_PROMPT, PROTOCOL_PILLARS
from app.core.guardrails import validate_response

router = APIRouter()

import logging
import httpx
import asyncio
import json
import time
from datetime import datetime, timezone
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

# --- CRON ENDPOINT ---
@router.post("/cron/summarize")
async def trigger_summaries(background_tasks: BackgroundTasks, x_cron_secret: str = Header(None)):
    """
    Triggered by Supabase pg_cron every hour.
    Iterates through users who haven't been summarized recently and queues background tasks.
    """
    # Simple secret check (should be in env vars in prod)
    EXPECTED_SECRET = "mee-cron-secret-123" 
    if x_cron_secret != EXPECTED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Cron Access")

    stale_users = await get_stale_profiles()
    triggered_count = 0
    
    for user in stale_users:
        user_id = user.get("id")
        last_summary_at = user.get("last_summary_at")
        
        # Fallback for NULL last_summary_at (treat as epoch start)
        if not last_summary_at:
            last_summary_at = "1970-01-01T00:00:00+00:00"
            
        background_tasks.add_task(run_episodic_summarizer, user_id, last_summary_at)
        triggered_count += 1
        
    logger.info(f"[CRON] Triggered episodic summarizer for {triggered_count} users.")
    return {"status": "ok", "triggered": triggered_count}

@router.post("/cron/process-pings")
async def process_pings(background_tasks: BackgroundTasks, x_cron_secret: str = Header(None)):
    """
    Triggered by Supabase pg_cron (e.g., every 15 mins).
    Checks for pending 'scheduled_messages' that are due and sends them.
    """
    # Simple secret check
    EXPECTED_SECRET = "mee-cron-secret-123"
    if x_cron_secret != EXPECTED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Cron Access")

    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        
        # Fetch pending pings due for delivery
        # We need to join with profiles to get the telegram_chat_id
        res = await asyncio.to_thread(
            supabase.table("scheduled_messages")
            .select("*, profiles(telegram_chat_id)")
            .eq("status", "pending")
            .lte("scheduled_at", now)
            .execute
        )
        
        pings = res.data
        if not pings:
            return {"status": "ok", "processed": 0}

        processed_count = 0
        for ping in pings:
            chat_id = ping.get("profiles", {}).get("telegram_chat_id")
            if chat_id:
                # Send the ping
                message_text = f"🎗️ Memory Ping: {ping['content']}"
                await send_telegram_message(chat_id, message_text)
                
                # Mark as sent
                await asyncio.to_thread(
                     supabase.table("scheduled_messages").update({"status": "sent"}).eq("id", ping['id']).execute
                )
                processed_count += 1
            else:
                 # Mark failed (User has no linked telegram ID)
                 await asyncio.to_thread(
                     supabase.table("scheduled_messages").update({"status": "failed"}).eq("id", ping['id']).execute
                )
        
        logger.info(f"[CRON] Processed {processed_count} memory pings.")
        return {"status": "ok", "processed": processed_count}

    except Exception as e:
        logger.error(f"[CRON] Error processing pings: {e}")
        return {"status": "error", "detail": str(e)}

# In-memory sliding window for recent context (Privacy-safe, zero-latency)
# Stores the last 6 message objects per user
# Redeploy Trigger: Fix prompt imports
recent_context = defaultdict(lambda: deque(maxlen=6))

ONBOARDING_QUESTIONS = [
    "Hey! I'm Mee 👋 Quick one — what's the social situation you find most draining?",
    "Got it. And what would feel like a win for you — like what's the one social thing you wish came easier?",
    "Last one — are you more of a one-on-one person or do you actually like groups when the vibe is right?"
]

# Helper to send message
async def send_telegram_message(chat_id: int, text: str):
    logger.info(f"Sending message to chat_id {chat_id}: {text[:50]}...")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    
    try:
        # Proper async httpx call for production
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        logger.info(f"Successfully sent message to {chat_id}")
    except Exception as e:
        logger.error(f"Failed to send message to {chat_id}: {e}")

async def send_chat_action(chat_id: int, action: str = "typing"):
    """
    Sends a chat action (typing, upload_photo, etc.) to Telegram.
    This tells the user the bot is 'thinking'.
    """
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendChatAction"
    payload = {"chat_id": chat_id, "action": action}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=payload)
    except Exception as e:
        logger.warning(f"Failed to send chat action: {e}")

async def download_telegram_file(file_id: str) -> bytes:
    """
    Downloads a file from Telegram using its file_id.
    """
    try:
        # 1. Get file path from Telegram
        get_file_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(get_file_url, params={"file_id": file_id})
            resp.raise_for_status()
            file_data = resp.json()
            
            if not file_data.get("ok"):
                logger.error(f"Telegram getFile failed: {file_data}")
                return None
                
            file_path = file_data["result"]["file_path"]
            
            # 2. Download the actual file
            download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
            download_resp = await client.get(download_url)
            download_resp.raise_for_status()
            return download_resp.content
            
    except Exception as e:
        logger.error(f"Error downloading Telegram file: {e}")
        return None

async def process_telegram_update(update: dict, background_tasks: BackgroundTasks = None):
    try:
        message = update.get("message")
        if not message:
            return

        chat_id = message.get("chat", {}).get("id")
        text = message.get("text")
        voice = message.get("voice")
        username = message.get("from", {}).get("username", "User")
        telegram_user_id = str(message.get("from", {}).get("id"))

        if not text and not voice:
            return

        # UX: Show typing immediately
        await send_chat_action(chat_id, "typing")

        # HANDLE VOICE NOTES
        if voice:
            try:
                logger.info(f"Received voice note from {username} (file_id: {voice['file_id']})")
                # Notify user we are listening
                await send_chat_action(chat_id, "upload_voice")
                
                # Step A: Download
                audio_bytes = await download_telegram_file(voice["file_id"])
                if not audio_bytes:
                    await send_telegram_message(chat_id, "Sorry, I couldn't download your voice note.")
                    return
                
                # Step B: Transcribe (Use .ogg extension which is more universally recognized by Groq/Whisper)
                text = await transcribe_audio(audio_bytes, filename="voice.ogg")
                
                if not text:
                    await send_telegram_message(chat_id, "Sorry, I couldn't understand that audio.")
                    return
                    
                logger.info(f"Transcribed voice note: {text}")
                # We now treat 'text' as if it was typed, so the rest of the flow continues normally
            except Exception as e:
                logger.error(f"Error processing voice note: {e}", exc_info=True)
                await send_telegram_message(chat_id, "Something went wrong while listening to your voice note. Please try again.")
                return

        logger.info(f"Processing update for chat_id {chat_id}, text: {text}")

        # 1. Handle /start <token> linking
        if text.startswith("/start"):
            logger.info(f"Linking attempt for chat_id {chat_id}")
            parts = text.split(" ")
            if len(parts) > 1:
                token = parts[1]
                success, msg = await link_telegram_account(token, telegram_user_id)
                # If success, start onboarding immediately
                if success:
                     await send_telegram_message(chat_id, ONBOARDING_QUESTIONS[0])
                     await update_onboarding_step(token, 1)
                else:
                     await send_telegram_message(chat_id, msg)
                return
            else:
                await send_telegram_message(chat_id, "Welcome! Link your account via the dashboard to get started.")
                return

        # 2. Parallel: Check Profile + Get Embedding for Retrieval
        # This saves ~400ms by running I/O tasks simultaneously
        logger.info(f"Parallelizing profile fetch and embedding for {telegram_user_id}")
        user_profile_task = get_user_by_telegram_id(telegram_user_id)
        embedding_task = get_embedding(text, input_type="query")
        
        user_profile, vector = await asyncio.gather(user_profile_task, embedding_task)

        if not user_profile:
            logger.warning(f"User {telegram_user_id} not linked (chat_id: {chat_id})")
            await send_telegram_message(chat_id, "Wait, we haven't met properly. Link your account from the dashboard so I know who I'm talking to!")
            return

        # ONBOARDING FLOW
        user_id = user_profile.get("id")
        onboarding_step = user_profile.get("onboarding_step", 0)

        onboarding_pillar = ""
        if onboarding_step < 4:
            logger.info(f"User in organic onboarding stage (Step {onboarding_step})")
            onboarding_pillar = PROTOCOL_PILLARS["onboarding"]
            
            # Record traits if found in the user's message
            trait_obj = await extract_traits(text)
            if trait_obj and vector:
                trait_text = trait_obj["trait"]
                trait_category = trait_obj["category"]
                trait_vector = await get_embedding(trait_text, input_type="passage")
                if trait_vector:
                    await save_memory(user_id, trait_text, "trait", trait_vector, {"category": trait_category})
                    logger.info(f"Onboarding trait captured organically: {trait_text} ({trait_category})")
            
            # Increment step until 4 (where we consider "onboarding" complete)
            await update_onboarding_step(user_id, onboarding_step + 1)

        # 3. Memory Retrieval (Normal Flow)
        context_str = ""
        clarification_prompt = ""
        
        # Check interaction count first to avoid cold start on new users
        # Uses lightweight Supabase integer read instead of heavy Pinecone scan
        message_count = user_profile.get("message_count", 0)
        
        if vector and message_count > 3:
            # Parallel: Get memories + Check for pending clarifications in Pinecone
            index = pc.Index(PINECONE_INDEX)
            
            async def get_memories():
                return await get_recent_memories(user_id, vector)
                
            async def get_pending():
                try:
                    return await asyncio.to_thread(
                        index.query,
                        namespace=str(user_id),
                        vector=[0.1]*1024, # Dummy vector for metadata filter
                        top_k=1,
                        filter={"role": {"$eq": "pending_clarification"}},
                        include_metadata=True
                    )
                except Exception as e:
                    logger.error(f"Error checking pending clarifications: {e}")
                    return None

            memories_list, pending_res = await asyncio.gather(get_memories(), get_pending())

            if memories_list:
                context_str = "\n".join([f"- {m['role'].capitalize()}: {m['text']}" for m in memories_list])
                logger.info(f"Retrieved {len(memories_list)} memories for context")
            
            if pending_res and pending_res.matches:
                match = pending_res.matches[0]
                old = match.metadata.get("old_trait", "unknown")
                new = match.metadata.get("new_trait", "unknown")
                clarification_prompt = f"\n[CLARIFICATION NOTE]\nSlip this in naturally: 'Wait, did you move? I remember you said {old} before, but now you're saying {new} — which one is it?'\n"
                
                # Delete the clarification vector after retrieval (one-time use)
                await asyncio.to_thread(index.delete, ids=[match.id], namespace=str(user_id))
                logger.info(f"Retrieved and cleared pending clarification: {old} vs {new}")
        else:
            logger.info(f"Skipping memory retrieval (New user: {message_count} messages)")

        # 4. Generate AI Response
        user_traits_list = user_profile.get("traits", [])
        user_traits = ", ".join(user_traits_list) if user_traits_list else "None yet."
        
        # AGENTIC SEARCH DECISION (GATED)
        web_context = ""
        # Only run search decision if message is likely a question or specific query
        should_check_search = "?" in text or len(text.split()) > 3
        
        if should_check_search:
            search_decision_prompt = f"""
            User Message: "{text}"
            Analyze if this requires EXTERNAL search.
            
            RULES:
            1. Return {{"search": false, "query": null}} for:
               - General knowledge & History (e.g., "Nobel 2001", "Capital of France").
               - Coding, creative writing, or casual chat.
               - Facts known pre-2023.
               
            2. Return {{"search": true, "query": "..."}} for:
               - Real-time info (Weather, Stocks, Scores).
               - Events from 2024-2026.
               - Local events in a specific city.
            
            OUTPUT JSON ONLY. NO EXPLANATION.
            """
            response = await get_groq_response(
                [{"role": "system", "content": search_decision_prompt}], 
                model="llama-3.1-8b-instant",
                json_mode=True
            )
            
            try:
                import json
                # Clean response for potential markdown block
                clean_res = response.strip().replace("```json", "").replace("```", "").strip()
                res_data = json.loads(clean_res)
                search_query = res_data.get("query") if res_data.get("search") else "NONE"
            except Exception:
                search_query = "NONE" # Fallback
            
            if search_query and search_query.upper() != "NONE":
                logger.info(f"Mee decided to search the web for: {search_query}")
                search_results = await search_web(search_query)
                if search_results:
                    web_context = f"\n[LIVE WEB SEARCH RESULTS]\n{search_results}\n"
                    logger.info("Injected web context into response")
        else:
            logger.info("Skipping search decision (message too short or no question)")

        # --- DECAY DETECTION (Solution 1 & 2) ---
        user_history = [m["content"] for m in recent_context[user_id] if m["role"] == "user"]
        # Check current message + last user message in window
        consecutive_short = 0
        def is_short(t):
            t_clean = t.lower().strip(",.!?")
            return len(t_clean.split()) <= 2 or any(k in t_clean for k in ["yep", "yup", "yeah", "ok", "oke", "see", "sure", "true", "right"])

        if is_short(text):
            consecutive_short = 1
            if user_history and is_short(user_history[-1]):
                consecutive_short = 2
                # If we have a 3rd one in context, count it
                if len(user_history) > 1 and is_short(user_history[-2]):
                    consecutive_short = 3

        # Determine Active Protocol Fragment (Layer 1: Slimmed Injection)
        active_protocol = get_active_protocol_fragment(text)
        
        # Inject Decay Instructions if needed
        decay_note = ""
        allow_questions = True
        if consecutive_short >= 3:
            active_protocol += f"\n{PROTOCOL_PILLARS['decay']}"
            allow_questions = False
            # Just acknowledge and stop chasing. 
            decay_note = "\n[DECAY MODE]\nUser is fading. Match energy. 1-2 words max. NO questions. Respond with 'oke', 'got it', or similar and let it die naturally."

        logger.info(f"Decay Level: {consecutive_short}, allow_questions: {allow_questions}")
        logger.info(f"Injected Protocol Fragment: {active_protocol.split('### ')[1].split(' ')[0] if '### ' in active_protocol else 'Default'}")

        system_prompt = f"""{TWIN_ARCHITECT_PROMPT}

{active_protocol}
{onboarding_pillar}

[CONTEXT]
User Traits: {user_traits}
Memories: {context_str if context_str else "Clean slate."}
{web_context}
{clarification_prompt}
{decay_note}
"""
        
        # Build message history: System Prompt + Sliding Window + Current Input
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(list(recent_context[user_id]))
        messages.append({"role": "user", "content": text})

        logger.info(f"Calling Groq for user: {username} (System Prompt Len: {len(system_prompt)})")
        response_text = await get_groq_response(messages)
        
        # --- LAYER 2: IN-CODE GUARDRAILS ---
        is_long_needed = any(word in text.lower() for word in ["plan", "explain", "detail", "strategy", "how", "why"])
        max_sentences = 10 if is_long_needed else 1
        
        validation = await validate_response(response_text, {
            "user_text": text, 
            "allow_questions": allow_questions,
            "max_sentences": max_sentences
        })
        
        if not validation.is_valid:
            logger.warning(f"Guardrail Flag: {validation.reason}. Original: {response_text[:50]}...")
            if validation.reason == "Banned phrases detected.":
                # Automated Retry with stricter meta-prompt
                messages.append({"role": "assistant", "content": response_text})
                messages.append({"role": "system", "content": f"CRITICAL: You just used a banned phrase or corporate AI tone. STOP. Be gritty. Be {max_sentences} sentence(s). Use only 'We'."})
                response_text = await get_groq_response(messages)
                validation = await validate_response(response_text, {"max_sentences": max_sentences})
                response_text = validation.cleaned_text
            else:
                response_text = validation.cleaned_text
        else:
            response_text = validation.cleaned_text

        logger.info(f"Final Response Sent: {response_text[:50]}...")

        # 5. Send Response
        await send_telegram_message(chat_id, response_text)

        # 6. Post-Response Tasks (Async / Background)
        # 6a. Log to Supabase for Episodic Memory
        await log_message(user_id, "user", text)
        await log_message(user_id, "assistant", response_text)

        # 6b. Check for Episodic Summary Trigger (1hr threshold)
        last_summary_at = user_profile.get("last_summary_at")
        if last_summary_at:
            from datetime import datetime, timezone, timedelta
            last_ts = datetime.fromisoformat(last_summary_at.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - last_ts > timedelta(hours=1):
                # Trigger summarizer in background
                if background_tasks:
                    background_tasks.add_task(run_episodic_summarizer, user_id, last_summary_at)

        # Update in-memory sliding window
        recent_context[user_id].append({"role": "user", "content": text})
        recent_context[user_id].append({"role": "assistant", "content": response_text})
        
        # Increment message count first to check for trait extraction trigger
        # TRAIT EXTRACTION LOGIC (Trigger on every message for maximum responsiveness)
        # We NO LONGER save raw messages to Pinecone. Only distilled traits.
        logger.info("Triggering trait extraction...")
        trait_obj = await extract_traits(text)
        
        if trait_obj:
            trait_text = trait_obj["trait"]
            trait_category = trait_obj["category"]
            logger.info(f"Extracted trait: {trait_text} (Category: {trait_category})")
            
            # RECONCILIATION: Search for similar existing traits in the SAME category
            trait_vector = await get_embedding(trait_text, input_type="passage")
            if trait_vector:
                # 1. Search for top 3 similar traits in SAME category
                index = pc.Index(PINECONE_INDEX)
                search_res = await asyncio.to_thread(
                    index.query,
                    namespace=str(user_id),
                    vector=trait_vector,
                    top_k=3,
                    filter={
                        "role": {"$eq": "trait"},
                        "category": {"$eq": trait_category}
                    },
                    include_metadata=True
                )
                
                # 2. If similar traits exist, check for contradiction via Groq
                is_duplicate = False
                # Only consider matches with high similarity (> 0.88) for reconciliation
                relevant_matches = [m for m in search_res.matches if m.score > 0.88]
                
                if relevant_matches:
                    existing_traits = [m.metadata.get("text") for m in relevant_matches]
                    logger.info(f"Checking for contradiction in {trait_category} against high-similarity traits: {existing_traits}")
                    
                    recon_prompt = f"""
                    New fact: "{trait_text}"
                    Existing facts: {existing_traits}
                    
                    1. If the new fact is ALREADY KNOWN (semantically the same), output "EXISTS".
                    2. If the new fact CONTRADICTS an existing one, output the EXACT TEXT of the conflicting fact.
                    3. Otherwise, output "NONE".
                    
                    Output exactly one word or the exact phrase.
                    """
                    
                    conflict_text_raw = await get_groq_response([{"role": "system", "content": recon_prompt}], model="llama-3.1-8b-instant")
                    conflict_text = conflict_text_raw.strip()
                    
                    if conflict_text == "EXISTS":
                        logger.info(f"Fact already exists (score > 0.88), skipping save: {trait_text}")
                        is_duplicate = True
                    elif conflict_text != "NONE":
                        # Match the conflict text back to an ID
                        for match in relevant_matches:
                            if match.metadata.get("text") == conflict_text:
                                # Store a PENDING CLARIFICATION vector
                                clarification_id = f"pending-{int(time.time())}"
                                await asyncio.to_thread(
                                    index.upsert,
                                    vectors=[{
                                        "id": clarification_id,
                                        "values": [0.1]*1024,
                                        "metadata": {
                                            "role": "pending_clarification",
                                            "old_trait": conflict_text,
                                            "new_trait": trait_text,
                                            "created_at": int(time.time())
                                        }
                                    }],
                                    namespace=str(user_id)
                                )
                                logger.info(f"Stored pending clarification for: {conflict_text} vs {trait_text}")

                                # Delete the old conflicting trait
                                await asyncio.to_thread(index.delete, ids=[match.id], namespace=str(user_id))
                                logger.info(f"Deleted conflicting trait: {conflict_text}")
                                break

                # 3. Save new trait (Skip if duplicate)
                if not is_duplicate:
                    # We manually construct the upsert to include category
                    memory_id = f"{int(time.time())}-trait"
                    await asyncio.to_thread(
                        index.upsert,
                        vectors=[{
                            "id": memory_id,
                            "values": trait_vector,
                            "metadata": {
                                "text": trait_text,
                                "role": "trait",
                                "category": trait_category,
                                "created_at": int(time.time())
                            }
                        }],
                        namespace=str(user_id)
                    )
                    logger.info(f"Saved distilled fact to Pinecone: {trait_text}")
        else:
            logger.info("No significant permanent fact found in this message.")

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
    background_tasks.add_task(process_telegram_update, update, background_tasks)

    return {"status": "ok"}
