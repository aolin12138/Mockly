import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('../.env','utf-8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i===-1) continue;
  env[t.slice(0,i).trim()] = t.slice(i+1).trim();
}

const AGENT = 'agent_2201ktp0n7mwek6avkphs4x6394m';
const BRANCH = 'agtbrch_1301ktp0n97rfn4tkjz5626383hm';

// Get current agent
const getRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AGENT + '?branch_id=' + BRANCH, {
  headers: {'xi-api-key': env.ELEVENLABS_PLATFORM_KEY}
});
const agent = await getRes.json();
const nodes = agent.workflow?.nodes || {};

// Phase prompt updates — inject tool instructions into each phase's additional_prompt
const toolHints = {
  Phase1: `\n\n# Using your tools\nCall \`get_current_code\` to check the editor — see if they have started coding yet. Do this silently; never mention it.`,
  Phase2: `\n\n# Using your tools\nCall \`get_current_code\` frequently to see their progress — do NOT ask them to paste or describe code. When they claim they are done, call \`run_code_against_tests\` to run the test suite. You will get back pass/fail counts — never reveal specific hidden inputs. Use the results to decide how to nudge.`,
  Phase3: `\n\n# Using your tools\nCall \`get_current_code\` to see where they are stuck. Call \`run_code_against_tests\` to check if anything passes. Use the results to give targeted, more direct hints.`,
  Phase4: `\n\n# Using your tools\nCall \`get_current_code\` to review their final code. Call \`run_code_against_tests\` to confirm tests pass before wrapping up.`,
};

for (const [nid, node] of Object.entries(nodes)) {
  const label = node.label || '';
  const hint = toolHints[label];
  if (hint && node.additional_prompt && !node.additional_prompt.includes('get_current_code')) {
    node.additional_prompt += hint;
    console.log('Updated', label, '— added tool instructions');
  }
}

// PATCH the full workflow
const patchRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AGENT + '?branch_id=' + BRANCH, {
  method: 'PATCH',
  headers: {'xi-api-key': env.ELEVENLABS_PLATFORM_KEY, 'Content-Type': 'application/json'},
  body: JSON.stringify({ workflow: agent.workflow })
});
console.log('PATCH workflow status:', patchRes.status);
const body = await patchRes.json();
console.log('New version:', body.version_id);

// Test
const simRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AGENT + '/simulate-conversation', {
  method:'POST',
  headers:{'xi-api-key':env.ELEVENLABS_PLATFORM_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({
    conversation_initiation_client_data:{starting_workflow_node_id:'node_01ksvyddppe8gsannvqqc66p4w'},
    simulation_specification:{
      simulated_user_config:{prompt:{prompt:'IMPORTANT: You are SPEAKING. NEVER write code. You just finished coding. Say "I am done, can you check?" and stop.',llm:'gpt-4o',temperature:0.2},first_message:'I am done, can you check?'},
      dynamic_variables:{question_title:'X',question_statement:'Write a function.',constraints:'1<=n<=100',example_cases:'[1]',difficulty:'easy',company_type:'general',time_budget_minutes:'30',remaining_minutes:'15',secret__session_id:'test'},
      tool_mock_config:{
        get_current_code:{default_return_value:JSON.stringify({code:'def solve(nums):\n    return max(nums)',language:'python',remaining_minutes:15,hintCount:0}),default_is_error:false},
        run_code_against_tests:{default_return_value:JSON.stringify({passedTests:10,totalTests:10,allPassed:true,failureCategory:'',compilationError:null,remainingMinutes:15}),default_is_error:false}
      }
    },
    extra_evaluation_criteria:[{id:'x',name:'x',conversation_goal_prompt:'Agent responded.',use_knowledge_base:false}],
    new_turns_limit:5
  })
});
const simData = await simRes.json();

console.log('\n=== AGENT RESPONSE ===');
for (const t of (simData.simulated_conversation||[])) {
  const tc = (t.tool_calls||[]).map(x=>x.tool_name).join(',');
  const tr = (t.tool_results||[]).map(x=>x.tool_name).join(',');
  if (tc) console.log('  🔧 ['+t.role+'] -> ' + tc);
  if (tr) console.log('  📋 ['+t.role+'] <- ' + tr);
  const msg = (t.message||'').slice(0,150);
  if (msg) console.log('  ['+t.role+'] ' + msg);
}

const allTools = simData.simulated_conversation?.flatMap(t=>t.tool_calls||[]).map(t=>t.tool_name) || [];
console.log('\nMCP tools called?', allTools.some(t=>t.includes('get_current')||t.includes('run_code')) ? 'YES!' : 'NO');
console.log('All tools:', [...new Set(allTools)].join(', ') || 'none');
