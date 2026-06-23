/**
 * run-one.mjs — single-scenario live conversation runner.
 *
 * Orchestrates: start WS → sim-user loop → end session → fetch transcript → return structured result.
 * Reuses the existing CONFIG.phaseNodeIds mapping.
 */
import { LiveConversationClient } from './ws-client.mjs';
import { SimulatedUser } from './sim-user.mjs';

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
    const dynamicVariables = {
      ...DEFAULT_DYNAMIC_VARS,
      ...(scenario.dynamic_variables || {}),
      // Ensure unique session ID
      secret__session_id: `live-run-${scenario.id}-${Date.now()}`,
    };

    // 4. Start WS conversation
    client = new LiveConversationClient({
      apiKey,
      agentId: opts.agentId,
      textOnly: true,
      dynamicVariables,
      clientToolMocks: toolMocks,
      startingNodeId,
      extraBody: startingNodeId ? { starting_workflow_node_id: startingNodeId } : undefined,
    });

    await client.start();
    const conversationId = client.getConversationId();

    // 5. Set up simulated user
    const simUser = new SimulatedUser({
      scenarioPrompt: scenario.simulated_user.prompt,
      firstMessage: scenario.simulated_user.first_message || null,
    });

    // 6. Wait for agent's opening message (if any)
    let transcript = [];

    // 7. Conversation loop
    const turnLimit = scenario.new_turns_limit || 6;
    let turnsUsed = 0;
    let endCallDetected = false;

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
        // Simulated user signals end of call
        endCallDetected = true;
        break;
      }

      turnsUsed++;

      // Send user message
      client.sendUser(userMessage);

      // Await agent reply
      let agentReply;
      try {
        agentReply = await client.awaitAgentReply({ timeoutMs: turnTimeoutMs });
      } catch (err) {
        // If the agent stays silent (e.g. skip_turn), treat as end of conversation
        if (err.message?.includes('Timeout')) {
          console.log(`  Agent silent (skip_turn/conversation ended). Breaking loop.`);
          endCallDetected = true;
          break;
        }
        throw err;
      }
      transcript.push({ role: 'user', message: userMessage });
      transcript.push({ role: 'agent', message: agentReply.message });
    }

    // 8. End session
    client.endSession();

    // 9. Fetch transcript (polls until conversation is indexed)
    let serverData;
    try {
      serverData = await client.fetchTranscript({ apiKey, timeoutMs: 60000, pollMs: 3000 });
    } catch (err) {
      console.warn(`  Transcript fetch error: ${err.message}. Using in-memory transcript.`);
      serverData = { transcript: [] };
    }

    let normalised = LiveConversationClient.normaliseTranscript(serverData);

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
