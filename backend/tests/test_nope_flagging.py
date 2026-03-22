"""Tests for the nope-flagging feature.

Covers:
- Regex detection (pure unit tests)
- Handler early-exit path (AsyncMock)
- log_message flagged param (unit)
- Training script Case 1 extraction for n: prefix
"""

import re
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

# ---------------------------------------------------------------------------
# Regex detection
# ---------------------------------------------------------------------------

CORRECTION_RE = re.compile(r"^(?:nope|n):\s+", re.IGNORECASE)


@pytest.mark.parametrize("text,expected", [
    ("nope: say it shorter", True),
    ("n: be direct", True),
    ("Nope: ", True),          # trailing whitespace — matches \s+
    ("NOPE: all caps", True),
    ("N: uppercase abbrev", True),
    ("nope:text", False),       # no whitespace after colon
    ("n:th", False),            # no whitespace
    ("normal message", False),
    ("", False),
])
def test_correction_regex(text, expected):
    assert bool(CORRECTION_RE.match(text)) == expected


# ---------------------------------------------------------------------------
# log_message — flagged param
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_message_default_no_flagged_field():
    """Default call does not include flagged in the insert payload."""
    with patch("app.services.supabase.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[]))

        import asyncio
        from app.services.supabase import log_message
        await log_message("user-1", "user", "hello")

        inserted = mock_table.insert.call_args[0][0]
        assert "flagged" not in inserted


@pytest.mark.asyncio
async def test_log_message_flagged_true():
    """flagged=True inserts row with flagged=True."""
    with patch("app.services.supabase.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[]))

        from app.services.supabase import log_message
        await log_message("user-1", "user", "nope: be direct", flagged=True)

        inserted = mock_table.insert.call_args[0][0]
        assert inserted.get("flagged") is True


@pytest.mark.asyncio
async def test_log_message_flagged_false_explicit():
    """Explicit flagged=False does not include the field."""
    with patch("app.services.supabase.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[]))

        from app.services.supabase import log_message
        await log_message("user-1", "user", "hello", flagged=False)

        inserted = mock_table.insert.call_args[0][0]
        assert "flagged" not in inserted


# ---------------------------------------------------------------------------
# Handler early-exit path
# ---------------------------------------------------------------------------

def _make_update(text: str) -> dict:
    return {
        "update_id": 1,
        "message": {
            "chat": {"id": 12345},
            "text": text,
            "from": {"id": 99, "username": "testuser"},
        }
    }


@pytest.fixture
def mock_user_profile():
    return {"id": "user-uuid-1", "onboarding_step": 4, "message_count": 10, "traits": [], "last_summary_at": None}


@pytest.mark.asyncio
async def test_correction_skips_groq(mock_user_profile):
    """Correction message must NOT call get_groq_response."""
    with (
        patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock, return_value=mock_user_profile),
        patch("app.routers.telegram.log_message", new_callable=AsyncMock) as mock_log,
        patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock) as mock_groq,
        patch("app.routers.telegram.get_embedding", new_callable=AsyncMock) as mock_embed,
        patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock) as mock_send,
        patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock),
        patch("app.routers.telegram.supabase") as mock_sb,
    ):
        # Stub the preceding assistant message lookup
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[{"id": "msg-42"}]))

        from app.routers.telegram import process_telegram_update
        await process_telegram_update(_make_update("nope: say it shorter"))

        mock_groq.assert_not_called()
        mock_embed.assert_not_called()
        mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_correction_logs_flagged(mock_user_profile):
    """Correction message must call log_message with flagged=True."""
    with (
        patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock, return_value=mock_user_profile),
        patch("app.routers.telegram.log_message", new_callable=AsyncMock) as mock_log,
        patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock),
        patch("app.routers.telegram.get_embedding", new_callable=AsyncMock),
        patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock),
        patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock),
        patch("app.routers.telegram.supabase") as mock_sb,
    ):
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[{"id": "msg-42"}]))

        from app.routers.telegram import process_telegram_update
        await process_telegram_update(_make_update("n: be more direct"))

        mock_log.assert_called_once_with("user-uuid-1", "user", "n: be more direct", flagged=True)


@pytest.mark.asyncio
async def test_correction_recent_context_not_updated(mock_user_profile):
    """recent_context sliding window must NOT be updated for correction messages."""
    with (
        patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock, return_value=mock_user_profile),
        patch("app.routers.telegram.log_message", new_callable=AsyncMock),
        patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock),
        patch("app.routers.telegram.get_embedding", new_callable=AsyncMock),
        patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock),
        patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock),
        patch("app.routers.telegram.supabase") as mock_sb,
    ):
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[{"id": "msg-42"}]))

        from app.routers.telegram import process_telegram_update, recent_context
        user_id = mock_user_profile["id"]
        before = list(recent_context[user_id])

        await process_telegram_update(_make_update("nope: stop asking questions"))

        assert list(recent_context[user_id]) == before


@pytest.mark.asyncio
async def test_correction_flags_preceding_assistant_message(mock_user_profile):
    """When a preceding assistant message is found, it must be flagged."""
    with (
        patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock, return_value=mock_user_profile),
        patch("app.routers.telegram.log_message", new_callable=AsyncMock),
        patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock),
        patch("app.routers.telegram.get_embedding", new_callable=AsyncMock),
        patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock),
        patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock),
        patch("app.routers.telegram.supabase") as mock_sb,
    ):
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.update.return_value = mock_table
        # First execute call: returns a preceding assistant message
        mock_table.execute = MagicMock(return_value=MagicMock(data=[{"id": "msg-prev-99"}]))

        from app.routers.telegram import process_telegram_update
        await process_telegram_update(_make_update("nope: be shorter"))

        # update({flagged: True}).eq(id, msg-prev-99) must have been called
        mock_table.update.assert_called_with({"flagged": True})


@pytest.mark.asyncio
async def test_correction_no_preceding_message_no_exception(mock_user_profile):
    """When no preceding assistant message is found, no exception is raised."""
    with (
        patch("app.routers.telegram.get_user_by_telegram_id", new_callable=AsyncMock, return_value=mock_user_profile),
        patch("app.routers.telegram.log_message", new_callable=AsyncMock),
        patch("app.routers.telegram.get_groq_response", new_callable=AsyncMock),
        patch("app.routers.telegram.get_embedding", new_callable=AsyncMock),
        patch("app.routers.telegram.send_telegram_message", new_callable=AsyncMock),
        patch("app.routers.telegram.send_chat_action", new_callable=AsyncMock),
        patch("app.routers.telegram.supabase") as mock_sb,
    ):
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.execute = MagicMock(return_value=MagicMock(data=[]))  # no preceding message

        from app.routers.telegram import process_telegram_update
        # Should not raise
        await process_telegram_update(_make_update("nope: be shorter"))
        mock_table.update.assert_not_called()


# ---------------------------------------------------------------------------
# Training script — Case 1 extraction for n: prefix
# ---------------------------------------------------------------------------

def test_training_case1_nope_prefix():
    """'Nope: say it shorter' extracts ideal_text = 'say it shorter'."""
    text = "Nope: say it shorter"
    m = re.match(r"^(?:nope|n):\s+(.+)", text, re.IGNORECASE)
    assert m is not None
    assert m.group(1).strip() == "say it shorter"


def test_training_case1_n_prefix():
    """'n: be direct' extracts ideal_text = 'be direct' (regression test for n: support)."""
    text = "n: be direct"
    m = re.match(r"^(?:nope|n):\s+(.+)", text, re.IGNORECASE)
    assert m is not None
    assert m.group(1).strip() == "be direct"


def test_training_case1_no_match_nope_no_space():
    """'nope:text' (no whitespace) does not match Case 1."""
    text = "nope:text"
    m = re.match(r"^(?:nope|n):\s+(.+)", text, re.IGNORECASE)
    assert m is None
