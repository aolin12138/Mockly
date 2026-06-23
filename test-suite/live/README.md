# Live test harness

Runs scenarios against the **real** ElevenLabs interview agent over WebSocket (text-only mode). Captures `workflow_node_id` per turn, tool calls, and agent messages — data the simulate-only runner cannot provide.

## When to use live vs simulate

| | **Simulate** (`test-suite/runner.mjs`) | **Live** (`test-suite/live/runner.mjs`) |
|---|---|---|
| Speed | Fast (~5-10s per scenario) | Slower (~20-60s per conversation) |
| Cost | One API call per scenario | WS conversation + LLM calls |
| `workflow_node_id` | ❌ Always null | ✅ Real per-turn node IDs |
| MCP tool execution | ❌ | ✅ (real MCP server) |
| Client tool mocks | ✅ | ✅ |
| Prefilled history | ✅ | ❌ (skipped — live limitation) |
| Use case | Regression, batch runs, CI | Phase transition verification, MCP integration testing |

## Prerequisites

- `ELEVENLABS_PLATFORM_KEY` in `.env` (at project root)
- `VITE_GEMINI_API_KEY` in `.env` (for simulated user and judge)
- Node.js 18+ with fetch support

## Usage

```bash
# Run all non-prefilled scenarios
node test-suite/live/runner.mjs --all

# Run scenarios matching a tag
node test-suite/live/runner.mjs --tag understanding

# Run specific scenarios
node test-suite/live/runner.mjs --scenario clarify_problem,thinks_aloud_approach

# Dry run (estimate cost only)
node test-suite/live/runner.mjs --all --dry-run

# Skip cost confirmation
node test-suite/live/runner.mjs --scenario clarify_problem --yes

# Custom output path
node test-suite/live/runner.mjs --all --output my-report.html

# Increase timeout (seconds)
node test-suite/live/runner.mjs --all --timeout 180
```

## Run the spike (starting_workflow_node_id)

```bash
node test-suite/live/spike-node.mjs
```

Tests three candidate locations for `starting_workflow_node_id` in the WS initiation payload and reports which (if any) work. Results are documented in `CONFIG.md`.

## Files

| File | Purpose |
|------|---------|
| `runner.mjs` | CLI entry point — scenario loading, running, judging, reporting |
| `run-one.mjs` | Single-scenario WS conversation orchestrator |
| `ws-client.mjs` | Text-only WS client wrapping the ElevenLabs SDK |
| `null-audio.mjs` | No-op audio interface (required by SDK) |
| `sim-user.mjs` | Gemini-powered simulated candidate + judge |
| `judge.mjs` | Batch criteria evaluation against transcript |
| `verify.mjs` | Structural transcript assertions (tool calls, phase progression) |
| `spike-node.mjs` | Spike for `starting_workflow_node_id` WS acceptance |
| `_env.mjs` | `.env` file loader |
| `CONFIG.md` | Configuration reference and spike results |

## Known limitations (MVP)

1. **Gemini API key invalid** — The `VITE_GEMINI_API_KEY` in `.env` (`AIzaSyBfrchk9L3A0zoXP89BEkT4YKAiL57ep8M`) is rejected by the Gemini API. Until a valid key is provided, the sim-user falls back to placeholder messages and the judge cannot evaluate criteria.
2. **`starting_workflow_node_id` not accepted** — WS init doesn't support overriding the starting phase. All conversations start at Phase 1. Non-Phase-1 scenarios need a warm-up turn replay (out of MVP scope).
3. **Prefilled history scenarios skipped** — 12 of 18 scenarios have `partial_conversation_history` and cannot run live.
4. **No concurrency** — Runner processes scenarios sequentially (concurrency flag is reserved for future use).
5. **Tool calls** — Client tool mocks are registered but the SDK sends them via a Node.js event loop, which may interleave with conversation flow. MCP tools are not verified in MVP.

## Cost model

- Each WS conversation: ~1-2 cents in ElevenLabs credits (text-only, no TTS)
- Each sim-user/judge call: ~0.002 cents at Gemini 2.0 Flash pricing
- Total per scenario: ~2-5 cents
- Full run (6 scenarios): ~12-30 cents
