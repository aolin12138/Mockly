# Live test harness configuration

## API keys

| Key | Source | Used for |
| --- | --- | --- |
| `ELEVENLABS_PLATFORM_KEY` | `.env` | WebSocket conversations, transcript fetch |
| `VITE_GEMINI_API_KEY` | `.env` | Simulated user, judge evaluation |

## Agent under test

- **ID:** `agent_2201ktp0n7mwek6avkphs4x6394m`
- **Branch:** `agtbrch_1301ktp0n97rfn4tkjz5626383hm`

## Phase node IDs

| Phase | Node ID |
|-------|---------|
| 1 (Understanding) | `node_01ksvy7ntre8gsanne5tj7kmca` |
| 2 (Implementation) | `node_01ksvyddppe8gsannvqqc66p4w` |
| 3 (Time Pressure) | `node_01ksvyftate8gsanp9mkqw49tf` |
| 4 (Assessment) | `node_01kt35w596exs8pbna62db1zkr` |

## Spike results (2026-06-17)

`starting_workflow_node_id` was tested at three locations in the WS init payload:

| Location | Works? |
|----------|--------|
| `custom_llm_extra_body.starting_workflow_node_id` | ❌ No |
| `conversation_config_override.conversation.starting_workflow_node_id` | ❌ No |
| `conversation_config_override.agent.starting_workflow_node_id` | ❌ No |

**Conclusion:** The ElevenLabs WebSocket protocol does not accept `starting_workflow_node_id` from the client for this agent. All conversations start at Phase 1 regardless. For non-Phase-1 scenarios, the warm-up turn fallback (send pre-messages to drive the agent to the target phase) is required, but out of MVP scope.

## Scenario filtering

Scenarios with `partial_conversation_history` (12 of 18) are skipped in live mode because the WS protocol does not support prefilled history. The 6 runnable scenarios:

- `clarify_problem`
- `thinks_aloud_approach`
- `filler_stays_silent`
- `directed_request_for_time`
- `garbled_term_not_echoed`
- `transitions_phase1_understanding`
