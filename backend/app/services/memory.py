
import logging
from datetime import datetime, timezone
from app.services.supabase import get_unsynced_messages, update_last_summary_at
from app.services.groq import get_groq_response
from app.services.embeddings import get_embedding
from app.services.pinecone import save_memory

logger = logging.getLogger(__name__)

async def run_episodic_summarizer(user_id: str, last_summary_at: str):
    """
    Checks for new messages and generates an episodic summary if enough time has passed.
    """
    logger.info(f"Checking for episodic summary trigger for user {user_id}")
    
    # 1. Fetch messages since last summary
    messages = await get_unsynced_messages(user_id, last_summary_at)
    if not messages or len(messages) < 3:
        logger.info(f"Not enough new messages ({len(messages)}) for a summary. Skipping.")
        return False

    # 2. Format messages for the LLM
    chat_text = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in messages])
    
    # 3. Generate summary via Groq
    summary_prompt = f"""
    Summarize the key life events, plans, locations, and important topics discussed in this conversation segment.
    Focus on "What happened" or "What is the user doing/planning".
    IGNORE filler, greetings, and generic advice.
    Be concise (1-3 sentences).
    
    Conversation:
    {chat_text}
    
    Summary:
    """
    
    summary = await get_groq_response([{"role": "system", "content": summary_prompt}], model="llama-3.1-8b-instant")
    summary = summary.strip()
    
    if not summary or "NONE" in summary.upper() or len(summary) < 10:
        logger.info("LLM generated empty or invalid summary. Skipping.")
        return False

    logger.info(f"Generated episodic summary: {summary}")

    # 4. Create embedding and save to Pinecone
    vector = await get_embedding(summary, input_type="passage")
    if vector:
        success = await save_memory(user_id, summary, "episodic", vector)
        if success:
            # 5. Proactive Ping Extraction (New)
            await extract_and_schedule_pings(user_id, chat_text)

            # 6. Update last_summary_at in Supabase
            await update_last_summary_at(user_id)
            logger.info(f"Successfully saved episodic memory for user {user_id}")
            return True
            
    return False

async def extract_and_schedule_pings(user_id: str, text: str):
    """
    Scans conversation for future plans and schedules proactive messages.
    """
    from app.services.supabase import supabase
    import json
    import asyncio
    from datetime import datetime, timedelta

    ping_prompt = f"""
    Analyze this conversation for specific FUTURE plans or events the user mentioned.
    
    Conversation:
    {text}
    
    Rules:
    1. Identify if the user has a SPECIFIC event coming up (e.g., "Interview on Friday", "Date tomorrow", "Flying to Paris next week").
    2. Ignore vague plans ("I want to travel someday").
    3. If a plan is found, generate a JSON response:
       {{
         "found": true,
         "event": "Job Interview",
         "message": "Good luck with the interview today! You got this.",
         "days_from_now": 2  (Estimate based on context, e.g., "Friday" = 2 days if today is Wed)
       }}
    4. If no specific plan, return {{ "found": false }}.
    
    OUTPUT JSON ONLY.
    """

    try:
        response = await get_groq_response(
            [{"role": "system", "content": ping_prompt}], 
            model="llama-3.1-8b-instant",
            json_mode=True
        )
        
        clean_res = response.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_res)
        
        if data.get("found"):
            # Calculate scheduled time (Rough estimate for MVP)
            days = data.get("days_from_now", 1)
            # Schedule for 9 AM local time (Assuming UTC for now, can be improved with user timezone)
            scheduled_at = (datetime.now() + timedelta(days=days)).replace(hour=9, minute=0, second=0).isoformat()
            
            # Save to Supabase
            await asyncio.to_thread(
                supabase.table("scheduled_messages").insert({
                    "user_id": user_id,
                    "content": data.get("message"),
                    "scheduled_at": scheduled_at,
                    "status": "pending",
                    "metadata": {"event": data.get("event")}
                }).execute
            )
            logger.info(f"Scheduled memory ping for {user_id}: {data.get('event')} at {scheduled_at}")

    except Exception as e:
        logger.error(f"Error scheduling ping: {e}")
