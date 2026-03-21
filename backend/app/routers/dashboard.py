from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.supabase import supabase
from app.services.pinecone import pc, PINECONE_INDEX
import asyncio
import logging
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/conversations/{user_id}")
async def get_conversation_history(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """
    Fetches paginated conversation history for a user from the messages table.
    Groups messages into sessions based on 1-hour gaps.
    """
    try:
        # Fetch messages ordered by created_at descending for pagination
        response = await asyncio.to_thread(
            supabase.table("messages")
            .select("id, role, content, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute
        )
        messages = response.data or []

        # Get total count for pagination
        count_response = await asyncio.to_thread(
            supabase.table("messages")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute
        )
        total = count_response.count if count_response.count is not None else len(messages)

        # Group messages into sessions (1-hour gap = new session)
        # Reverse to chronological order for grouping
        sorted_messages = sorted(messages, key=lambda m: m["created_at"])
        sessions = []
        current_session = []

        for msg in sorted_messages:
            if current_session:
                last_time = datetime.fromisoformat(
                    current_session[-1]["created_at"].replace("Z", "+00:00")
                )
                curr_time = datetime.fromisoformat(
                    msg["created_at"].replace("Z", "+00:00")
                )
                gap_hours = (curr_time - last_time).total_seconds() / 3600
                if gap_hours > 1:
                    sessions.append(_build_session(current_session))
                    current_session = []
            current_session.append(msg)

        if current_session:
            sessions.append(_build_session(current_session))

        # Reverse sessions so most recent is first
        sessions.reverse()

        return {
            "sessions": sessions,
            "total_messages": total,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Error fetching conversation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch conversation history")


def _build_session(messages: list) -> dict:
    """Builds a session dict from a list of chronological messages."""
    first_at = messages[0]["created_at"]
    last_at = messages[-1]["created_at"]
    message_count = len(messages)

    # Generate a short summary from assistant messages (first 2-3 lines)
    assistant_msgs = [m["content"] for m in messages if m["role"] == "assistant"]
    summary = ""
    if assistant_msgs:
        # Take first assistant message, truncate to ~120 chars
        summary = assistant_msgs[0][:120]
        if len(assistant_msgs[0]) > 120:
            summary += "..."

    return {
        "started_at": first_at,
        "ended_at": last_at,
        "message_count": message_count,
        "summary": summary,
        "messages": messages,
    }

@router.get("/brain/{user_id}")
async def get_user_brain(user_id: str):
    """
    Fetches the user's 'Brain' (Traits + Memories) for the Dashboard visualization.
    """
    try:
        # 1. Fetch User Profile (for static traits if any)
        # We might not need this if we rely solely on Pinecone, but let's grab it for completeness
        profile_res = await asyncio.to_thread(
            supabase.table("profiles").select("traits, telegram_chat_id, onboarding_step").eq("id", user_id).execute
        )
        profile_data = profile_res.data[0] if profile_res.data else {}

        # 2. Fetch Traits from Pinecone (The detailed ones with categories)
        index = pc.Index(PINECONE_INDEX)
        
        # We can't query *all* vectors easily without metadata filtering
        # Strategy: Query with a dummy vector and filter by role='trait'
        # Top 50 traits should cover most users
        trait_res = await asyncio.to_thread(
            index.query,
            namespace=user_id,
            vector=[0.1]*1024,
            top_k=50,
            filter={"role": {"$eq": "trait"}},
            include_metadata=True
        )
        
        traits = []
        if trait_res.matches:
            for m in trait_res.matches:
                traits.append({
                    "id": m.id,
                    "text": m.metadata.get("text"),
                    "category": m.metadata.get("category", "general"),
                    "score": m.score
                })

        # 3. Fetch Recent Episodic Memories
        episodic_res = await asyncio.to_thread(
            index.query,
            namespace=user_id,
            vector=[0.1]*1024,
            top_k=10,
            filter={"role": {"$eq": "episodic"}},
            include_metadata=True
        )

        memories = []
        if episodic_res.matches:
            for m in episodic_res.matches:
                memories.append({
                    "id": m.id,
                    "text": m.metadata.get("text"),
                    "created_at": m.metadata.get("created_at")
                })

        return {
            "profile": profile_data,
            "traits": traits,
            "memories": memories
        }

    except Exception as e:
        logger.error(f"Error fetching brain data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch brain data")
