/**
 * Phase 0 — Pre-flight API verification
 * 
 * Discovers:
 * 1. Real tool names for the agent (for tool_mock_config keys)
 * 2. Whether simulate-conversation works end-to-end
 * 3. Whether sequence/conditional mocks are supported
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (dotenv is a devDependency)
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

const CONFIG = {
  agentId: env.TECHNICAL_INTERVIEW_AGENT_ID || 'agent_6601kc3hn3b8fbv9p4hpskza0qgm',
  apiKey: env.ELEVENLABS_PLATFORM_KEY || env.VITE_ELEVENLABS_API_KEY,
  baseUrl: 'https://api.elevenlabs.io/v1',
};

async function apiRequest(path, options = {}) {
  const url = `${CONFIG.baseUrl}${path}`;
  const headers = {
    'xi-api-key': CONFIG.apiKey,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${options.method || 'GET'} ${path}: ${JSON.stringify(body)}`);
  }
  return { status: res.status, body };
}

// ─── STEP 1: Discover agent's tool names ────────────────────────
async function discoverTools() {
  console.log('\n═══ STEP 1: Discover agent tool names ═══');
  try {
    // Get agent details — the tools should be in the response
    const { body } = await apiRequest(`/convai/agents/${CONFIG.agentId}`);

    // Try multiple paths where tools might be
    const found = [];

    // Path A: platform_settings.tool_configurations
    const toolConfigs = body?.platform_settings?.tool_configurations;
    if (Array.isArray(toolConfigs)) {
      for (const tc of toolConfigs) {
        found.push({ id: tc.tool_id, name: tc.name, type: tc.type });
      }
    }

    // Path B: conversation_config.agent.prompt.tool_ids + top-level tools
    const toolIds = body?.conversation_config?.agent?.prompt?.tool_ids || [];
    if (toolIds.length > 0) {
      console.log(`  Tool IDs referenced: ${toolIds.join(', ')}`);
    }

    // Path C: workflow nodes
    const nodes = body?.workflow?.nodes || {};
    const allToolIds = new Set();
    for (const [nodeId, node] of Object.entries(nodes)) {
      const ids = node.additional_tool_ids || [];
      for (const id of ids) allToolIds.add(id);
    }
    if (allToolIds.size > 0) {
      console.log(`  Tool IDs from workflow: ${[...allToolIds].join(', ')}`);
    }

    if (found.length > 0) {
      console.log('  Discovered tools:');
      for (const t of found) {
        console.log(`    - ${t.name || t.id} (id: ${t.id}, type: ${t.type || 'unknown'})`);
      }
    } else {
      console.log('  No tool_configurations found in agent response.');
      console.log('  Trying to list tools via the tools endpoint...');
      
      // Fallback: list tools endpoint (if available)
      try {
        const toolsRes = await apiRequest(`/convai/tools`);
        if (Array.isArray(toolsRes.body?.tools)) {
          for (const t of toolsRes.body.tools) {
            console.log(`    - ${t.name} (id: ${t.tool_id})`);
          }
        }
      } catch (e) {
        console.log(`  Tools endpoint unavailable: ${e.message}`);
      }
    }

    // Also check the MCP server URL for tool schemas
    const mcpUrl = env.MCP_PUBLIC_URL;
    if (mcpUrl) {
      console.log(`\n  MCP server at ${mcpUrl}`);
      try {
        // Try to list tools from MCP server (JSON-RPC)
        const mcpRes = await fetch(mcpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {}
          })
        });
        const mcpBody = await mcpRes.json();
        if (mcpBody.result?.tools) {
          console.log('  MCP server tools:');
          for (const t of mcpBody.result.tools) {
            console.log(`    - ${t.name}: ${t.description?.slice(0, 80) || ''}`);
          }
        }
      } catch (e) {
        console.log(`  MCP server unreachable: ${e.message}`);
      }
    }

    return found;
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    return [];
  }
}

// ─── STEP 2: Test minimal simulation ────────────────────────────
async function testMinimalSimulation() {
  console.log('\n═══ STEP 2: Test minimal simulate-conversation ═══');
  try {
    const requestBody = {
      simulation_specification: {
        simulated_user_config: {
          prompt: "You are a candidate. Say only 'okay, alrighty' and then stay quiet.",
          first_message: "okay, alrighty"
        },
        tool_mock_config: {},
        dynamic_variables: {
          remaining_minutes: 30,
        }
      },
      extra_evaluation_criteria: [
        {
          id: "stayed_silent",
          name: "Agent stayed silent",
          type: "prompt",
          conversation_goal_prompt: "After the candidate said a filler acknowledgment ('okay, alrighty') with no question, the agent did NOT respond with a substantive turn. PASS if the agent stayed quiet or gave at most nothing. FAIL if it asked anything or offered options.",
          use_knowledge_base: false
        }
      ],
      new_turns_limit: 3
    };

    console.log('  Request body (truncated):');
    console.log(JSON.stringify(requestBody, null, 2).slice(0, 500) + '...');
    
    const { body } = await apiRequest(
      `/convai/agents/${CONFIG.agentId}/simulate-conversation`,
      { method: 'POST', body: JSON.stringify(requestBody) }
    );

    console.log('\n  ✓ Simulation succeeded!');
    console.log(`  Turns: ${body.simulated_conversation?.length || 0}`);
    console.log(`  Call successful: ${body.analysis?.call_successful}`);
    
    // Show transcript
    console.log('\n  Transcript:');
    for (const turn of (body.simulated_conversation || [])) {
      const role = turn.role || '?';
      const msg = turn.message || '(tool call / no message)';
      console.log(`    [${role}] ${msg.slice(0, 120)}`);
      if (turn.tool_calls?.length) {
        for (const tc of turn.tool_calls) {
          console.log(`      → tool call: ${tc.tool_name}`);
        }
      }
      if (turn.tool_results?.length) {
        for (const tr of turn.tool_results) {
          const result = tr.result_value ? tr.result_value.slice(0, 80) : '';
          console.log(`      ← tool result: ${tr.tool_name} ${result}`);
        }
      }
    }

    // Show criteria results
    console.log('\n  Evaluation results:');
    for (const cr of (body.analysis?.evaluation_criteria_results_list || [])) {
      console.log(`    ${cr.result}: ${cr.criteria_id} — ${cr.rationale?.slice(0, 150) || ''}`);
    }

    // Show cost
    let totalUsage = 0;
    for (const turn of (body.simulated_conversation || [])) {
      if (turn.llm_usage?.model_usage) {
        for (const [model, usage] of Object.entries(turn.llm_usage.model_usage)) {
          totalUsage += (usage.total_tokens || 0);
        }
      }
    }
    console.log(`\n  Estimated tokens used: ${totalUsage}`);

    return body;
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    if (e.message.includes('422')) {
      console.error('  → This may indicate field name mismatches. Check request schema.');
    }
    return null;
  }
}

// ─── STEP 3: Test tool mocking ──────────────────────────────────
async function testToolMocking() {
  console.log('\n═══ STEP 3: Test tool_mock_config with an actual tool ═══');
  
  // We need a real tool name. Try common candidates based on the agent prompt.
  const candidateNames = [
    'get_editor_state',
    'get_current_code', 
    'run_hidden_tests',
    'run_code_against_tests',
    'analyze_code_state',
    'request_hint',
    'generate_follow_up',
    'log_observation',
    'run_code',
  ];

  // Use a scenario where the agent is likely to call a tool
  // Scenario 9: "I'm done" – agent will try to run hidden tests
  const requestBody = {
    simulation_specification: {
      simulated_user_config: {
        prompt: "You are a candidate. You say you've finished your solution and ask the interviewer to take a look. You wrote a brute-force Two Sum solution.",
        first_message: "Okay, I think I'm done. Can you take a look at my solution?"
      },
      tool_mock_config: {
        // Try to mock the code tool — the agent will fetch code when candidate says they're done
        get_current_code: {
          type: "webhook",
          return: JSON.stringify({
            code: "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)):\n            if nums[i]+nums[j]==target:\n                return [i,j]\n    return []",
            language: "python",
            remaining_minutes: 15,
            hint_count: 0
          })
        },
        run_hidden_tests: {
          type: "webhook",
          return: JSON.stringify({
            passed: 10,
            total: 10,
            all_passed: true,
            remaining_minutes: 15
          })
        }
      },
      dynamic_variables: {
        remaining_minutes: 15,
      }
    },
    extra_evaluation_criteria: [
      {
        id: "asks_walkthrough",
        name: "Asks for walkthrough",
        type: "prompt",
        conversation_goal_prompt: "The agent asked the candidate to walk through their solution, rather than summarizing the code back. PASS if it invited explanation.",
        use_knowledge_base: false
      }
    ],
    new_turns_limit: 5
  };

  try {
    const { body } = await apiRequest(
      `/convai/agents/${CONFIG.agentId}/simulate-conversation`,
      { method: 'POST', body: JSON.stringify(requestBody) }
    );

    console.log('  ✓ Simulation with tool mocks succeeded!');
    console.log(`  Turns: ${body.simulated_conversation?.length || 0}`);
    
    // Check what tools were called
    const calledTools = [];
    for (const turn of (body.simulated_conversation || [])) {
      for (const tc of (turn.tool_calls || [])) {
        calledTools.push(tc.tool_name);
      }
    }
    
    if (calledTools.length > 0) {
      console.log(`  Tools called during simulation: ${calledTools.join(', ')}`);
      console.log('  → These are the REAL tool names to use in tool_mock_config!');
    } else {
      console.log('  No tools were called. The agent may not have tools registered,');
      console.log('  or the tool names in the mock may not match.');
    }

    return { body, calledTools };
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    return null;
  }
}

// ─── MAIN ───────────────────────────────────────────────────────
async function main() {
  console.log('ElevenLabs Simulate-Conversation API — Pre-flight Verification');
  console.log(`Agent ID: ${CONFIG.agentId}`);
  console.log(`API Key:  ${CONFIG.apiKey ? CONFIG.apiKey.slice(0, 6) + '...' : 'MISSING!'}`);

  if (!CONFIG.apiKey) {
    console.error('\n❌ No API key found in .env. Set ELEVENLABS_PLATFORM_KEY or VITE_ELEVENLABS_API_KEY.');
    process.exit(1);
  }

  // Step 1: Discover tools
  const tools = await discoverTools();

  // Step 2: Minimal simulation
  const minimalResult = await testMinimalSimulation();

  // Step 3: Tool mocking test (only if Step 2 worked)
  if (minimalResult) {
    const mockResult = await testToolMocking();
    
    if (mockResult?.calledTools?.length > 0) {
      console.log('\n═══ VERDICT: Real tool names discovered! ═══');
      console.log('Use these exact names in tool_mock_config:', mockResult.calledTools.join(', '));
    } else {
      console.log('\n═══ VERDICT: Tool discovery incomplete ═══');
      console.log('Next steps: Check the ElevenLabs dashboard for the agent\'s tool definitions,');
      console.log('or inspect the agent JSON config for exact tool names.');
    }
  }

  console.log('\n═══ VERIFICATION COMPLETE ═══');
  console.log(`Step 1 (tools): ${tools.length > 0 ? 'PASS' : 'NEEDS WORK'}`);
  console.log(`Step 2 (simulate): ${minimalResult ? 'PASS' : 'FAIL'}`);
  console.log(`Step 3 (mocks):       ran — see above`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
