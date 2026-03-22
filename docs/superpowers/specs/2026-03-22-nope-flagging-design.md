# Nope-Flagging Design Spec
**Date:** 2026-03-22
**Status:** Approved

## Problem

User corrections (`Nope: should've said X`, `N: be more direct`) currently flow through the full LLM pipeline — Groq is called, a response is generated and sent, and the correction is saved as a plain user message. The offline `prepare_training_data.py` script recovers these by pattern-matching across all messages post-hoc. This wastes inference cost, adds latency, and is fragile.

## Goal

Detect correction messages in real-time in the Telegram handler, skip the LLM call entirely, save them as flagged records, and mark the preceding assistant message as flagged too — so training data extraction becomes a simple `WHERE flagged = true` query.

## Design

### 1. DB Migration

Add `flagged BOOLEAN DEFAULT false` to `public.messages`.

Add a partial index for fast training data queries:
```sql
CREATE INDEX idx_messages_flagged
ON public.messages(user_id, created_at DESC)
WHERE flagged = true;
```

Add a covering index for the "fetch preceding assistant message" query in the correction handler:
```sql
CREATE INDEX idx_messages_user_created
ON public.messages(user_id, created_at DESC);
```

No RLS changes needed — existing policies cover the new column.

### 2. Detection Rule

In `telegram.py`, detect correction messages with this pattern (before any LLM/vector work):

```
^(?:nope|n):\s+
```

Case-insensitive. Requires one or more whitespace characters after the colon. `n:` is a deliberate user abbreviation convention — false-positive risk (e.g. `n:th`, `n:ame`) is accepted as negligible at this scale. Note: the existing `is_correction()` in `prepare_training_data.py` uses `.startswith("nope:")` without requiring trailing whitespace — the new handler is intentionally stricter (requires `\s+`) to reduce noise.

**Voice notes:** The voice transcription path sets `text` from Whisper output before the main flow. A voice note saying "Nope: say it shorter" will be transcribed and will match this pattern — voice-transcribed corrections are treated identically to text corrections. **Echo suppression:** The normal voice path sends `🎤 Heard: [text]` before the correction check fires. For voice corrections, this echo must be suppressed: after transcription, check the pattern before sending the "Heard:" confirmation. If the text matches the correction pattern, skip the echo and proceed directly to the correction early-exit path.

### 3. Handler Flow (correction path)

When the pattern matches:

1. **Skip** all LLM calls, vector search, trait extraction — including the embedding call.
2. **Save** the user message to `messages` with `flagged = true`
3. **Fetch** the most recent assistant message for this user from `messages` (`role = 'assistant'`, `created_at` within the last 10 minutes, ordered by `created_at DESC`, limit 1). The 10-minute window guards against a race condition: two Telegram webhook background tasks for the same user can run concurrently (no per-user lock exists). Without a time window, a correction task could flag an assistant message written by a concurrently-executing normal-message task that isn't what the user is correcting.
4. **Update** that row: `flagged = true`. If no row found within the window, or if the update fails, log a warning and continue — the correction user message is already saved, so the failure is non-fatal.
5. **Return early** — no reply sent to Telegram

**Insertion point in `process_telegram_update`:** The correction check must be inserted AFTER the user profile is fetched (to obtain `user_id`) but BEFORE the embedding call. The current code runs `asyncio.gather(profile_task, embedding_task)` — this gather must be restructured for the correction path:
```
# Restructured flow:
user_profile = await get_user_by_telegram_id(telegram_user_id)
if not user_profile: return  # (existing not-linked check)
user_id = user_profile.get("id")

# Check for correction BEFORE embedding
if re.match(r"^(?:nope|n):\s+", text, re.IGNORECASE):
    # ... correction path (no embedding called)
    return

# Normal path: now fetch embedding
vector = await get_embedding(text, input_type="query")
```

### 4. `log_message` service update

Add an optional `flagged: bool = False` parameter to the existing `log_message` function in `supabase.py`.

### 5. Training Script Update

`prepare_training_data.py`: the fetch strategy changes to a two-step query, not a simple `.eq("flagged", True)`. Using only flagged rows breaks the existing index-based pair extraction (Case 1/2/3) because `messages[i-1]` and `messages[i+1]` rely on adjacency in the full message stream.

New approach:
1. Fetch only flagged **user** messages: `.eq("role", "user").eq("flagged", True)` — these are the corrections
2. For each correction, fetch its paired assistant message separately: query for `role = 'assistant'`, `user_id = X`, `created_at < correction.created_at`, `ORDER BY created_at DESC LIMIT 1`

This replaces the full-table scan + in-Python iteration with targeted per-correction queries. Case 3 (next-assistant lookup for corrections with no inline ideal text) is dropped — once the handler is live, all new corrections will have the ideal text inline or the preceding assistant message is the reference. Case 3 remains as a fallback only for historical unflagged data via the existing `is_correction()` path.

**Case 1 extraction must handle `n:` prefix:** The existing Case 1 logic uses `startswith("nope:")` which silently fails for `n:` corrections, producing no training sample. Update to handle both prefixes:
```python
# Case 1: "Nope: [Ideal Text]" or "n: [Ideal Text]"
m = re.match(r"^(?:nope|n):\s+(.+)", msg['content'], re.IGNORECASE)
if m:
    ideal_text = m.group(1).strip()
```

## What Changes

| File | Change |
|------|--------|
| `supabase/migrations/20260322120000_add_flagged_column.sql` | New migration (2 indexes) |
| `backend/app/services/supabase.py` | `log_message` gains `flagged` param |
| `backend/app/routers/telegram.py` | Early-exit correction detection; restructure gather |
| `backend/scripts/prepare_training_data.py` | Query by `flagged=true`; fix `n:` Case 1 extraction |
| `backend/tests/test_nope_flagging.py` | New test file (see Test Requirements below) |

## What Doesn't Change

- No reply is sent for flagged messages (silent save, option A)
- The in-memory `recent_context` sliding window is NOT updated for correction messages (so the correction doesn't pollute the LLM context window on the next turn). The bad assistant message that triggered the correction remains in the sliding window — evicting it is out of scope for this feature (the window expires naturally after 6 turns).
- Existing `is_correction()` patterns in `prepare_training_data.py` remain as a fallback for any unflagged historical messages

## Edge Cases

- **N: with no ideal text:** Still flagged. For new flagged corrections, the training script uses the preceding assistant message as the reference (step 2 of the two-step query). Case 3 (next-assistant lookup) only applies to historical unflagged data.
- **Correction as first message:** No preceding assistant message to flag — gracefully skip the update step.
- **User not found:** Early exit already handled upstream in the telegram router.

## Test Requirements

File: `backend/tests/test_nope_flagging.py`

### Regex detection (pure unit tests, no mocks needed)
- `"nope: say it shorter"` → matches
- `"n: be direct"` → matches
- `"Nope: "` → matches (case-insensitive)
- `"nope:text"` (no whitespace) → no match
- `"normal message"` → no match
- `"n:th"` → no match (no whitespace after colon)

### Handler early-exit path (AsyncMock the Supabase calls)
- Correction text → `log_message` called with `flagged=True`
- Correction text → `get_groq_response` NOT called
- Correction text → `get_embedding` NOT called
- Correction text → `send_telegram_message` NOT called
- Correction text → `recent_context` not updated
- Preceding assistant message found within 10 min → update called with `flagged=True`
- No preceding assistant message (first message) → no update called, no exception

### `log_message` unit tests
- Default call → inserts row without `flagged` field (backwards compat)
- `flagged=True` → inserts row with `flagged=True`
- `flagged=False` explicit → inserts row with `flagged=False`

### Training script extraction
- `"Nope: say it shorter"` → `ideal_text = "say it shorter"` (Case 1, existing)
- `"n: be direct"` → `ideal_text = "be direct"` (Case 1, new — regression test)
- Flagged correction with no inline text → uses paired assistant message
- No flagged messages → output file is empty / 0 samples

### Voice correction
- Voice note transcribed to `"Nope: say it shorter"` → echo suppressed, no Telegram reply

## NOT in scope

- Evicting the bad assistant message from `recent_context` — window expires naturally after 6 turns
- Notifying the user that the correction was received (silent save is intentional)
- Backfilling `flagged=true` on historical correction messages in the DB
- Updating `is_correction()` in `prepare_training_data.py` to handle `n:` (historical data didn't use this abbreviation)
- Per-user locking to fully eliminate the race condition (time window is sufficient mitigation)

## What Already Exists

- `log_message()` in `supabase.py:79` — reused with minimal extension
- Early-return pattern in `process_telegram_update` (lines 228–243) — correction path follows same pattern
- `is_correction()` in `prepare_training_data.py:23` — retained as historical fallback, not replaced
- `asyncio.gather` pattern for profile+embedding — restructured (not removed) for correction-path optimization

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | N/A | No UI scope |

**VERDICT:** ENG CLEARED — ready to implement.
