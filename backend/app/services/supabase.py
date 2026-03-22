
import asyncio
import logging

from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def get_user_by_telegram_id(telegram_id: str):
    response = await asyncio.to_thread(
        supabase.table("profiles").select("*").eq("telegram_chat_id", telegram_id).execute
    )
    if response.data:
        return response.data[0]
    return None

async def link_telegram_account(token: str, telegram_id: str):
    """
    Links a Telegram chat ID to a user profile using a token (user_id).
    Handles cases where the user is already linked or scanning the same QR twice.
    """
    # 1. Check if this Telegram ID is already linked to ANY profile
    existing_link = await get_user_by_telegram_id(telegram_id)
    if existing_link:
        if existing_link.get("id") == token:
            return True, "You're already linked and ready to go! 🎉"
        else:
            logger.warning(f"Telegram ID {telegram_id} is already linked to a different account.")
            return False, "This Telegram account is already linked to another Mee profile."

    # 2. Check if the profile (token) exists
    user_response = await asyncio.to_thread(
        supabase.table("profiles").select("*").eq("id", token).execute
    )
    if not user_response.data:
        return False, "Invalid link. Please get a fresh link from your dashboard."

    user_profile = user_response.data[0]
    
    # 3. Check if the profile is already linked to a DIFFERENT telegram ID
    current_chat_id = user_profile.get("telegram_chat_id")
    if current_chat_id and current_chat_id != telegram_id:
        logger.warning(f"Profile {token} is already linked to Telegram ID {current_chat_id}, re-linking to {telegram_id}.")

    # 4. Update profile with the new telegram_chat_id
    try:
        update_response = await asyncio.to_thread(
            supabase.table("profiles").update({
                "telegram_chat_id": telegram_id
            }).eq("id", token).execute
        )
        
        if update_response.data:
            return True, "Success! Your Mee account is now linked. I'm ready to chat! 🤖"
        return False, "Hmm, I couldn't update your profile. Please try again."
    except Exception as e:
        return False, f"Error during linking: {str(e)}"

async def increment_message_count(user_id: str):
    try:
        await asyncio.to_thread(
            supabase.rpc("increment_message_count", {"row_id": user_id}).execute
        )
    except Exception as e:
        # Non-critical, just log it
        logger.warning(f"Failed to increment message count: {e}")

async def update_onboarding_step(user_id: str, step: int):
    try:
        await asyncio.to_thread(
            supabase.table("profiles").update({"onboarding_step": step}).eq("id", user_id).execute
        )
    except Exception as e:
        logger.warning(f"Failed to update onboarding step: {e}")

async def log_message(user_id: str, role: str, content: str, flagged: bool = False):
    """Logs a message to the Supabase messages table."""
    try:
        row = {"user_id": user_id, "role": role, "content": content}
        if flagged:
            row["flagged"] = True
        await asyncio.to_thread(
            supabase.table("messages").insert(row).execute
        )
    except Exception as e:
        logger.warning(f"Failed to log message: {e}")

async def get_unsynced_messages(user_id: str, last_summary_at: str):
    """Fetches messages for a user created after last_summary_at."""
    try:
        response = await asyncio.to_thread(
            supabase.table("messages")
            .select("*")
            .eq("user_id", user_id)
            .gt("created_at", last_summary_at)
            .order("created_at", desc=False)
            .execute
        )
        return response.data
    except Exception as e:
        logger.warning(f"Failed to fetch unsynced messages: {e}")
        return []

async def update_last_summary_at(user_id: str):
    """Updates the last_summary_at timestamp for a user to now."""
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        await asyncio.to_thread(
            supabase.table("profiles").update({"last_summary_at": now}).eq("id", user_id).execute
        )
    except Exception as e:
        logger.warning(f"Failed to update last_summary_at: {e}")

async def get_stale_profiles():
    """
    Fetches profiles where last_summary_at is older than 1 hour or NULL.
    The summarizer will double-check if there are actual messages to summarize.
    """
    try:
        from datetime import datetime, timezone, timedelta
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        # Fetch profiles needing update
        response = await asyncio.to_thread(
            supabase.table("profiles")
            .select("*")
            .or_(f"last_summary_at.lt.{one_hour_ago},last_summary_at.is.null")
            .execute
        )
        return response.data
    except Exception as e:
        logger.warning(f"Failed to fetch stale profiles: {e}")
        return []


async def get_active_goals(user_id: str) -> list[str]:
    """Fetch active coaching goal titles for a user (max 3)."""
    try:
        response = await asyncio.to_thread(
            supabase.table("coaching_goals")
            .select("title")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=False)
            .limit(3)
            .execute
        )
        return [g["title"] for g in (response.data or [])]
    except Exception as e:
        logger.warning(f"Failed to fetch coaching goals for {user_id}: {e}")
        return []
