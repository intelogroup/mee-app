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

No RLS changes needed — existing policies cover the new column.

### 2. Detection Rule

In `telegram.py`, detect correction messages with this pattern (before any LLM/vector work):

```
^(nope|n):\s
```

Case-insensitive. Requires a space after the colon to avoid false positives (e.g. a message starting with "N: no wait" as a natural prefix won't match unless there's a space — wait, that would match. The key guard is requiring the word boundary: `^(nope|n):\s+` matches `Nope: ...` and `N: ...` but not `Naturally:`).

### 3. Handler Flow (correction path)

When the pattern matches:

1. **Skip** all LLM calls, vector search, trait extraction
2. **Save** the user message to `messages` with `flagged = true`
3. **Fetch** the most recent assistant message for this user from `messages` (`role = 'assistant'`, ordered by `created_at DESC`, limit 1)
4. **Update** that row: `flagged = true`
5. **Return early** — no reply sent to Telegram

### 4. `log_message` service update

Add an optional `flagged: bool = False` parameter to the existing `log_message` function in `supabase.py`.

### 5. Training Script Update

`prepare_training_data.py`: change the Supabase fetch to:
```python
.select("user_id, role, content, created_at, flagged")
.eq("flagged", True)  # or filter flagged user messages
.order("created_at", desc=False)
```

The existing Case 1/2/3 parsing logic is unchanged — it still extracts `ideal_text` from `Nope: <text>`, `say '...' instead`, or the next assistant message.

## What Changes

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_flagged_column.sql` | New migration |
| `backend/app/services/supabase.py` | `log_message` gains `flagged` param |
| `backend/app/routers/telegram.py` | Early-exit correction detection |
| `backend/scripts/prepare_training_data.py` | Query by `flagged=true` |

## What Doesn't Change

- No reply is sent for flagged messages (silent save, option A)
- The in-memory `recent_context` sliding window is NOT updated for correction messages (so the correction doesn't pollute the LLM context window on the next turn)
- Existing `is_correction()` patterns in `prepare_training_data.py` remain as a fallback for any unflagged historical messages

## Edge Cases

- **N: with no ideal text:** Still flagged. Script Case 3 handles this by looking at the next assistant message.
- **Correction as first message:** No preceding assistant message to flag — gracefully skip the update step.
- **User not found:** Early exit already handled upstream in the telegram router.
