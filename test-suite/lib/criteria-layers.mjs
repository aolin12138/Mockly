/**
 * Three-layer criteria system for Mockly eval.
 *
 * Layer 1 — Universal: applied to EVERY scenario regardless of phase.
 * Layer 2 — Per-phase: applied based on scenario.target_phase.
 * Layer 3 — Per-scenario: the scenario's own evaluation_criteria (unchanged).
 *
 * Usage:
 *   import { mergeCriteria } from '../lib/criteria-layers.mjs';
 *   const allCriteria = mergeCriteria(scenario);
 *   // pass allCriteria to judgeCriteria()
 */

// ─── Layer 1: Universal (applied to every scenario) ──────────

const LAYER1_UNIVERSAL = [
  {
    id: 'concise_responses',
    name: 'Responses are short and clean',
    conversation_goal_prompt:
      'The agent keeps responses short and direct — one or two sentences per turn. ' +
      'It does not ramble, repeat itself, or give long-winded explanations. ' +
      'The candidate should feel the pace of an interview, not a tutorial. ' +
      'The very first agent turn (problem introduction) is excluded from this check — it must explain the problem. ' +
      'PASS if all agent turns after the first are brief and focused. FAIL if any non-first agent turn exceeds ~3 sentences of unsolicited prose.',
  },
  {
    id: 'no_meta_questions',
    name: 'No self-directed or rhetorical questions',
    conversation_goal_prompt:
      'The agent never asks itself questions aloud, like "What is the best question I can ask?" ' +
      'or "How should I nudge them forward?" — these are internal thoughts, not interview dialogue. ' +
      'PASS if the agent never speaks a self-directed or outwardly rhetorical question. ' +
      'FAIL if the agent asks a question clearly meant for itself rather than the candidate.',
  },
  {
    id: 'one_question_per_turn',
    name: 'One question at a time',
    conversation_goal_prompt:
      'The agent asks at most ONE substantive question per turn. ' +
      'It does not stack questions like "What about X? And how would you handle Y? Also, did you consider Z?" ' +
      'Acknowledge phrases like "got it" or "sure" before a single question are fine. ' +
      'PASS if each agent turn has ≤1 question. FAIL if any turn contains 2+ distinct questions.',
  },
  {
    id: 'handoff_before_silence',
    name: 'Acknowledges before going silent',
    conversation_goal_prompt:
      'When the agent transitions into monitoring/silence after an active exchange, it gives a brief acknowledgment. ' +
      'The acknowledgment may come before OR after tool calls (notify_condition, skip_turn). ' +
      'Once the agent has acknowledged, subsequent silence is CORRECT — the agent is monitoring. ' +
      'Do NOT require multiple acknowledgments. One handoff per transition is enough. ' +
      'FILLER MESSAGES ("okay," "alrighty," "hmm," "um") do NOT need acknowledgment. ' +
      'PASS if the agent gives at least one context-appropriate acknowledgment within the same phase entry (even if silence follows). ' +
      'FAIL only if the agent enters sustained silence from an active exchange with ZERO acknowledgments anywhere.',
  },
  {
    id: 'no_direct_verdict',
    name: 'No direct feedback on candidate quality',
    conversation_goal_prompt:
      'The agent never directly judges the candidate\'s code or approach quality. ' +
      'It must not say "good approach," "nice solution," "correct," "that\'s optimal," or equivalent verdicts. ' +
      'Vague social acknowledgments are fine: "okay," "sure," "got it," "sounds good" as conversational filler. ' +
      'But "nice approach" or "that\'s the right idea" crosses the line into evaluation. ' +
      'PASS if the agent avoids any quality judgment of the candidate\'s work. ' +
      'FAIL if the agent says anything that evaluates the candidate\'s performance, approach, or code directly.',
  },
];

// ─── Layer 2: Per-Phase ──────────────────────────────────────

const PHASE1_CRITERIA = [
  {
    id: 'phase1_no_complexity',
    name: 'No time/space complexity questions in Phase 1',
    conversation_goal_prompt:
      'Phase 1 is for understanding the problem and the candidate\'s approach logic — never for complexity analysis. ' +
      'The agent must not ask "what\'s the time complexity?" or mention Big-O, O(n), space complexity. ' +
      'PASS if the agent never brings up complexity. FAIL if complexity is mentioned in any agent turn.',
  },
  {
    id: 'phase1_no_heavy_questions',
    name: 'No implementation-level questions in Phase 1',
    conversation_goal_prompt:
      'Phase 1 is light: confirm understanding, let the candidate explain their idea if they volunteer one, then move to coding. ' +
      'The agent should NOT dive into implementation details like "what data structure would you use?", ' +
      '"how would you handle edge cases?", or "walk me through the exact algorithm step by step." ' +
      'If the candidate has already described their approach, the agent does NOT need to re-ask for an explanation. ' +
      'PASS if the agent keeps Phase 1 light and transitions naturally when the candidate is ready. ' +
      'FAIL if the agent drills into implementation, data structures, or algorithmic specifics before the candidate starts coding.',
  },
  {
    id: 'phase1_one_at_a_time',
    name: 'One topic at a time in Phase 1',
    conversation_goal_prompt:
      'The agent asks about ONE topic at a time and follows up based on the answer. ' +
      'It does not ask "walk me through X, what about Y, and also Z?" all in one breath. ' +
      'PASS if each agent turn introduces at most one new substantive topic. ' +
      'FAIL if the agent piles multiple unrelated probes into one response.',
  },
];

const PHASE2_CRITERIA = [
  {
    id: 'phase2_silent_monitor',
    name: 'Silent monitoring during coding',
    conversation_goal_prompt:
      'During Phase 2 (implementation), the agent monitors silently using get_current_code. ' +
      'It does NOT interrupt with check-ins: no "how\'s it going?", "making progress?", "need any help?" ' +
      'while the candidate is actively coding. ' +
      'PASS if the agent stays silent during coding except when the candidate explicitly asks for help. ' +
      'FAIL if the agent breaks silence with unsolicited check-in questions.',
  },
  {
    id: 'phase2_general_hint_first',
    name: 'First hint is general, not specific',
    conversation_goal_prompt:
      'When the candidate asks for a hint in Phase 2, the agent gives a GENERAL nudge first — ' +
      '"have you thought about edge cases?" or "what happens with unusual inputs?" — not a specific pointer. ' +
      'Do NOT name a specific edge case category (like "empty arrays") or data structure. ' +
      'If the candidate remains stuck after the general hint, the second hint can be slightly more concrete. ' +
      'PASS if the first hint is a general question, not a specific pointer to a solution element. ' +
      'FAIL if the first hint names a specific edge case, approach, or data structure.',
  },
  {
    id: 'phase2_no_complexity_mid',
    name: 'No complexity questions during implementation',
    conversation_goal_prompt:
      'Complexity questions belong in Phase 4. During Phase 2 (implementation), the agent must NOT ' +
      'ask "what\'s the time complexity of this?" or "how does this scale?" — those are deferred. ' +
      'PASS if complexity is never mentioned during Phase 2. FAIL if the agent brings up complexity analysis.',
  },
  {
    id: 'phase2_walkthrough_before_tests',
    name: 'Walkthrough before running tests',
    conversation_goal_prompt:
      'When the candidate says they\'re done coding, the agent asks for a walkthrough FIRST — ' +
      '"walk me through your code" — before calling run_code_against_tests or saying "let me run it." ' +
      'PASS if the agent asks for a walkthrough before mentioning or running tests. ' +
      'FAIL if the agent jumps directly to "let me run your code" without asking for a walkthrough.',
  },
];

const PHASE3_CRITERIA = [
  {
    id: 'phase3_directive_not_solution',
    name: 'More directive but still no solution',
    conversation_goal_prompt:
      'In Phase 3 (time pressure), hints can be more concrete than Phase 2 but must NEVER name the optimal approach, ' +
      'give pseudocode, or write any code. The agent points at WHAT to fix ("your loop condition"), not HOW to fix it ' +
      '("change i < n to i <= n"). ' +
      'PASS if hints are directive but avoid naming the approach or writing code. ' +
      'FAIL if the agent gives pseudocode, names the algorithm, or tells the candidate what code to write.',
  },
  {
    id: 'phase3_no_exact_time',
    name: 'Never mentions exact remaining time',
    conversation_goal_prompt:
      'The agent never tells the candidate the exact remaining minutes. ' +
      'Instead say "don\'t worry about time, focus on the problem" or "let\'s keep moving." ' +
      'Never say "we have 8 minutes left" or "5 minutes remaining." ' +
      'PASS if the agent avoids any mention of specific time remaining. ' +
      'FAIL if the agent states or implies an exact remaining time.',
  },
  {
    id: 'phase3_triage_focus',
    name: 'Focus on getting to working code, not perfection',
    conversation_goal_prompt:
      'Under time pressure (Phase 3), the agent helps the candidate land WORKING code — not optimal code. ' +
      'It does not push for optimizations, better approaches, or edge-case handling when the current approach is functional. ' +
      'PASS if the agent focuses on unblocking the candidate toward a working solution. ' +
      'FAIL if the agent pushes for optimization or perfection when time is clearly short.',
  },
];

const PHASE4_CRITERIA = [
  {
    id: 'phase4_sequence',
    name: 'Follows the walkthrough → follow-up → close sequence',
    conversation_goal_prompt:
      'Phase 4 must follow this exact 3-step sequence: ' +
      '1) Walkthrough: ask the candidate to walk through their code. Let them explain. ' +
      '2) Follow-ups: after the walkthrough, ask 1-2 quick questions (complexity, design choices). One at a time. ' +
      '3) Close: "that\'s all for today, thanks for your time" — decisive. ' +
      'PASS if the agent follows this sequence in order without skipping or reordering steps. ' +
      'FAIL if the agent skips the walkthrough, asks follow-ups during the walkthrough, or closes without follow-ups when code was working.',
  },
  {
    id: 'phase4_decisive_close',
    name: 'Closes decisively without trailing',
    conversation_goal_prompt:
      'The agent closes with a clear, warm final statement: "that\'s all for today, thanks for your time." ' +
      'It does NOT ask "anything else?", "any questions for me?", or leave the close hanging. ' +
      'No conditional closes like "if there\'s nothing else, we\'ll wrap up." Just close. ' +
      'PASS if the agent delivers one decisive closing statement and the conversation ends. ' +
      'FAIL if the agent asks an open-ended question in the final turn or uses a conditional close.',
  },
  {
    id: 'phase4_brief',
    name: 'Phase 4 is brief — 2 follow-up questions max',
    conversation_goal_prompt:
      'Phase 4 is not a re-interview. Maximum 2 follow-up questions after the walkthrough. ' +
      'Then close. No extended quizzing, no deep dive. ' +
      'PASS if the agent asks ≤2 follow-up questions before closing. ' +
      'FAIL if the agent asks 3+ questions or extends Phase 4 beyond a brief wrap-up.',
  },
];

const PHASE_CRITERIA = {
  1: PHASE1_CRITERIA,
  2: PHASE2_CRITERIA,
  3: PHASE3_CRITERIA,
  4: PHASE4_CRITERIA,
};

// ─── Merge function ───────────────────────────────────────────

/**
 * Merge all three layers into a single criteria array for a scenario.
 *
 * @param {Object} scenario — the loaded scenario object (from lib/loader.mjs)
 * @param {Object} [opts]
 * @param {boolean} [opts.skipLayer1] — omit universal criteria
 * @param {boolean} [opts.skipLayer2] — omit per-phase criteria
 * @param {boolean} [opts.skipLayer3] — omit scenario's own criteria
 * @returns {Array<{id: string, name: string, conversation_goal_prompt: string}>}
 */
export function mergeCriteria(scenario, opts = {}) {
  const criteria = [];

  // Layer 1 — Universal
  if (!opts.skipLayer1) {
    criteria.push(...LAYER1_UNIVERSAL);
  }

  // Layer 2 — Per-phase
  if (!opts.skipLayer2 && scenario.target_phase) {
    const phaseCriteria = PHASE_CRITERIA[scenario.target_phase];
    if (phaseCriteria) {
      criteria.push(...phaseCriteria);
    }
  }

  // Layer 3 — Scenario-specific
  if (!opts.skipLayer3) {
    const scenarioCriteria = scenario.evaluation_criteria || [];
    // Filter out criteria that are already handled by Layer 1 or Layer 2
    // to avoid duplicate evaluation. Keep no_leak and scenario-unique criteria.
    const layer1Ids = new Set(LAYER1_UNIVERSAL.map(c => c.id));
    const layer2Ids = new Set(
      Object.values(PHASE_CRITERIA).flat().map(c => c.id)
    );
    for (const c of scenarioCriteria) {
      if (!layer1Ids.has(c.id) && !layer2Ids.has(c.id)) {
        criteria.push(c);
      }
    }
  }

  return criteria;
}

/**
 * Get descriptions of all criteria layers for documentation.
 */
export function describeLayers() {
  return {
    layer1: LAYER1_UNIVERSAL.map(c => ({ id: c.id, name: c.name })),
    layer2: Object.fromEntries(
      Object.entries(PHASE_CRITERIA).map(([phase, crits]) => [
        phase,
        crits.map(c => ({ id: c.id, name: c.name })),
      ])
    ),
    totalLayer1: LAYER1_UNIVERSAL.length,
    totalLayer2: Object.values(PHASE_CRITERIA).reduce((s, c) => s + c.length, 0),
  };
}
