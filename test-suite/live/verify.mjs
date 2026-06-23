/**
 * Structural verifiers — assertions on the transcript independent of the judge LLM.
 *
 * Tests that required tools were called, phase progression is correct,
 * and forbidden tools were not used.
 */

/**
 * Get tool calls from a turn, handling both snake_case (server) and camelCase (normalised) formats.
 */
function getToolCalls(turn) {
  return turn.tool_calls || turn.toolCalls || [];
}

function getToolCallName(tc) {
  return tc.tool_name || tc.toolName;
}

function getNodeId(turn) {
  // server format: agent_metadata.workflow_node_id
  if (turn.agent_metadata?.workflow_node_id) return turn.agent_metadata.workflow_node_id;
  // normalised format: workflowNodeId
  if (turn.workflowNodeId) return turn.workflowNodeId;
  return null;
}

/**
 * Verify that all required tool names appear in the transcript.
 * @param {Array<Object>} transcript - normalised transcript array
 * @param {string[]} requiredToolNames - e.g. ['get_current_code', 'run_code_against_tests']
 * @returns {{ pass: boolean, missing: string[] }}
 */
export function verifyToolCalls(transcript, requiredToolNames) {
  const calledNames = new Set();
  for (const turn of transcript) {
    for (const tc of getToolCalls(turn)) {
      calledNames.add(getToolCallName(tc));
    }
  }

  const missing = requiredToolNames.filter(n => !calledNames.has(n));
  return { pass: missing.length === 0, missing };
}

/**
 * Verify that none of the forbidden tools appear in the transcript.
 * @param {Array<Object>} transcript
 * @param {string[]} forbiddenNames
 * @returns {{ pass: boolean, used: string[] }}
 */
export function verifyNoForbiddenTools(transcript, forbiddenNames) {
  const forbidSet = new Set(forbiddenNames);
  const used = [];
  for (const turn of transcript) {
    for (const tc of getToolCalls(turn)) {
      if (forbidSet.has(getToolCallName(tc))) used.push(getToolCallName(tc));
    }
  }
  return { pass: used.length === 0, used };
}

/**
 * Verify that workflow_node_id values move through expected phases.
 * This is a best-effort check since the exact node IDs depend on the workflow.
 *
 * @param {Array<Object>} transcript - normalised transcript
 * @param {number[]} expectedPhaseNumbers - e.g. [1, 2] for Phase 1 → Phase 2
 * @param {Object} phaseNodeIds - mapping from CONFIG.phaseNodeIds
 * @returns {{ pass: boolean, phasesSeen: number[], message: string }}
 */
export function verifyPhaseProgression(transcript, expectedPhaseNumbers, phaseNodeIds) {
  // Build reverse mapping: nodeId → phase number
  const nodeToPhase = {};
  for (const [phase, nodeId] of Object.entries(phaseNodeIds)) {
    nodeToPhase[nodeId] = parseInt(phase, 10);
  }

  // Collect unique phases seen (in order)
  const phasesSeen = [];
  for (const turn of transcript) {
    const nodeId = getNodeId(turn);
    if (nodeId && nodeToPhase[nodeId] !== undefined) {
      const phase = nodeToPhase[nodeId];
      if (phasesSeen.length === 0 || phasesSeen[phasesSeen.length - 1] !== phase) {
        phasesSeen.push(phase);
      }
    }
  }

  // Check: all expected phases appear in order
  let expectedIdx = 0;
  for (const phase of phasesSeen) {
    if (expectedIdx < expectedPhaseNumbers.length && phase === expectedPhaseNumbers[expectedIdx]) {
      expectedIdx++;
    }
  }

  const pass = expectedIdx >= expectedPhaseNumbers.length;
  return {
    pass,
    phasesSeen,
    message: pass
      ? `All expected phases ${expectedPhaseNumbers.join('→')} seen`
      : `Expected phases ${expectedPhaseNumbers.join('→')}, saw ${phasesSeen.join('→')}`,
  };
}

/**
 * Collect workflow_node_id values per turn for reporting.
 * @param {Array<Object>} transcript
 * @returns {Array<{turnIndex: number, role: string, nodeId: string|null}>}
 */
export function collectNodeIds(transcript) {
  return transcript.map((turn, i) => ({
    turnIndex: i,
    role: turn.role,
    nodeId: getNodeId(turn),
  }));
}
