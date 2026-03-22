# TODOS

## Nope-Flagging: Evict bad assistant message from recent_context

**What:** When a correction fires, evict the last assistant message from the `recent_context[user_id]` deque in `telegram.py`.

**Why:** The bad response that triggered the correction stays in the in-memory sliding window for up to 6 more turns. The LLM sees its own bad output as valid context during that window, which can reinforce the behavior the user is trying to correct.

**Pros:** Corrections become immediately effective — the bad response is gone from the window on the next turn. Aligns the in-memory context with the user's intent.

**Cons:** Requires matching the correction event to the right deque entry (pop the last assistant message from `recent_context[user_id]`). Small added complexity in the correction handler.

**Context:** `recent_context` is a `defaultdict(lambda: deque(maxlen=6))` defined at module level in `telegram.py:112`. The correction handler already knows `user_id`. The fix is a one-liner: `if recent_context[user_id] and recent_context[user_id][-1]['role'] == 'assistant': recent_context[user_id].pop()`. Deferred because it's out of scope for the initial nope-flagging PR; the window expires naturally after 6 turns.

**Depends on / blocked by:** Nope-flagging feature (PR introducing the correction handler).
