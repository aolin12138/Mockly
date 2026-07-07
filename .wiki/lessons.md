---
title: "Mockly — Lessons"
type: concept
updated: 2026-06-23
sources:
  - Pi session 2026-06-23
tags: [mockly, lessons, debugging, elevenlabs]
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

## See also

- [overview](overview.md)
- [decisions](decisions.md)
- [test-suite](test-suite.md)
- [status](status.md)
