
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
from app.core.config import TELEGRAM_BOT_TOKEN, BOT_WEBHOOK_SECRET
from app.services.groq import get_groq_response, extract_traits
from app.services.pinecone import save_memory, get_recent_memories, pc, PINECONE_INDEX # accessing embedding logic directly or via service
from app.services.supabase import link_telegram_account, get_user_by_telegram_id, increment_message_count, update_onboarding_step, supabase
from app.services.embeddings import get_embedding
from app.core.prompts import PERSONAL_DEVELOPMENT_PROTOCOL_25, TWIN_ARCHITECT_PROMPT
import os

router = APIRouter()

import logging
import httpx
import requests
import asyncio
import subprocess
import json
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

# In-memory sliding window for recent context (Privacy-safe, zero-latency)
# Stores the last 6 message objects per user
recent_context = defaultdict(lambda: deque(maxlen=6))

ONBOARDING_QUESTIONS = [
    "Hey! I'm Mee 👋 Quick one — what's the social situation you find most draining?",
    "Got it. And what would feel like a win for you — like what's the one social thing you wish came easier?",
    "Last one — are you more of a one-on-one person or do you actually like groups when the vibe is right?"
]

# Protocol Definitions loaded from Environment
PROTOCOLS = {
    "romance": os.getenv("ROMANCE_PROTOCOL", ""),
    "confidence": os.getenv("CONFIDENCE_PROTOCOL", ""),
    "masculine": ULTIMATES_TUTOR_PROTOCOL
}

# Trigger Keywords
TRIGGERS = {
    "romance": ["girl", "woman", "girlfriend", "boyfriend", "date", "dating", "crush", "flirt", "attractive", "relationship", "love", "sex", "intimacy"],
    "confidence": ["shy", "scared", "afraid", "nervous", "anxious", "confidence", "brave", "fear", "speak up"],
    "masculine": ["alpha", "beta", "man", "manhood", "masculine", "purpose", "discipline", "semen", "gym", "lifting", "financial", "hypergamy", "abundance"]
}

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

        if onboarding_step < 4:
            logger.info(f"User in onboarding step {onboarding_step}")
            
            # Step 0: User somehow missed /start linking flow or is legacy. Send Q1.
            if onboarding_step == 0:
                await send_telegram_message(chat_id, ONBOARDING_QUESTIONS[0])
                await update_onboarding_step(user_id, 1)
                return

            # Step 1, 2, 3: User just answered Q1, Q2, or Q3.
            # Extract trait from their answer immediately.
            trait = await extract_traits(text)
            if trait and vector:
                trait_vector = await get_embedding(trait, input_type="passage")
                if trait_vector:
                    await save_memory(user_id, trait, "trait", trait_vector)
                    logger.info(f"Onboarding trait saved: {trait}")

            # Advance to next step
            if onboarding_step == 1:
                await send_telegram_message(chat_id, ONBOARDING_QUESTIONS[1])
                await update_onboarding_step(user_id, 2)
            elif onboarding_step == 2:
                await send_telegram_message(chat_id, ONBOARDING_QUESTIONS[2])
                await update_onboarding_step(user_id, 3)
            elif onboarding_step == 3:
                await send_telegram_message(chat_id, "Love it. I've got a feel for your style now. Let's get to it. What's on your mind today?")
                await update_onboarding_step(user_id, 4)
            
            return

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
        
        # Determine Active Protocol
        active_protocol = ""
        text_lower = text.lower()
        if any(t in text_lower for t in TRIGGERS["romance"]):
            active_protocol = f"\n[ACTIVE PROTOCOL: ROMANCE]\n{PROTOCOLS['romance']}\n"
            logger.info("Activated Romance Protocol")
        elif any(t in text_lower for t in TRIGGERS["confidence"]):
            active_protocol = f"\n[ACTIVE PROTOCOL: CONFIDENCE]\n{PROTOCOLS['confidence']}\n"
            logger.info("Activated Confidence Protocol")
        elif any(t in text_lower for t in TRIGGERS["masculine"]):
            active_protocol = f"\n[ACTIVE PROTOCOL: MASCULINE DEVELOPMENT]\n{PROTOCOLS['masculine']}\n"
            logger.info("Activated Masculine Protocol")

        system_prompt = f"""{TWIN_ARCHITECT_PROMPT}

ADDITIONAL CONSTRAINTS:
- Default to 1-2 sentences max. Use the behavior of a gritty twin brother.
- Use "We" and "Us" constantly. Our win is shared.
- Match his short text energy, but with a "!bam" or "Shish!" pop.
- Lead with an actionable script or a mindset hardening.

[MEMORY BEHAVIOR]
You have a sharp, precise memory. When user traits are available, reference them naturally like a friend who pays attention.
If user contradicts a known trait, call it out conversationally:
"Wait — I thought you were in [Old]? Did you move to [New] or am I mixing things up?"
Always trust the most recent info. Update your understanding and move on — don't dwell on it.

{active_protocol}
{clarification_prompt}

CONTEXT:
User traits: {user_traits}
Long-term memories: {context_str if context_str else "Clean slate."}
"""
        
        # Build message history: System Prompt + Sliding Window + Current Input
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add sliding window from memory
        history = list(recent_context[user_id])
        messages.extend(history)
        
        # Add current user message
        messages.append({"role": "user", "content": text})

        logger.info(f"Calling Groq for user: {username} with {len(history)} history messages")
        response_text = await get_groq_response(messages)
        logger.info(f"Received Groq response: {response_text[:50]}...")

        # 5. Send Response
        logger.info(f"Sending response to chat_id {chat_id}")
        await send_telegram_message(chat_id, response_text)

        # 6. Post-Response Tasks (Async / Background)
        # Update in-memory sliding window
        recent_context[user_id].append({"role": "user", "content": text})
        recent_context[user_id].append({"role": "assistant", "content": response_text})
        
        # Increment message count first to check for trait extraction trigger
        await increment_message_count(user_id)
        
        # TRAIT EXTRACTION LOGIC (Every 3rd message)
        # We NO LONGER save raw messages to Pinecone. Only distilled traits.
        if (message_count + 1) % 3 == 0:
            logger.info("Triggering trait extraction (every 3rd message)...")
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
                        
                        conflict_text_raw = await get_groq_response([{"role": "system", "content": recon_prompt}])
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
                logger.info("No significant fact found.")

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
