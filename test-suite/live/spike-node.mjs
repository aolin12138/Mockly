#!/usr/bin/env node

/**
 * Spike — test whether starting_workflow_node_id works over WebSocket.
 *
 * Tests three candidate locations for the field (the SDK sends these via
 * the conversation_initiation_client_data WS event as two fields):
 *   1. custom_llm_extra_body.starting_workflow_node_id  (via extraBody)
 *   2. conversation_config_override.conversation.starting_workflow_node_id
 *   3. conversation_config_override.agent.starting_workflow_node_id
 *
 * The SDK does NOT expose a top-level starting_workflow_node_id on
 * ConversationInitiationClientDataEvent — only custom_llm_extra_body,
 * conversation_config_override, and dynamic_variables. So option (a)
 * from the plan (top-level) is not testable via the SDK.
 *
 * For each, starts a 1-turn conversation, sends "hello", ends, fetches the
 * transcript, and checks whether the first turn's workflowNodeId matches
 * the requested Phase 2 node (node_01ksvyddppe8gsannvqqc66p4w).
 *
 * Usage: node test-suite/live/spike-node.mjs
 */

import { loadEnv } from './_env.mjs';
import { LiveConversationClient } from './ws-client.mjs';

const PHASE2_NODE_ID = 'node_01ksvyddppe8gsannvqqc66p4w';

const env = loadEnv();
const API_KEY = env.ELEVENLABS_PLATFORM_KEY;
const AGENT_ID = 'agent_2201ktp0n7mwek6avkphs4x6394m';

const TESTS = [
  {
    label: 'custom_llm_extra_body.starting_workflow_node_id (extraBody)',
    extraBody: { starting_workflow_node_id: PHASE2_NODE_ID },
    conversationConfigOverride: {},
  },
  {
    label: 'conversation_config_override.conversation.starting_workflow_node_id',
    extraBody: {},
    conversationConfigOverride: {
      conversation: { starting_workflow_node_id: PHASE2_NODE_ID, text_only: true },
    },
  },
  {
    label: 'conversation_config_override.agent.starting_workflow_node_id',
    extraBody: {},
    conversationConfigOverride: {
      agent: { starting_workflow_node_id: PHASE2_NODE_ID },
    },
  },
];

export async function runOneTurn(label, extraBody, configOverride) {
  console.log(`\n═══ Testing: ${label} ═══`);

  const client = new LiveConversationClient({
    apiKey: API_KEY,
    agentId: AGENT_ID,
    textOnly: true,
    extraBody,
    conversationConfigOverride: configOverride,
    dynamicVariables: {
      question_title: 'Find Maximum Subarray Sum',
      question_statement: 'Write a function that takes a list of integers and returns the maximum sum of any contiguous subarray.',
      constraints: '1 <= len(nums) <= 10^5, -10^4 <= nums[i] <= 10^4',
      example_cases: 'Input: [-2,1,-3,4,-1,2,1,-5,4] => Output: 6 (subarray [4,-1,2,1])',
      difficulty: 'medium',
      company_type: 'general',
      time_budget_minutes: '30',
      remaining_minutes: '30',
      secret__session_id: `spike-node-${Date.now()}`,
    },
  });

  try {
    console.log('  Starting session...');
    await client.start();
    const convId = await client.waitForConversationId(15000);
    console.log(`  Conversation ID: ${convId}`);

    console.log('  Sending "hello"...');
    client.sendUser('hello');

    console.log('  Awaiting agent reply...');
    const reply = await client.awaitAgentReply({ timeoutMs: 20000 });
    console.log(`  Agent reply: "${reply.message.slice(0, 100)}..."`);

    client.endSession();

    // Wait for the conversation to be indexed (generous wait for eventual consistency)
    await new Promise(r => setTimeout(r, 5000));

    console.log('  Fetching transcript...');
    const transcriptData = await client.fetchTranscript({ apiKey: API_KEY, retries: 5, backoffMs: 3000 });
    console.log('  Transcript entries:', transcriptData.transcript?.length || 0);
    console.log('  First turn keys:', transcriptData.transcript?.[0] ? Object.keys(transcriptData.transcript[0]) : 'none');
    const normalised = LiveConversationClient.normaliseTranscript(transcriptData);

    const firstTurn = normalised[0] || {};
    const nodeId = firstTurn.workflowNodeId;

    console.log(`  First turn workflowNodeId: ${nodeId}`);
    console.log(`  Expected (Phase 2):        ${PHASE2_NODE_ID}`);

    const match = nodeId === PHASE2_NODE_ID;
    console.log(`  Match: ${match ? '✅ YES' : '❌ NO'}`);

    // Print all node IDs for inspection
    console.log('  All workflowNodeIds in transcript:');
    for (const [i, turn] of normalised.entries()) {
      console.log(`    [${i}] role=${turn.role} node=${turn.workflowNodeId} msg="${(turn.message || '').slice(0, 60)}"`);
    }

    return { match, nodeId, transcript: normalised };
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    client.endSession();
    return { match: false, nodeId: null, error: err.message };
  }
}

async function main() {
  console.log('Spike: starting_workflow_node_id over WebSocket');
  console.log(`Phase 2 target node: ${PHASE2_NODE_ID}`);
  console.log(`Agent: ${AGENT_ID}`);

  const results = [];

  for (const test of TESTS) {
    const result = await runOneTurn(test.label, test.extraBody, test.conversationConfigOverride);
    results.push({ label: test.label, ...result });
  }

  // Summary
  console.log('\n\n═══ SUMMARY ═══');
  const anyMatch = results.some(r => r.match);
  console.log(`Any location works: ${anyMatch ? '✅ YES' : '❌ NO'}`);
  console.log();

  for (const r of results) {
    const icon = r.match ? '✅' : r.error ? '❌' : '❌';
    console.log(`  ${icon} ${r.label}`);
    if (r.nodeId) console.log(`       nodeId: ${r.nodeId}`);
    if (r.error) console.log(`       error: ${r.error}`);
  }

  if (!anyMatch) {
    console.log('\n⚠ No location worked. The warm-up fallback will be needed.');
    console.log('  The runner should drive the agent forward by sending pre-messages.');
  }

  process.exit(anyMatch ? 0 : 0); // Don't fail — this is info-gathering
}

// Guard: only run as main, not when imported
const isMain = process.argv[1] && (process.argv[1].endsWith('spike-node.mjs') || process.argv[1].endsWith('spike-node'));
if (isMain) {
  main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}
