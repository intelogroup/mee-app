# Mee App — Roadmap

Focus: complete the coaching experience from onboarding through ongoing use. Telegram stays the primary interaction surface; web app supports and surfaces insights.

---

## P0 — Journey Blockers (ship these first)

- [x] **Conversation history UI** — show past Telegram coaching sessions in the web dashboard; users need to review what the bot said
- [x] **Onboarding completion gate** — enforce the onboarding steps before unlocking full coaching; currently tracked but not gated
- [x] **Bot connection error handling** — clear UI state when Telegram link fails or token expires; currently silently broken
- [x] **Trait/profile editor** — users should be able to correct or add traits the bot inferred; currently read-only
- [x] **Session context summary** — after each conversation, surface a 2–3 line summary in the dashboard ("What we discussed today")

---

## P1 — User Journey Completeness

- [x] **Coaching goals setting** — user sets 1–3 coaching goals in the web app; bot uses them to steer conversations
- [x] **Progress timeline** — weekly/monthly view of trait changes and goal progress inferred from conversation history
- [x] **Brain page** — knowledge graph of user's traits and patterns with pattern insights analysis
- [x] **Notification preferences** — weekly check-in reminder via Telegram; frequency setting + next reminder preview in web app
- [ ] **Memory reset / privacy controls** — let user clear their coaching history and Pinecone vectors from the web app
- [ ] **Re-engagement nudge** — if user hasn't interacted in 7 days, bot sends a gentle prompt

---

## P2 — Quality of Life

- [ ] **Coaching topic tags** — categorize conversation snippets (career, relationships, habits, etc.); show in history
- [ ] **Export conversation history** — download as PDF or markdown for personal records
- [ ] **Referral / invite link** — simple invite flow; no complex rewards needed
- [ ] **User settings page** — notification preferences, timezone, language; currently only password change exists

---

## Out of Scope (do not build)

- WhatsApp, Slack, or other messaging platform integrations
- Group coaching sessions
- Payment or subscription billing
- Analytics dashboards beyond personal progress
- Video/audio coaching sessions
