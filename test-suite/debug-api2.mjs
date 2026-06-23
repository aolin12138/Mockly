/**
 * Phase 0 — Schema-corrected simulation test
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
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// The simulated_user_config is an AgentConfig, which wraps the prompt
// in a nested object. The Python SDK example shows:
//   AgentConfig(prompt=PromptAgent(prompt="...", llm="gpt-4o", temperature=0.5))
// So the JSON is: { prompt: { prompt: "...", llm: "...", temperature: ... } }

async function testSchema(agentId, label, body) {
  console.log(`\n─── Test: ${label} ───`);
  const { status, ok, body: resp } = await call(
    `/convai/agents/${agentId}/simulate-conversation`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  console.log(`  Status: ${status} ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) {
    console.log(`  Error: ${JSON.stringify(resp).slice(0, 400)}`);
  } else {
    const turns = resp.simulated_conversation?.length || 0;
    console.log(`  Turns: ${turns}`);
    console.log(`  Call successful: ${resp.analysis?.call_successful}`);
    for (const cr of (resp.analysis?.evaluation_criteria_results_list || [])) {
      console.log(`  Criterion ${cr.criteria_id}: ${cr.result} — ${cr.rationale?.slice(0, 100) || ''}`);
    }
    // Show first 2 turns
    for (const turn of (resp.simulated_conversation || []).slice(0, 4)) {
      const role = turn.role || '?';
      const msg = turn.message || '(no message)';
      console.log(`  [${role}] ${msg.slice(0, 150)}`);
    }
  }
  return ok;
}

// Test 1: Correct nested prompt structure, no tool mocks, simple greeting
const ok1 = await testSchema(AGENT, 'Nested prompt (AgentConfig style)', {
  simulation_specification: {
    simulated_user_config: {
      prompt: {
        prompt: "You are a candidate in a coding interview. Say 'Hi, I'm ready to start.' and wait for the interviewer.",
        llm: "gpt-4o",
        temperature: 0.3
      }
    },
    dynamic_variables: { remaining_minutes: 30 }
  },
  extra_evaluation_criteria: [
    {
      id: "greeted",
      name: "Agent Greeted",
      conversation_goal_prompt: "The agent greeted the candidate naturally. PASS if they acknowledged the greeting or started the interview.",
      use_knowledge_base: false
    }
  ],
  new_turns_limit: 4
});

// Test 2: Try with partial_conversation_history for first_message
if (!ok1) {
  console.log('\n─── Trying alternative: first_message via partial_conversation_history ───');
  const { status, ok, body } = await call(
    `/convai/agents/${AGENT}/simulate-conversation`,
    {
      method: 'POST',
      body: JSON.stringify({
        simulation_specification: {
          simulated_user_config: {
            prompt: {
              prompt: "You are a candidate in a coding interview. Continue the conversation naturally.",
              llm: "gpt-4o",
              temperature: 0.3
            }
          },
          partial_conversation_history: [
            {
              role: "user",
              message: "Hi, I'm ready to start."
            }
          ],
          dynamic_variables: { remaining_minutes: 30 }
        },
        extra_evaluation_criteria: [
          {
            id: "greeted",
            name: "Agent Greeted",
            conversation_goal_prompt: "The agent greeted the candidate naturally. PASS if they acknowledged the greeting.",
            use_knowledge_base: false
          }
        ],
        new_turns_limit: 4
      })
    }
  );
  console.log(`  Status: ${status}`);
  if (ok) {
    console.log(`  Turns: ${body.simulated_conversation?.length || 0}`);
  } else {
    console.log(`  Error: ${JSON.stringify(body).slice(0, 500)}`);
  }
}

// Test 3: Try with text_only agent - check if we can find or create one
console.log('\n─── Checking if any agents support text_only ───');
const { body: agents } = await call('/convai/agents');
if (Array.isArray(agents?.agents)) {
  for (const a of agents.agents.slice(0, 5)) {
    console.log(`  ${a.agent_id}: ${a.name} (text_only: ${a.conversation_config?.conversation?.text_only})`);
  }
}
