---
title: "Mockly — Test Suite"
type: concept
updated: 2026-06-23
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/live/
  - Pi session 2026-06-23
tags: [mockly, test-suite, elevenlabs, agent-testing]
---

# Mockly — Test Suite

Comprehensive scenario-based test harness for the Mockly ElevenLabs
technical interview agent.

## Overview

- **Agent under test**: `agent_2201ktp0n7mwek6avkphs4x6394m`
- **Branch**: `agtbrch_1301ktp0n97rfn4tkjz5626383hm` (main)
- **Test type**: Live WebSocket text-only conversations
- **Sim-user LLM**: DeepSeek `deepseek-chat` (V3), temperature 0.3
- **Judge LLM**: DeepSeek `deepseek-v4-pro` with `think-high`, temperature 0.0

## Architecture

```
test-suite/
├── live/                  # Live WebSocket harness
│   ├── runner.mjs         # Orchestrator — loads scenarios, runs concurrently
│   ├── run-one.mjs        # Single-scenario runner
│   ├── ws-client.mjs      # ElevenLabs WS client (text-only, no audio)
│   ├── sim-user.mjs       # DeepSeek-simulated candidate
│   ├── judge.mjs          # DeepSeek evaluation against criteria
│   ├── verify.mjs         # Preflight checks
│   └── null-audio.mjs     # Null audio interface (text-only)
├── scenarios/             # 18 scenario JSON files
├── lib/                   # Shared: config, checkpoint, report, loader
├── runner.mjs             # Original simulation runner (limited — no MCP tools)
└── live-report.html       # Latest test run output
```

## Scenarios

18 scenarios covering agent behavior across 4 interview phases:

| Scenario | Phase | Status |
|----------|-------|--------|
| `clarify_problem` | 1 — Understanding | ✅ Pass (3/3) |
| `thinks_aloud_approach` | 1 | ❌ Fail (leaks solution) |
| `filler_stays_silent` | 1 | ✅ Pass (2/2) |
| `directed_request_for_time` | 1 | ❌ Fail (silent, no ack) |
| `garbled_term_not_echoed` | 1 | ✅ Pass (2/2) |
| `hint_general_first` through `closes_and_ends` | 1–4 | ⏭ 12 skipped (partial_conversation_history) |
| `transitions_phase1_understanding` | 1–2 | ❌ Fail |

## Technical discoveries

### WebSocket injection
`starting_workflow_node_id` can be injected by monkey-patching
`ws.WebSocket.prototype.send` before `Conversation.startSession()`.
The SDK's `webSocketFactory` option does not work because the SDK
uses the `ws` library's EventEmitter API (`.on()`) rather than
browser WebSocket.

### API limitations
- `workflow_node_id` is always `null` in both simulation and WebSocket transcripts
- Simulation API does not expose MCP tools to the agent
- `starting_workflow_node_id` is ignored by the simulation API

### Skip-turn detection
Detecting `client_tool_call` events with `tool_name === 'skip_turn'`
reduces conversation wait time from 120s to 3s per turn.

### MCP response format
MCP tool results are wrapped: `{ content: [{ type: "text", text: "..." }], isError }` —
the inner `text` must be JSON-parsed separately to access actual tool data.

## Running

```bash
cd test-suite
node live/runner.mjs --all --yes          # all scenarios
node live/runner.mjs --scenario clarify_problem --yes  # single
```

## See also

- [overview](overview.md)
- [status](status.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
