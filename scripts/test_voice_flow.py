import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock dependencies
mock_supabase = MagicMock()
sys.modules["app.services.supabase"] = MagicMock(supabase=mock_supabase)

from app.routers.telegram import process_telegram_update

async def test_voice_flow():
    print("\n--- Testing Voice Note Processing Flow ---")
    
    # Simulated Telegram Update with a Voice Note
    update = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 999, "username": "TestUser"},
            "voice": {
                "file_id": "voice_file_123",
                "duration": 5
            }
        }
    }

    # Mocks
    mock_audio_bytes = b"fake_audio_content"
    mock_transcription = "I am testing the voice feature."
    
    # Patch the download and transcribe functions
    with patch("app.routers.telegram.download_telegram_file", new_callable=AsyncMock) as mock_download, \
         patch("app.routers.telegram.transcribe_audio", new_callable=AsyncMock) as mock_transcribe, \
         patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock) as mock_send_msg, \
         patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock) as mock_action, \
         patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock) as mock_get_user, \
         patch("app.routers.telegram.get_embedding", new_callable=AsyncMock) as mock_embed, \
         patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock) as mock_groq_resp:

        # Setup Mock Returns
        mock_download.return_value = mock_audio_bytes
        mock_transcribe.return_value = mock_transcription
        
        # User exists
        mock_get_user.return_value = {"id": "user-123", "traits": [], "message_count": 10}
        
        # Embedding returns dummy vector
        mock_embed.return_value = [0.1] * 1024
        
        # LLM Response
        mock_groq_resp.return_value = "I heard you say: 'I am testing the voice feature.'"

        # Run the handler
        await process_telegram_update(update)

        # Verifications
        print("\n🔍 Verification Results:")
        
        # 1. Did it try to download?
        if mock_download.called:
            print(f"✅ Downloaded file_id: {mock_download.call_args[0][0]}")
        else:
            print("❌ Failed to call download_telegram_file")

        # 2. Did it transcribe?
        if mock_transcribe.called:
            print(f"✅ Called Transcribe with {len(mock_transcribe.call_args[0][0])} bytes")
            print(f"   Transcription Result: '{mock_transcription}'")
        else:
            print("❌ Failed to call transcribe_audio")

        # 3. Did it send a response?
        if mock_send_msg.called:
            print(f"✅ Sent Reply: '{mock_send_msg.call_args[0][1]}'")
        else:
            print("❌ Failed to send reply")

if __name__ == "__main__":
    asyncio.run(test_voice_flow())
