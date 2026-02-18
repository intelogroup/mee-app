
from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

import asyncio

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
            pass

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
        pass

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
        print(f"Failed to increment message count: {e}")
