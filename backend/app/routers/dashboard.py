from fastapi import APIRouter, HTTPException, Depends
from app.services.supabase import supabase
from app.services.pinecone import pc, PINECONE_INDEX
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

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
