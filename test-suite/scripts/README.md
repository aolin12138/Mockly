# test-suite/scripts

CLI tools that own the **eval → revert → promote** loop for the Mockly
interview agent. None of these change production by themselves; they only
touch the test agent (`agent_2201ktp0n7mwek6avkphs4x6394m`).

## Source of truth

**`test-suite/agent/config.json`** — the full ElevenLabs agent config,
exactly as `GET /v1/convai/agents/<id>` returns it. This is **the**
canonical artifact for eval. After a passing eval, `promote-to-template.mjs`
copies this JSON into the n8n workflow's embedded template; n8n then
serves it to all per-user agents. The backend is not involved — it just
triggers n8n with `{api_key, voice_id, agent_id?}` as before.

Everything else (prompts, workflow nodes, edges, tools, MCP refs, per-phase
overrides) lives inside this one JSON. Edit it directly with your editor.

## One-time setup

```bash
# Fetch the live test agent into agent/config.json. Read-only.
node test-suite/scripts/bootstrap-agent.mjs
```

Produces:
- `test-suite/agent/config.json` — full agent config.
- `test-suite/agent/_meta.json` — bootstrap timestamp, version_id, node summary.

## Day-to-day eval loop

```bash
# 1. Edit the config locally (prompts, workflow nodes, anything).
code test-suite/agent/config.json

# 2. Preview what would change on the test agent (no write).
node test-suite/scripts/push-agent.mjs

# 3. Push to the test agent. Refuses Forbidden field changes; warns on Restricted.
node test-suite/scripts/push-agent.mjs --confirm

# 4. Run the eval. Writes runs/<run-id>/ with manifest + report + summary.
node test-suite/live/runner.mjs --all --yes

# 5. Inspect: open runs/<run-id>/report.html, read summary.md.
```

### push-agent.mjs exit codes

| Exit | Meaning |
|------|---------|
| `0`  | Dry-run, or PATCH succeeded |
| `1`  | Fatal error (file missing, PATCH HTTP error) |
| `3`  | **Forbidden** field would change — refused (even with `--confirm`) |
| `4`  | **Restricted** field would change — pass `--allow-restricted` to override |

### runner.mjs gate exit codes

| Exit | Meaning |
|------|---------|
| `0`  | Promotable — only mutable changes, no leaks, no regressions |
| `1`  | Behaviour failure or regression — not promotable |
| `2`  | Harness error (API down, MCP unreachable) — re-run |
| `3`  | **Leak detected** — any `no_leak` failure, loudest signal |

## Reverting

```bash
# Show what would be PATCHed without writing.
node test-suite/scripts/revert-agent.mjs --from-checkpoint 2026-06-16T06-57-19

# Actually PATCH back.
node test-suite/scripts/revert-agent.mjs --from-checkpoint 2026-06-16T06-57-19 --confirm

# Revert to a run's captured config.
node test-suite/scripts/revert-agent.mjs --from-run 2026-06-24T10-15-22 --confirm
```

Three independent revert layers (see EVAL-PLAN.md §E):
- **ElevenLabs `version_id`** — server-side; every PATCH bumps it; manifest.json
  in each run folder records `version_before` / `version_after`.
- **Git** — `agent/config.json` is git-tracked. `git revert <sha>` +
  `push-agent.mjs --confirm` rolls back.
- **Run snapshot** — `runs/<id>/agent-config.json` is a full restorable
  config; `revert-agent.mjs --from-run <id>` PATCHes it back atomically.

## Compatibility gate

`diff-config.mjs` classifies every config-field change as Mutable / Restricted
/ Forbidden per EVAL-PLAN.md §G.2. `push-agent.mjs` runs it implicitly; you
can also run it standalone:

```bash
node test-suite/scripts/diff-config.mjs \
  test-suite/agent/config.json \
  runs/2026-06-24T10-15-22/agent-config.json
```

Exit: `0` mutable-only · `1` forbidden · `2` restricted · `4` invocation error.

## Promotion to production

After a passing eval, one script copies `test-suite/agent/config.json` into
the n8n workflow's embedded template:

```bash
node test-suite/scripts/promote-to-template.mjs           # dry-run
node test-suite/scripts/promote-to-template.mjs --confirm # actually PUT
```

This updates the `Build full agent payload` Code node in the n8n workflow
`Technical agent config` (id `EchzraagTgTF72DM`) so its embedded `TEMPLATE`
constant matches `test-suite/agent/config.json`. Future per-user agent
creates/updates that flow through n8n now use the new template.

**Prerequisite (one-time):** the Code node must first be refactored so the
template is a single JSON-parseable string (`const TEMPLATE = JSON.parse(...)`).
`n8n-simplify-template-node.mjs` does this one-time refactor. After that,
`promote-to-template.mjs` just swaps the JSON.

Full eval-then-promote chain:
```
edit test-suite/agent/config.json
  → push-agent.mjs --confirm           (PATCH test agent)
  → runner.mjs --all --yes             (eval; gate verdict in exit code)
  → if exit 0: promote-to-template.mjs --confirm   (PUT n8n template)
  → next time a user starts a session, n8n provisions them with the new template
```

Version gating for existing users (Batch 2 — pending):
Add `Agent.templateVersion Int` Prisma column + `TECHNICAL_AGENT_TEMPLATE_VERSION`
env var. Backend re-triggers n8n for stale agents on next session.
This is the only backend change needed in the whole eval/promote pipeline.

## Files

| Path | Purpose |
|------|---------|
| `bootstrap-agent.mjs`             | Seed `agent/config.json` from live test agent (one-time) |
| `push-agent.mjs`                  | Push `agent/config.json` → test agent (dry-run default) |
| `diff-config.mjs`                 | Classify changes between two configs as Mutable/Restricted/Forbidden |
| `revert-agent.mjs`                | PATCH test agent to a checkpoint or run snapshot |
| `n8n-simplify-template-node.mjs`  | One-time: refactor n8n Code node so its template is a single JSON-parseable string |
| `promote-to-template.mjs`         | After a passing eval: PUT `agent/config.json` into the n8n workflow's TEMPLATE |
| `lib/agent-api.mjs`               | Thin GET/PATCH wrapper for the test agent |
