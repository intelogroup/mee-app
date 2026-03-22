from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel
from app.services.supabase import supabase
from app.services.pinecone import pc, PINECONE_INDEX
from app.services.embeddings import get_embedding
from app.services.groq import get_groq_response
from app.core.config import CRON_SECRET
import asyncio
import os
import logging
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Auth dependency for dashboard routes ---
DASHBOARD_API_KEY = os.getenv("BOT_BACKEND_API_KEY")


async def verify_api_key(authorization: str = Header(None)):
    """Verify the API key passed via Authorization: Bearer <key> header."""
    if not DASHBOARD_API_KEY:
        raise HTTPException(status_code=500, detail="Server API key not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if token != DASHBOARD_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


# --- Pydantic models ---
class TraitUpdate(BaseModel):
    text: str
    category: str = "general"


@router.get("/conversations/{user_id}", dependencies=[Depends(verify_api_key)])
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

@router.get("/brain/{user_id}", dependencies=[Depends(verify_api_key)])
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


@router.put("/brain/{user_id}/traits/{trait_id}", dependencies=[Depends(verify_api_key)])
async def update_trait(user_id: str, trait_id: str, body: TraitUpdate):
    """
    Update a trait's text and/or category in Pinecone.
    Re-embeds the new text to keep the vector accurate.
    """
    try:
        index = pc.Index(PINECONE_INDEX)

        # Verify the trait exists and belongs to this user
        fetch_res = await asyncio.to_thread(
            index.fetch, ids=[trait_id], namespace=user_id
        )
        if trait_id not in fetch_res.vectors:
            raise HTTPException(status_code=404, detail="Trait not found")

        existing = fetch_res.vectors[trait_id]
        old_metadata = existing.metadata or {}

        # Re-embed if text changed
        new_vector = existing.values
        if body.text != old_metadata.get("text"):
            new_vector = await get_embedding(body.text, input_type="passage")
            if not new_vector:
                raise HTTPException(status_code=500, detail="Failed to generate embedding")

        # Build updated metadata (preserve created_at, role)
        updated_metadata = {
            **old_metadata,
            "text": body.text,
            "category": body.category,
        }

        await asyncio.to_thread(
            index.upsert,
            vectors=[{"id": trait_id, "values": new_vector, "metadata": updated_metadata}],
            namespace=user_id,
        )

        return {"status": "updated", "id": trait_id, "text": body.text, "category": body.category}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating trait {trait_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update trait")


@router.delete("/brain/{user_id}/traits/{trait_id}", dependencies=[Depends(verify_api_key)])
async def delete_trait(user_id: str, trait_id: str):
    """
    Delete a trait from Pinecone by ID within the user's namespace.
    """
    try:
        index = pc.Index(PINECONE_INDEX)

        # Verify the trait exists and belongs to this user before deleting
        fetch_res = await asyncio.to_thread(
            index.fetch, ids=[trait_id], namespace=user_id
        )
        if trait_id not in fetch_res.vectors:
            raise HTTPException(status_code=404, detail="Trait not found")

        await asyncio.to_thread(
            index.delete, ids=[trait_id], namespace=user_id
        )

        return {"status": "deleted", "id": trait_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting trait {trait_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete trait")


@router.post("/brain/{user_id}/traits", dependencies=[Depends(verify_api_key)])
async def add_trait(user_id: str, body: TraitUpdate):
    """
    Add a new user-defined trait. Generates an embedding and stores in Pinecone.
    """
    try:
        import time as _time

        vector = await get_embedding(body.text, input_type="passage")
        if not vector:
            raise HTTPException(status_code=500, detail="Failed to generate embedding")

        trait_id = f"{int(_time.time())}-trait"
        metadata = {
            "text": body.text,
            "role": "trait",
            "category": body.category,
            "created_at": int(_time.time()),
            "source": "user_edit",
        }

        index = pc.Index(PINECONE_INDEX)
        await asyncio.to_thread(
            index.upsert,
            vectors=[{"id": trait_id, "values": vector, "metadata": metadata}],
            namespace=user_id,
        )

        return {"status": "created", "id": trait_id, "text": body.text, "category": body.category}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding trait for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add trait")


@router.post("/conversations/{user_id}/summarize", dependencies=[Depends(verify_api_key)])
async def summarize_session(user_id: str, session_index: int = Query(default=0, ge=0)):
    """
    Generates a 2-3 line LLM summary for a specific conversation session.
    session_index: 0 = most recent session.
    """
    try:
        # Fetch recent messages to identify the session
        response = await asyncio.to_thread(
            supabase.table("messages")
            .select("role, content, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(0, 199)
            .execute
        )
        messages = response.data or []
        if not messages:
            return {"summary": "No conversations yet."}

        # Group into sessions (same logic as conversation history)
        sorted_messages = sorted(messages, key=lambda m: m["created_at"])
        sessions: list[list] = []
        current_session: list = []

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
                    sessions.append(current_session)
                    current_session = []
            current_session.append(msg)
        if current_session:
            sessions.append(current_session)

        # Reverse so index 0 = most recent
        sessions.reverse()

        if session_index >= len(sessions):
            return {"summary": "Session not found."}

        target_session = sessions[session_index]

        # Build a condensed transcript (limit to ~2000 chars to keep LLM call fast)
        transcript_parts = []
        char_count = 0
        for msg in target_session:
            role_label = "User" if msg["role"] == "user" else "Coach"
            line = f"{role_label}: {msg['content']}"
            if char_count + len(line) > 2000:
                break
            transcript_parts.append(line)
            char_count += len(line)

        transcript = "\n".join(transcript_parts)

        # Generate summary using fast model (no PII logging)
        summary_prompt = [
            {
                "role": "system",
                "content": (
                    "You are summarizing a coaching conversation. "
                    "Write a 2-3 sentence summary of what was discussed and any key insights or action items. "
                    "Be concise and use second person ('you'). Do not include names or identifying details."
                ),
            },
            {"role": "user", "content": transcript},
        ]

        summary = await get_groq_response(summary_prompt, model="llama-3.1-8b-instant")

        return {
            "summary": summary,
            "session_started_at": target_session[0]["created_at"],
            "session_ended_at": target_session[-1]["created_at"],
            "message_count": len(target_session),
        }

    except Exception as e:
        logger.error(f"Error generating session summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")
