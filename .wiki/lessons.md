---
title: "Mockly — Lessons"
type: concept
updated: 2026-07-21
sources:
  - Pi session 2026-06-23
  - Pi session 2026-07-07 (behavioural eval + n8n restore)
  - Pi session 2026-07-21 (coaching feedback + quality criteria)
tags: [mockly, lessons, debugging, elevenlabs, evals]
---

# Mockly — Lessons

Project-specific lessons learned during development. General-purpose
debugging rules belong in `~/.pi/agent/skills/`, not here.

## ElevenLabs simulation API ≠ WebSocket API

**Don't assume parity.** The two APIs share agent configuration but
diverge on runtime behavior:

| Feature | Simulation API | WebSocket API |
|---------|---------------|---------------|
| MCP tool access | ❌ Not available | ✅ Available |
| `workflow_node_id` in transcript | Always `null` | Always `null` |
| `starting_workflow_node_id` override | Ignored | Works (with patch) |
| Audio | Skipped | Required (null audio interface for text-only) |

When porting a scenario from one to the other, run a side-by-side
behavior comparison first. We lost ~10 tool calls per assumption.

## `starting_workflow_node_id` injection requires monkey-patching `ws`

The ElevenLabs SDK's `webSocketFactory` option doesn't work for this
because the SDK uses the `ws` library's EventEmitter API (`.on()`,
`.emit()`), not browser WebSocket API (`.addEventListener()`). The
working pattern (in `test-suite/live/ws-client.mjs`):

```js
const WSModule = await import('ws');
const WsClass = WSModule.default || WSModule.WebSocket || WSModule;
const origSend = WsClass.prototype.send;
WsClass.prototype.send = function(data) {
  WsClass.prototype.send = origSend;  // self-restore after first call
  const msg = JSON.parse(data);
  if (msg.type === 'conversation_initiation_client_data') {
    msg.starting_workflow_node_id = nodeId;
    data = JSON.stringify(msg);
  }
  return origSend.call(this, data);
};
```

The patch self-restores after the first call so only the init message
is mutated. Verified working: `workflow_node_id` shows up in transcript
turns after this patch.

## MCP responses are double-wrapped

All MCP tool results have the shape:

```json
{
  "content": [{ "type": "text", "text": "<inner JSON string>" }],
  "isError": false
}
```

The outer `content[0].text` is itself a JSON string that has to be
parsed separately. Forgetting the second parse → "raw JSON dump in the
report" symptom. Pattern applies to all MCP tools from any provider.

## Skip-turn detection cuts conversation wait time 40×

Detecting `client_tool_call` events with `tool_name === 'skip_turn'`
and treating them as conversation-end signals reduced `awaitAgentReply`
wait from 120s to 3s. Most behavioral scenarios end with the agent
calling `skip_turn` rather than emitting a closing message.

## Test session IDs must be detectable in MCP server

Mock data path uses `sessionId` starting with `live-run-` or `test-`.
MCP server (`apps/backend/lib/mcp/tools.js`) returns hardcoded mock
code + test results for those prefixes instead of touching the DB.
Without this, every test scenario would require a real session row.

## Agent silence ≠ conversation timeout

The original harness waited 120s for the agent to reply when the agent
was in a "stay silent" state (Phase 2 monitoring). The fix: any of
three signals ends the wait early — `skip_turn` tool call, empty text
chunks, or 3s of silence after at least one chunk.

## Oversold sim-users crack under scripted escalation, not knowledge gaps

**Don't describe what the sim-user doesn't know.** An LLM sim-user given
"cannot explain X" will improvise a plausible explanation. The fix is a
three-level escalation scripted in exact wording:

```
Level 1 (first probe): VAGUE. "Standard evaluation pipeline." (no specifics)
Level 2 (second probe): DEFLECT to team. "Infra team handled the benchmarks."
Level 3 (third probe): ADMIT lack of involvement. "I wasn't directly involved."
```

This pattern (see `eval-harness-engineering.md §2`) was discovered after 3
rounds of oversold candidates passing tests they should have failed.

## ElevenLabs PATCH is not deep-merge — tools can only be set via UI

The `conversation_config` PATCH API replaces the entire config object.
A partial payload clears unmentioned fields — including tool configuration.
This means `skip_turn` cannot be enabled via API for the test agent; it
requires manual UI configuration. GET → merge → PUT the full config is
the workaround when API control is needed.

## Thought text leaks into transcript in text-only mode

DeepSeek reasoning tokens (injected when the interviewer "thinks") can
leak into text output. Patterns like "The candidate has described their
work..." appear mid-conversation. Fix: strip thinking markers before
transcript storage AND before the judge views it.

## $ref-based JSON replacement fails on unknown node IDs

When swapping OpenAI → DeepSeek in n8n workflows, `$ref` references to
`$node["<uuid>"].json` break if the model node ID changes. n8n's JSON
import format uses UUIDs for node references — replacing one node changes
all dependent $ref paths. The workaround: export the full workflow JSON,
find-and-replace the *model name* to change node type (DeepSeek supports
OpenAI-compatible endpoints with the same default node structure), rather
than replacing node definitions.

## Canonical prompt drift — the silent degradation

When two subsystems (backend and eval harness) read a prompt from different
sources (hardcoded string vs file), they **will** diverge. Within days, one
gets updated while the other doesn't. The fix: single file, read by both.
`apps/backend/prompts/behavioural_feedback.md` — edit once, both update.

## Eval harness first, sync to production after

Never change a production prompt without running the eval harness. The
canonical prompt drift was discovered precisely because the eval harness
caught a discrepancy (outdated "insufficient_data < 4 exchanges" rule
in the harness that the backend no longer had). Code gates are
non-negotiable; prompt rules drift silently.

## n8n database recovery — encryption keys change between containers

When `docker compose down` destroys the n8n container but the volume
persists, the encryption key stored in the container is lost. The next
`docker compose up` generates a new key, making all existing workflow
credentials undecryptable. Fix: export all workflows as JSON before
recreating containers; re-import after. The `.n8n/encryptionKey` file
in the volume is the only recovery path — back it up separately.

## Dashboard routing must use database, not heuristic inference

`isTechnicalFeedback()` inferred interview type from feedback structure
(dimensions array → technical, object → behavioural). But a behavioural
session with DeepSeek emitting array-format dimensions was incorrectly
routed to the technical results page. Database `interviewType` set at
session creation is the single source of truth.

## `let` shadowing in async callbacks — the invisible data loss

```js
let transcript = [];
// ...
conversation.on('message', (msg) => {
  let transcript = [];  // ← SHADOWS outer variable
  transcript.push({ role: 'user', text: msg.text });
});
// outer transcript is still []
```

Never shadow mutable accumulators in async callbacks. Use distinct names
or `result.push()` on a single reference.

## See also

- [overview](overview.md)
- [decisions](decisions.md)
- [test-suite](test-suite.md)
- [status](status.md)
- [eval-harness-engineering](eval-harness-engineering.md)
