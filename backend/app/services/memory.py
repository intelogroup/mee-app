
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
    
    summary = await get_groq_response([{"role": "system", "content": summary_prompt}])
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
            # 5. Update last_summary_at in Supabase
            await update_last_summary_at(user_id)
            logger.info(f"Successfully saved episodic memory for user {user_id}")
            return True
            
    return False
