/**
 * Phase 0 — Test tool mocking with correct schema
 * Real tool names: getEditorState, run_code_against_tests, completeInterview, getCreditStatus
 */

import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('../.env', 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0,i).trim()] = t.slice(i+1).trim();
}

const BASE = 'https://api.elevenlabs.io/v1';
const AK = env.ELEVENLABS_PLATFORM_KEY;
const AGENT = env.TECHNICAL_INTERVIEW_AGENT_ID;

async function call(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'xi-api-key': AK, 'Content-Type': 'application/json', ...options.headers }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ─── Test tool mocking with a "done" scenario ───
// Agent should call getEditorState to check code, then maybe run_code_against_tests
console.log('═══ Testing tool_mock_config ═══\n');

const body = {
  simulation_specification: {
    simulated_user_config: {
      prompt: {
        prompt: "You are a coding interview candidate. You've been working on a problem and you just finished your solution. Say 'I think I'm done — can you check my solution?' and then wait for the interviewer to respond. When they ask you to walk through it, briefly explain your approach and then wait.",
        llm: "gpt-4o",
        temperature: 0.3
      }
    },
    tool_mock_config: {
      getEditorState: {
        type: "client",
        return: JSON.stringify({
          code: "def find_max_subarray_sum(nums):\n    max_sum = nums[0]\n    cur_sum = 0\n    for n in nums:\n        cur_sum = max(cur_sum + n, n)\n        max_sum = max(max_sum, cur_sum)\n    return max_sum",
          language: "python",
          remaining_minutes: 15,
          hintCount: 0
        })
      },
      run_code_against_tests: {
        type: "client",
        return: JSON.stringify({
          passedTests: 12,
          totalTests: 12,
          allPassed: true,
          failureCategory: "",
          compilationError: null,
          remainingMinutes: 15
        })
      }
    },
    dynamic_variables: {
      remaining_minutes: "15"
    }
  },
  extra_evaluation_criteria: [
    {
      id: "asks_walkthrough",
      name: "Asks for walkthrough",
      conversation_goal_prompt: "The agent asked the candidate to walk through their solution rather than summarizing it back. PASS if it invited the candidate to explain.",
      use_knowledge_base: false
    },
    {
      id: "no_verdict",
      name: "No verdict given",
      conversation_goal_prompt: "The agent did NOT give a correctness verdict like 'your solution is correct' or 'this works'. PASS if it avoided declaring the solution correct.",
      use_knowledge_base: false
    }
  ],
  new_turns_limit: 6
};

try {
  const resp = await call(
    `/convai/agents/${AGENT}/simulate-conversation`,
    { method: 'POST', body: JSON.stringify(body) }
  );

  console.log(`Status: ${resp.analysis?.call_successful || 'unknown'}`);
  console.log(`Turns: ${resp.simulated_conversation?.length || 0}\n`);

  console.log('─── Transcript ───');
  for (const turn of (resp.simulated_conversation || [])) {
    const role = turn.role || '?';
    const msg = turn.message || '';
    
    // Show tool calls
    if (turn.tool_calls?.length) {
      for (const tc of turn.tool_calls) {
        console.log(`[${role}] → ${tc.tool_name}(${tc.params_as_json?.slice(0, 80) || ''})`);
      }
    }
    // Show tool results
    if (turn.tool_results?.length) {
      for (const tr of turn.tool_results) {
        const mockReturned = tr.result_value ? JSON.parse(tr.result_value) : null;
        const summary = mockReturned 
          ? `code_len=${mockReturned.code?.length || 0}, passed=${mockReturned.passedTests}/${mockReturned.totalTests}`
          : '(empty)';
        console.log(`[${role}] ← ${tr.tool_name}: ${summary}`);
      }
    }
    // Show message
    if (msg) {
      console.log(`[${role}] ${msg.slice(0, 200)}`);
    }
  }

  console.log('\n─── Evaluation ───');
  for (const cr of (resp.analysis?.evaluation_criteria_results_list || [])) {
    console.log(`  ${cr.result === 'success' ? '✓' : '✗'} ${cr.criteria_id}: ${cr.rationale?.slice(0, 200) || ''}`);
  }

  // Cost
  let totalTokens = 0;
  for (const turn of (resp.simulated_conversation || [])) {
    if (turn.llm_usage?.model_usage) {
      for (const [model, usage] of Object.entries(turn.llm_usage.model_usage)) {
        totalTokens += (usage.total_tokens || 0);
      }
    }
  }
  console.log(`\nEstimated tokens: ${totalTokens}`);

} catch (e) {
  console.error('FATAL:', e.message);
}
