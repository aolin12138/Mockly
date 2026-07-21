# Mockly End-to-End Smoke Test

Tests the full pipeline: login → create session → n8n prompt generation →
ElevenLabs conversation → feedback generation → SSE → results page.

## Prerequisites

```bash
# Running services
- Backend: localhost:3000
- Frontend dev: localhost:5173
- n8n: localhost:5678
- PostgreSQL: localhost:5432
```

## Setup

Add to `.env`:

```env
SMOKE_EMAIL=testuser@mockly.com
SMOKE_PASSWORD=your_test_user_password
```

Or pass inline:

```bash
SMOKE_EMAIL=testuser@mockly.com SMOKE_PASSWORD=... node test-suite/smoke/smoke-test.mjs
```

## Run

```bash
node test-suite/smoke/smoke-test.mjs
```

## What it tests

| Phase | What | Checks |
|---|---|---|
| 1. Auth | POST /auth/login | Token returned |
| 2. Session | POST /interview/session | sessionId, DB persisted |
| 3. Callback | SSE /stream | n8n returns agent_id + prompts |
| 4. Conversation | ElevenLabs WS | 2-turn sim-user chat |
| 5. Feedback | POST /generate-feedback + SSE /feedback-stream | Valid JSON, schema check |
| 6. UI | Playwright screenshot | Results page renders, no crash text |

## Output

- `runs/<timestamp>/results.json` — full test log
- `runs/<timestamp>/results-page.png` — Playwright screenshot

## Post-test

Check `http://localhost:5173/dashboard` — session should appear in history.
