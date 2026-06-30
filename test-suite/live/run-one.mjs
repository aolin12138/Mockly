/**
 * run-one.mjs — single-scenario live conversation runner.
 *
 * Orchestrates: start WS → sim-user loop → end session → fetch transcript → return structured result.
 * Reuses the existing CONFIG.phaseNodeIds mapping.
 */
import { LiveConversationClient } from './ws-client.mjs';
import { SimulatedUser } from './sim-user.mjs';
import { CONFIG } from '../lib/config.mjs';

// Test session setup via backend API
const BACKEND_URL = CONFIG.backendUrl;
const TEST_API_KEY = CONFIG.testApiKey;

async function setupTestSession(conversationId, liveRunId, scenario) {
  if (!TEST_API_KEY) return;
  const question = scenario.question_context;
  const code = scenario.candidate_code || '';
  if (!question) return;

  const ids = [conversationId, liveRunId].filter(Boolean);

  for (const sessionId of ids) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/test/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-api-key': TEST_API_KEY },
        body: JSON.stringify({ sessionId, question, code, language: 'python' }),
      });
      if (resp.ok) console.log(`  Test session set up: ${sessionId}`);
      else console.warn(`  Test session setup failed for ${sessionId}: ${resp.status}`);
    } catch (e) {
      console.warn(`  Test session setup error (backend not available?): ${e.message}`);
      return; // Don't retry other IDs if backend is down
    }
  }
}

async function cleanupTestSession(conversationId) {
  if (!TEST_API_KEY || !conversationId) return;
  try {
    await fetch(`${BACKEND_URL}/api/test/session/${conversationId}`, {
      method: 'DELETE',
      headers: { 'x-test-api-key': TEST_API_KEY },
    });
  } catch { /* ignore cleanup errors */ }
}

/**
 * Default dynamic variables matching CONFIG.defaultDynamicVariables.
 */
const DEFAULT_DYNAMIC_VARS = {
  question_title: 'Find Maximum Subarray Sum',
  question_statement: 'Write a function that takes a list of integers and returns the maximum sum of any contiguous subarray.',
  constraints: '1 <= len(nums) <= 10^5, -10^4 <= nums[i] <= 10^4',
  example_cases: 'Input: [-2,1,-3,4,-1,2,1,-5,4] => Output: 6 (subarray [4,-1,2,1])',
  difficulty: 'medium',
  company_type: 'general',
  time_budget_minutes: '30',
  remaining_minutes: '30',
  secret__session_id: 'test-suite-session',
};

/**
 * Phase node ID mapping matching CONFIG.phaseNodeIds.
 */
export const PHASE_NODE_IDS = {
  1: 'node_01ksvy7ntre8gsanne5tj7kmca',
  2: 'node_01ksvyddppe8gsannvqqc66p4w',
  3: 'node_01ksvyftate8gsanp9mkqw49tf',
  4: 'node_01kt35w596exs8pbna62db1zkr',
};

/**
 * Run a single live scenario.
 *
 * @param {Object} scenario - normalised scenario object from lib/loader.mjs
 * @param {Object} opts
 * @param {string} opts.apiKey - ElevenLabs platform key
 * @param {number} [opts.turnTimeoutMs=20000] - timeout per turn
 * @param {number} [opts.conversationTimeoutMs=120000] - total conversation timeout
 * @returns {Promise<{
 *   scenarioId: string,
 *   result: 'pass'|'fail'|'error',
 *   criteria: Array<Object>,
 *   transcript: Array<Object>,
 *   rawEvents: Array<Object>,
 *   conversationId: string|null,
 *   durationMs: number,
 *   tokens: number,
 *   turnsUsed: number,
 *   turnLimit: number,
 *   error?: string,
 *   message?: string,
 * }>}
 */

function collapseAgentTurns(transcript) {
  const out = [];
  let pendingTools = [];
  let pendingToolResults = [];
  for (const t of transcript) {
    if (t.role !== 'agent') {
      if (pendingTools.length > 0 || pendingToolResults.length > 0) {
        out.push({ role: 'agent', message: '', tool_calls: pendingTools, tool_results: pendingToolResults, toolCalls: pendingTools, toolResults: pendingToolResults, agent_metadata: null, workflowNodeId: null, isCollapsed: true });
        pendingTools = []; pendingToolResults = [];
      }
      out.push(t);
      continue;
    }
    const hasMessage = t.message && t.message.trim().length > 0;
    const tools = t.tool_calls || t.toolCalls || [];
    const results = t.tool_results || t.toolResults || [];
    const isSkipTurn = tools.some(tc => (tc.toolName||tc.tool_name) === 'skip_turn');
    if (hasMessage) {
      out.push({ ...t, tool_calls: [...pendingTools, ...tools], tool_results: [...pendingToolResults, ...results], toolCalls: [...pendingTools, ...tools], toolResults: [...pendingToolResults, ...results] });
      pendingTools = []; pendingToolResults = [];
    } else if (isSkipTurn) {
      out.push({ ...t, tool_calls: [...pendingTools, ...tools], tool_results: [...pendingToolResults, ...results], toolCalls: [...pendingTools, ...tools], toolResults: [...pendingToolResults, ...results] });
      pendingTools = []; pendingToolResults = [];
    } else {
      pendingTools.push(...tools); pendingToolResults.push(...results);
    }
  }
  if (pendingTools.length > 0 || pendingToolResults.length > 0) {
    out.push({ role: 'agent', message: '', tool_calls: pendingTools, tool_results: pendingToolResults, toolCalls: pendingTools, toolResults: pendingToolResults, agent_metadata: null, workflowNodeId: null, isCollapsed: true });
  }
  return out;
}

export async function runOne(scenario, opts) {
  const { apiKey } = opts;
  const turnTimeoutMs = opts.turnTimeoutMs ?? 20000;
  const conversationTimeoutMs = opts.conversationTimeoutMs ?? 120000;

  const startTime = Date.now();
  let client;

  try {
    // 1. Determine starting node ID from target_phase
    const phase = scenario.target_phase;
    const startingNodeId = phase ? PHASE_NODE_IDS[phase] : undefined;

    // 2. Build tool mocks
    const toolMocks = {};
    if (scenario.tool_mocks) {
      for (const [toolName, mock] of Object.entries(scenario.tool_mocks)) {
        const returnValue = typeof mock.default_return_value === 'string'
          ? mock.default_return_value
          : JSON.stringify(mock.default_return_value);

        toolMocks[toolName] = () => returnValue;
      }
    }

    // 3. Merge dynamic variables
    const liveRunId = `live-run-${scenario.id}-${Date.now()}`;
    const dynamicVariables = {
      ...DEFAULT_DYNAMIC_VARS,
      ...(scenario.dynamic_variables || {}),
      // Ensure unique session ID — match what test store expects
      secret__session_id: liveRunId,
    };

    // 4. Start WS conversation
    client = new LiveConversationClient({
      apiKey,
      agentId: opts.agentId,
      textOnly: true,
      dynamicVariables,
      clientToolMocks: toolMocks,
      startingNodeId,
      title: scenario.id,
      extraBody: startingNodeId ? { starting_workflow_node_id: startingNodeId } : undefined,
    });

    await client.start();
    const conversationId = client.getConversationId();

    // 5a. Set up test session for MCP tools (real code + Judge0 execution)
    await setupTestSession(conversationId, liveRunId, scenario);

    // 5. Warm-up: inject prior conversation as contextual_update.
    //    Agent reads this as background — no turns consumed, no agent replies.
    let transcript = [];
    let warmUpCount = 0;
    const warmUp = scenario.warm_up;
    if (warmUp && warmUp.candidate_turns) {
      const turns = warmUp.candidate_turns;
      console.log(`  Warm-up: injecting ${turns.length} turn(s) via contextual_update for ${warmUp.target_phase_label || 'target phase'}`);
      
      // Build the prior conversation text from candidate turns
      const contextText = turns.map((msg, i) => `[Candidate turn ${i+1}]: ${msg}`).join('\n');
      client.sendContextualUpdate(
        `PRIOR CONVERSATION (already happened, do not respond to this):\n${contextText}\n` +
        `The candidate is now at: ${warmUp.target_phase_label || 'the target phase'}.`
      );
      
      // Record warm-up turns in transcript for context display only
      for (const msg of turns) {
        transcript.push({ role: 'user', message: msg, warmup: true });
      }
      warmUpCount = turns.length * 2; // account for user turns in turn limit boost
    }

    // 6. Set up simulated user
    const simUser = new SimulatedUser({
      scenarioPrompt: scenario.simulated_user.prompt,
      firstMessage: scenario.simulated_user.first_message || null,
    });

    // 6a. Wait for agent's auto-sent first_message (opening with problem intro).
    //     The agent sends this automatically when the conversation starts.
    //     Capture it so the sim-user has context before responding.
    let agentReply;
    try {
      agentReply = await client.awaitAgentReply({ timeoutMs: turnTimeoutMs });
    } catch (err) {
      if (err.message?.includes('Timeout')) {
        console.warn('  Agent did not send opening message (WS timeout).');
        agentReply = { message: '', skipTurn: false };
      } else {
        throw err;
      }
    }
    const openingTools = (client.rawEvents || [])
      .filter(ev => ev.type === 'client_tool_call' || ev.type === 'mcp_tool_call')
      .filter(ev => !ev._seenByRunner)
      .map(ev => {
        ev._seenByRunner = true;
        const tc = ev.client_tool_call || ev.mcp_tool_call || {};
        return { tool_name: tc.tool_name || tc.name || '(unknown)' };
      });
    if (agentReply.message) {
      transcript.push({
        role: 'agent',
        message: agentReply.message,
        tool_calls: openingTools,
        skipTurn: false,
      });
    }

    // 7. Conversation loop — turn limit accounts for warm-up so tests always
    //    get their full budget. Warm-up turns are context injection only.
    const baseLimit = scenario.new_turns_limit || 6;
    const turnLimit = baseLimit + (warmUpCount / 2); // warm-up consumes ~2 transcript entries per user turn
    let turnsUsed = 0;
    let endCallDetected = false;

    console.log(`  Test turns: ${baseLimit} (warm-up injected ${warmUpCount/2} user turns)`);

    for (let turn = 0; turn < turnLimit && !endCallDetected; turn++) {
      // Check total timeout
      if (Date.now() - startTime > conversationTimeoutMs) {
        throw new Error(`Conversation timeout after ${conversationTimeoutMs}ms`);
      }

      // Get next user message from sim-user
      let userMessage;
      try {
        userMessage = await simUser.next(transcript);
      } catch (err) {
        // If sim-user fails (e.g. Gemini key invalid), send a simple follow-up
        console.warn(`  Sim-user error (turn ${turn}): ${err.message}. Sending placeholder.`);
        userMessage = 'OK, go on.';
      }

      if (userMessage === null) {
        // Sim-user gave up (returned null or [END_CALL]).
        // If the sim-user explicitly ended (saw enough to evaluate), break.
        if (simUser.endedBySimUser) {
          console.log(`  Sim-user ended conversation (turn ${turn}) — enough info gathered.`);
          endCallDetected = true;
          break;
        }
        // Otherwise, try safety net
        const agentLastMessage = transcript.filter(t => t.role==='agent').pop();
        const agentEnded = agentLastMessage?.tool_calls?.some(tc => tc.tool_name === 'end_call');
        if (!agentEnded && turn < turnLimit - 2) {
          console.warn(`  Sim-user returned null (turn ${turn}). Sending placeholder.`);
          // Pick a context-appropriate placeholder
          const phase = scenario.target_phase || 1;
          userMessage = phase <= 1 ? 'OK, let me think about my approach.'
            : phase <= 2 ? 'Still working on the implementation.'
            : 'Let me try a different approach.';
        } else {
          endCallDetected = true;
          break;
        }
      }

      turnsUsed++;

      // Send user message
      client.sendUser(userMessage);

      // Await agent reply
      let agentReply;
      try {
        agentReply = await client.awaitAgentReply({ timeoutMs: turnTimeoutMs });
      } catch (err) {
        // A real WS-level timeout (no response of any kind, not even silence)
        // is the only thing that breaks the loop now. skip_turn no longer
        // throws — it returns { message: '', skipTurn: true } so the sim-user
        // can decide whether to continue.
        if (err.message?.includes('Timeout')) {
          console.log(`  WS-level timeout (no chunks, no skip_turn). Breaking loop.`);
          endCallDetected = true;
          break;
        }
        throw err;
      }

      // Collect tool calls fired during this agent turn so the sim-user can
      // see them in the next iteration (e.g. "[Interviewer stayed silent]",
      // "[Interviewer ended the call]", etc.).
      const toolCallsThisTurn = (client.rawEvents || [])
        .filter(ev => ev.type === 'client_tool_call' || ev.type === 'mcp_tool_call')
        .filter(ev => !ev._seenByRunner)
        .map(ev => {
          ev._seenByRunner = true;
          const tc = ev.client_tool_call || ev.mcp_tool_call || {};
          return { tool_name: tc.tool_name || tc.name || '(unknown)' };
        });

      transcript.push({ role: 'user', message: userMessage });
      transcript.push({
        role: 'agent',
        message: agentReply.message,
        tool_calls: toolCallsThisTurn,
        skipTurn: agentReply.skipTurn || false,
      });

      // Did the agent end the call?
      if (toolCallsThisTurn.some(tc => tc.tool_name === 'end_call')) {
        endCallDetected = true;
        break;
      }

      // Did the agent call skip_turn with NO text? That's a prompt rule failure.
      // End immediately — no point continuing with a silent agent.
      if (toolCallsThisTurn.some(tc => tc.tool_name === 'skip_turn') && !agentReply.message?.trim()) {
        console.log(`  Agent called skip_turn silently (turn ${turn}) — ending test.`);
        endCallDetected = true;
        break;
      }
    }

    // 8. End session
    client.endSession();
    await cleanupTestSession(conversationId);

    // 9. Fetch transcript (polls until conversation is indexed)
    let serverData;
    try {
      serverData = await client.fetchTranscript({ apiKey, timeoutMs: 60000, pollMs: 3000 });
    } catch (err) {
      console.warn(`  Transcript fetch error: ${err.message}. Using in-memory transcript.`);
      serverData = { transcript: [] };
    }

    let normalised = LiveConversationClient.normaliseTranscript(serverData);

    // Post-process: collapse tool-only turns into the next agent message.
    normalised = collapseAgentTurns(normalised);

    // Fallback: if server transcript is empty or shorter than expected,
    // use the in-memory transcript (which has messages but no workflowNodeId)
    if (normalised.length === 0 && transcript.length > 0) {
      normalised = transcript.map(t => ({
        ...t,
        agent_metadata: null,
        tool_calls: [],
        tool_results: [],
        workflowNodeId: null,
        toolCalls: [],
        toolResults: [],
      }));
    }

    const durationMs = Date.now() - startTime;

    return {
      scenarioId: scenario.id,
      result: 'pass', // Will be updated by judge
      description: scenario.description || '',
      targetPhase: scenario.target_phase || null,
      targetPhaseLabel: scenario.target_phase_label || '',
      historyCount: scenario.partial_conversation_history?.length || 0,
      criteria: [], // Filled in by runner
      transcript: normalised,
      rawEvents: client.rawEvents,
      conversationId,
      tokens: 0, // Will be estimated
      durationMs,
      turnsUsed,
      turnLimit,
    };
  } catch (err) {
    // Cleanup
    if (client) {
      try { client.endSession(); } catch { /* ignore */ }
    }
    if (client) {
      try { await cleanupTestSession(client.getConversationId()); } catch { /* ignore */ }
    }

    const durationMs = Date.now() - startTime;
    return {
      scenarioId: scenario.id,
      result: 'error',
      description: scenario.description || '',
      targetPhase: scenario.target_phase || null,
      targetPhaseLabel: scenario.target_phase_label || '',
      historyCount: scenario.partial_conversation_history?.length || 0,
      criteria: [],
      transcript: [],
      rawEvents: client?.rawEvents || [],
      conversationId: client?.getConversationId() || null,
      tokens: 0,
      durationMs,
      turnsUsed: 0,
      turnLimit: scenario.new_turns_limit || 6,
      error: 'CONVERSATION_ERROR',
      message: err.message,
    };
  }
}
