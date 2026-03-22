from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel
from typing import Optional, List
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


class GoalCreate(BaseModel):
    title: str


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None


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


# ============================================================
# Privacy Reset Endpoints
# ============================================================

@router.post("/brain/{user_id}/reset", dependencies=[Depends(verify_api_key)])
async def reset_brain(user_id: str):
    """
    Deletes ALL vectors (traits, episodic memories) for a user from their Pinecone namespace.
    Used by the privacy controls to clear all AI-inferred knowledge about the user.
    """
    try:
        index = pc.Index(PINECONE_INDEX)
        await asyncio.to_thread(index.delete, delete_all=True, namespace=user_id)
        logger.info(f"Brain reset for user {user_id}")
        return {"status": "ok", "message": "Brain data cleared"}
    except Exception as e:
        logger.error(f"Error resetting brain for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset brain data")


@router.post("/conversations/{user_id}/reset", dependencies=[Depends(verify_api_key)])
async def reset_conversations(user_id: str):
    """
    Deletes ALL messages for a user from the messages table.
    Used by the privacy controls to wipe conversation history.
    """
    try:
        await asyncio.to_thread(
            supabase.table("messages").delete().eq("user_id", user_id).execute
        )
        logger.info(f"Conversation history reset for user {user_id}")
        return {"status": "ok", "message": "Conversation history cleared"}
    except Exception as e:
        logger.error(f"Error resetting conversations for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset conversation history")


@router.post("/vectors/{user_id}/reset", dependencies=[Depends(verify_api_key)])
async def reset_vectors(user_id: str):
    """
    Alias for brain reset — deletes the entire Pinecone namespace for a user.
    Kept separate so the frontend can call each reset step independently for granular error reporting.
    """
    try:
        index = pc.Index(PINECONE_INDEX)
        await asyncio.to_thread(index.delete, delete_all=True, namespace=user_id)
        logger.info(f"Vector store reset for user {user_id}")
        return {"status": "ok", "message": "Vector store cleared"}
    except Exception as e:
        logger.error(f"Error resetting vectors for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset vector store")


# ============================================================
# Coaching Goals CRUD
# ============================================================

@router.get("/goals/{user_id}", dependencies=[Depends(verify_api_key)])
async def get_goals(user_id: str):
    """Fetch all coaching goals for a user, ordered by creation date."""
    try:
        response = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .select("id, title, status, created_at, updated_at")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute
        )
        return {"goals": response.data or []}
    except Exception as e:
        logger.error(f"Error fetching goals for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch goals")


@router.post("/goals/{user_id}", dependencies=[Depends(verify_api_key)])
async def create_goal(user_id: str, body: GoalCreate):
    """Create a new coaching goal (max 3 active per user)."""
    if not body.title or not body.title.strip():
        raise HTTPException(status_code=400, detail="Goal title cannot be empty")
    if len(body.title) > 200:
        raise HTTPException(status_code=400, detail="Goal title too long (max 200 chars)")

    try:
        # Check active count first (defence in depth — DB trigger also enforces)
        count_res = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute
        )
        active_count = count_res.count if count_res.count is not None else 0
        if active_count >= 3:
            raise HTTPException(status_code=400, detail="Maximum of 3 active goals allowed")

        response = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .insert({"user_id": user_id, "title": body.title.strip()})
            .execute
        )
        if response.data:
            return {"status": "created", "goal": response.data[0]}
        raise HTTPException(status_code=500, detail="Failed to create goal")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating goal for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create goal")


@router.patch("/goals/{user_id}/{goal_id}", dependencies=[Depends(verify_api_key)])
async def update_goal(user_id: str, goal_id: str, body: GoalUpdate):
    """Update a coaching goal's title or status."""
    update_data = {}
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status_code=400, detail="Goal title cannot be empty")
        update_data["title"] = body.title.strip()
    if body.status is not None:
        if body.status not in ("active", "completed", "archived"):
            raise HTTPException(status_code=400, detail="Invalid status")
        update_data["status"] = body.status

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        response = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .update(update_data)
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .execute
        )
        if response.data:
            return {"status": "updated", "goal": response.data[0]}
        raise HTTPException(status_code=404, detail="Goal not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating goal {goal_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update goal")


@router.delete("/goals/{user_id}/{goal_id}", dependencies=[Depends(verify_api_key)])
async def delete_goal(user_id: str, goal_id: str):
    """Delete a coaching goal."""
    try:
        response = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .delete()
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .execute
        )
        if response.data:
            return {"status": "deleted", "id": goal_id}
        raise HTTPException(status_code=404, detail="Goal not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting goal {goal_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete goal")


# ============================================================
# Progress Timeline
# ============================================================

@router.get("/progress/{user_id}", dependencies=[Depends(verify_api_key)])
async def get_progress_timeline(
    user_id: str,
    period: str = Query(default="weekly", pattern="^(weekly|monthly)$"),
):
    """
    Returns a progress timeline: weekly or monthly summary of
    conversation activity and goal status changes.
    """
    from datetime import timedelta

    try:
        now = datetime.now(timezone.utc)

        if period == "weekly":
            # Last 4 weeks
            num_periods = 4
            delta = timedelta(weeks=1)
            label_fmt = "%b %d"
        else:
            # Last 3 months
            num_periods = 3
            delta = timedelta(days=30)
            label_fmt = "%b %Y"

        # Fetch all messages in the time range
        range_start = now - (delta * num_periods)
        messages_res = await asyncio.to_thread(
            supabase.table("messages")
            .select("created_at, role")
            .eq("user_id", user_id)
            .gte("created_at", range_start.isoformat())
            .order("created_at", desc=False)
            .execute
        )
        messages = messages_res.data or []

        # Fetch goals with timestamps
        goals_res = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .select("title, status, created_at, updated_at")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute
        )
        goals = goals_res.data or []

        # Fetch traits from Pinecone (to show trait changes over time)
        index = pc.Index(PINECONE_INDEX)
        trait_res = await asyncio.to_thread(
            index.query,
            namespace=user_id,
            vector=[0.1] * 1024,
            top_k=30,
            filter={"role": {"$eq": "trait"}},
            include_metadata=True,
        )
        traits = []
        if trait_res.matches:
            for m in trait_res.matches:
                traits.append({
                    "text": m.metadata.get("text"),
                    "category": m.metadata.get("category", "general"),
                    "created_at": m.metadata.get("created_at"),
                })

        # Build timeline buckets
        timeline = []
        for i in range(num_periods):
            bucket_start = now - (delta * (num_periods - i))
            bucket_end = now - (delta * (num_periods - i - 1))

            # Count messages in this bucket
            bucket_msgs = [
                m for m in messages
                if bucket_start.isoformat() <= m["created_at"] < bucket_end.isoformat()
            ]
            user_msgs = len([m for m in bucket_msgs if m["role"] == "user"])
            bot_msgs = len([m for m in bucket_msgs if m["role"] == "assistant"])

            # Goals completed in this bucket
            completed_goals = [
                g["title"] for g in goals
                if g["status"] == "completed"
                and g.get("updated_at")
                and bucket_start.isoformat() <= g["updated_at"] < bucket_end.isoformat()
            ]

            # Traits discovered in this bucket (using epoch timestamp)
            bucket_start_epoch = int(bucket_start.timestamp())
            bucket_end_epoch = int(bucket_end.timestamp())
            new_traits = [
                t["text"] for t in traits
                if isinstance(t.get("created_at"), (int, float))
                and bucket_start_epoch <= t["created_at"] < bucket_end_epoch
            ]

            timeline.append({
                "label": bucket_start.strftime(label_fmt) + " - " + bucket_end.strftime(label_fmt),
                "start": bucket_start.isoformat(),
                "end": bucket_end.isoformat(),
                "user_messages": user_msgs,
                "bot_messages": bot_msgs,
                "total_messages": user_msgs + bot_msgs,
                "completed_goals": completed_goals,
                "new_traits": new_traits,
            })

        # Active goals summary
        active_goals = [g for g in goals if g["status"] == "active"]

        return {
            "period": period,
            "timeline": timeline,
            "active_goals": [{"title": g["title"], "created_at": g["created_at"]} for g in active_goals],
            "total_traits": len(traits),
        }

    except Exception as e:
        logger.error(f"Error generating progress timeline for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate timeline")
