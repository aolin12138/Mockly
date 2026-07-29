# Mockly — Agent Instructions

## 🔴 HARD RULES (violating any of these is a critical failure)

### Secrets
- **NEVER hardcode a secret in source code.** If a file needs an API key, token, or password, read it from `process.env.THE_VAR`. Store the value only in `.env` (which is gitignored).
- **Before every commit, mentally grep your diff for:** `sk-`, `AIza`, `ghp_`, `ghu_`, `xox`, `AKIA`, JWT tokens, or any string that looks like a credential. If you see one, abort the commit.
- **If you copy-pasted from `.env` into a `.js`/`.mjs`/`.ts` file, stop.** That key is now in git history forever on a public repo.
- **Use `process.env.VAR` and add a guard:**
  ```js
  const KEY = process.env.MY_KEY;
  if (!KEY) { console.error('MY_KEY not set'); process.exit(1); }
  ```
- **Never log request config or full error objects** — `console.error(e)` prints the whole stack. Use `console.error(e.message)`.

### Git
- This repo is **public** (`github.com/aolin12138/Mockly`). Anything committed and pushed is visible to everyone.
- Pre-commit hook scans for secret patterns — don't bypass with `--no-verify` unless you're absolutely certain.
- CI runs a secret scan on every push and PR.

## Project structure
- `apps/frontend/` — React (Vite) frontend
- `apps/backend/` — Express backend + Prisma
- `test-suite/` — Eval harness (ElevenLabs agent testing)
  - `test-suite/live/` — sim-user, judge, runner (reads `.env` for keys)
  - `test-suite/scripts/` — utilities (stress tests, agent management)
  - `test-suite/scenarios/` — test scenario JSON files
- `.env` — secrets (gitignored, NEVER commit)
- `.wiki/` — project decisions, architecture, lessons

## When writing scripts
- Every script that needs a key must read from `process.env` or from the project's `_env.mjs` loader
- Scripts that can't find their key must fail loudly with a clear message
- Test scripts belong in `test-suite/`, backend in `apps/backend/`, frontend in `apps/frontend/`
