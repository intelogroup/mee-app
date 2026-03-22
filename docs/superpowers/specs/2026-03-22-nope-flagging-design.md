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
^(?:nope|n):\s+
```

Case-insensitive. Requires one or more whitespace characters after the colon. `n:` is a deliberate user abbreviation convention — false-positive risk (e.g. `n:th`, `n:ame`) is accepted as negligible at this scale. Note: the existing `is_correction()` in `prepare_training_data.py` uses `.startswith("nope:")` without requiring trailing whitespace — the new handler is intentionally stricter (requires `\s+`) to reduce noise.

**Voice notes:** The voice transcription path sets `text` from Whisper output before the main flow. A voice note saying "Nope: say it shorter" will be transcribed and will match this pattern — voice-transcribed corrections are treated identically to text corrections.

### 3. Handler Flow (correction path)

When the pattern matches:

1. **Skip** all LLM calls, vector search, trait extraction
2. **Save** the user message to `messages` with `flagged = true`
3. **Fetch** the most recent assistant message for this user from `messages` (`role = 'assistant'`, `created_at` within the last 10 minutes, ordered by `created_at DESC`, limit 1). The 10-minute window guards against a race condition: two Telegram webhook background tasks for the same user can run concurrently (no per-user lock exists). Without a time window, a correction task could flag an assistant message written by a concurrently-executing normal-message task that isn't what the user is correcting.
4. **Update** that row: `flagged = true`
5. **Return early** — no reply sent to Telegram

### 4. `log_message` service update

Add an optional `flagged: bool = False` parameter to the existing `log_message` function in `supabase.py`.

### 5. Training Script Update

`prepare_training_data.py`: the fetch strategy changes to a two-step query, not a simple `.eq("flagged", True)`. Using only flagged rows breaks the existing index-based pair extraction (Case 1/2/3) because `messages[i-1]` and `messages[i+1]` rely on adjacency in the full message stream.

New approach:
1. Fetch only flagged **user** messages: `.eq("role", "user").eq("flagged", True)` — these are the corrections
2. For each correction, fetch its paired assistant message separately: query for `role = 'assistant'`, `user_id = X`, `created_at < correction.created_at`, `ORDER BY created_at DESC LIMIT 1`

This replaces the full-table scan + in-Python iteration with targeted per-correction queries. Case 3 (next-assistant lookup for corrections with no inline ideal text) is dropped — once the handler is live, all new corrections will have the ideal text inline or the preceding assistant message is the reference. Case 3 remains as a fallback only for historical unflagged data via the existing `is_correction()` path.

## What Changes

| File | Change |
|------|--------|
| `supabase/migrations/20260322120000_add_flagged_column.sql` | New migration |
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
