# Mockly Interview Agent — Iteration Log

## Outcome: 11/18 pass (from 2/6 baseline)
- **Agent:** `agent_2201ktp0n7mwek6avkphs4x6394m` · v `agtvrsn_1801kvpvrrtdehxssrece4mhg8zc`
- **Cost:** ~$6.00 total across 9 runs
- **Time:** ~3.5 hours of clock time
- **Gate:** exit 1 (regression) — directed_request_for_time stochastic fail holds us from 12/18 promotable

## Run history

| # | Pass | Δ | Key change |
|---|---|---|---|
| 1 | 2/6 | — | Raw harness baseline |
| 2 | 4/6 | +2 | Fixed judge token limit (1024→8192) + skip_turn reset |
| 3 | 3/6 | -1 | Added silence rules — introduced contradiction (2 regressions) |
| 4 | 4/6 | +1 | Fixed contradiction + complexity rule |
| 5 | 6/6 | +2 | **Phase 1 locked** — consolidated filler+ack into single decision-tree rule |
| 6 | 9/18 | +3 | Warm-up injection unblocked 12 Phase 2-4 scenarios; +Phase 2 etiquette |
| 7 | 8/18 | -1 | Added text → diluted hints → leaks returned |
| 8 | 10/18 | +2 | Consolidated all leak rules into one Hard Rules block (subtractive) |
| 9 | 11/18 | +1 | **Per-phase prompts** — shortened 2/3/4 by 40-75%, fixed Phase 2 leaks |

## What moved

| Scenario | Baseline | Final | Notes |
|---|---|---|---|
| Phase 1 — clarify_problem | ✓ | ✓ | Stable |
| Phase 1 — thinks_aloud_approach | ✗ (judge empty) | ✓ | Fixed by judge token fix + consolidation |
| Phase 1 — filler_stays_silent | ✗ | ✓ | Silence consolidation worked |
| Phase 1 — directed_request_for_time | ✗ | ✗ | **Stochastic** — passes ~60%, hard to pin down |
| Phase 1 — garbled_term_not_echoed | ✗ | ✓ | Sim-user sees skip_turn correctly now |
| Phase 1 — transitions_phase1 | ✓ | ✓ | Stable |
| Phase 2 — hint_general_first | ⏭ | ✓ | Warm-up unblocked + per-phase fix |
| Phase 2 — hint_escalates | ⏭ | ✓ | Stable |
| Phase 2 — silent_coding_no_nag | ⏭ | ✓ | Fixed by per-phase monitor-silently rule |
| Phase 2 — done_asks_walkthrough | ⏭ | ✗→⚠ | **Conversation error** — WS timeout, not agent |
| Phase 2 — done_edge_fail_one_nudge | ⏭ | ✗ | Lists multiple edge cases still |
| Phase 2 — transitions_phase2 | ⏭ | ✓ | Fixed |
| Phase 3 — complexity_not_in_impl | ⏭ | ✓ | Stable |
| Phase 3 — late_unsolved | ⏭ | ✗ | Phase 3 leaks persist under time pressure |
| Phase 3 — refuses_to_give_answer | ⏭→✗ | ✓ | Fixed by per-phase no-pseudocode rule |
| Phase 4 — assessment_asks_directly | ⏭→✗ | ✗ | Behaviour issue, not leak |
| Phase 4 — closes_and_ends | ⏭ | ✗ | Behaviour issue |
| Phase 4 — transitions_phase3 | ⏭ | ✗ | Phase 3→4 transition not smooth |

## Prompt changes — net diff from baseline

**System prompt:** 9267 → 9835 (+568)
- Consolidated all leak/no-narrate/no-judge rules into one Hard Rules block
- Consolidated filler vs directed-request into single decision-tree
- Added "don't ask complexity before coding"
- Added Phase 2 monitoring rules

**Per-phase prompts (net shorter):**
- Phase 2: 2274 → 967 (-57%) — focused on silent monitoring + general hints only
- Phase 3: 1469 → 855 (-42%) — focused on triage, no exact time, still no leaks
- Phase 4: 2297 → 586 (-74%) — focused on brief close, no judge/score

## Key discoveries

1. **Consolidation > addition.** Every additive edit caused regressions in other scenarios. The best gains came from consolidating scattered rules into one short block.
2. **Per-phase prompts are the correct granularity.** Phase-specific rules (don't ask complexity in Phase 2, don't name time in Phase 3) belong in the per-phase additional_prompt — they fire when relevant and don't dilute other phases.
3. **"Don't" rules lose to instinct under pressure.** Even with explicit "NEVER" rules, agents under time-pressure scenarios leak pseudocode. The per-phase prompts help but don't fully solve this.
4. **Stochastic failures are real.** directed_request_for_time passes ~60% of runs — the agent's behaviour varies slightly due to sim-user variance (temp 0.3), producing different preceding context.
5. **Judge token budget was the root cause of the first empty-response bug** (fixed: 1024→8192 for thinking mode).

## Remaining gaps (6 scenarios)

| Scenario | Root cause | Fix difficulty |
|---|---|---|
| directed_request_for_time | Stochastic — brief ack sometimes missing | Medium (decision-boundary ambiguity) |
| done_asks_walkthrough | Conversation error (WS timeout) — not agent | Harness timeout |
| done_but_edge_fail_one_nudge | Agent lists edge case categories | Medium (per-phase nudge rule) |
| assessment_asks_directly | Behaviour — Phase 4 wrap-up | Medium (per-phase prompt) |
| late_unsolved_more_directive | Phase 3 leak under pressure | Hard (instinct override) |
| closes_and_ends + transitions_phase3 | Phase 3→4 transition | Medium |

## Files changed

```
test-suite/lib/auto-sync.mjs          — NEW: syncAgent() shared by runner + push
test-suite/lib/diff-classify.mjs      — NEW: extracted from diff-config (importable)
test-suite/lib/agent-api.mjs          — moved from scripts/lib/, shared
test-suite/lib/run-output.mjs         — NEW: run folder pipeline + gate logic
test-suite/live/runner.mjs            — +auto-sync, -output flag, warm-up support
test-suite/live/run-one.mjs           — warm-up phase, tool-call annotations
test-suite/live/ws-client.mjs         — skip_turn reset, title injection
test-suite/live/sim-user.mjs          — tool annotations, judge tokens 8192
test-suite/scripts/bootstrap-agent.mjs
test-suite/scripts/push-agent.mjs     — now thin wrapper over syncAgent
test-suite/scripts/diff-config.mjs    — thin CLI over lib/diff-classify
test-suite/scripts/revert-agent.mjs
test-suite/scripts/n8n-simplify-template-node.mjs  — NEW (not yet executed)
test-suite/scripts/promote-to-template.mjs         — NEW (not yet executed)
test-suite/agent/config.json          — source of truth agent config
test-suite/scenarios/06-18/*.json     — 12 converted: partial_history → warm_up
test-suite/runs/INDEX.md              — 9 runs tracked
```

## Promotion readiness

The test agent now has 11/18 passing config. To promote (when ready):
1. `node test-suite/scripts/n8n-simplify-template-node.mjs --confirm` (one-time)
2. `node test-suite/scripts/promote-to-template.mjs --confirm`
3. Real users get the new config on next session start (via n8n)
