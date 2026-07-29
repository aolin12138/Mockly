#!/usr/bin/env node
/**
 * MCP Server Load Test 
 * Tests: session setup + code injection + isolation under concurrency
 * Judge0 concurrency is already tested by our 4-concurrent scenario runs
 */
const BASE = 'http://localhost:3000';
const TEST_KEY = process.env.TEST_API_KEY;
if (!TEST_KEY) {
  console.error('FATAL: TEST_API_KEY not set in environment');
  process.exit(1);
}

async function setup(id, code) {
  const r = await fetch(`${BASE}/api/test/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-api-key': TEST_KEY },
    body: JSON.stringify({ sessionId: `load-${id}`, code, language: 'python', question: { examples: [], hidden_tests: [] } }),
  });
  return r.ok;
}

async function inject(id, code) {
  const r = await fetch(`${BASE}/api/test/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-api-key': TEST_KEY },
    body: JSON.stringify({ sessionId: `load-${id}`, code }),
  });
  return r.ok;
}

async function read(id) {
  const r = await fetch(`${BASE}/api/test/session/load-${id}`, { headers: { 'x-test-api-key': TEST_KEY } });
  if (!r.ok) return null;
  return (await r.json()).code;
}

async function main() {
  const N = parseInt(process.argv[2]) || 100;
  console.log(`Load test: ${N} concurrent sessions`);
  
  // Setup
  const t0 = Date.now();
  const ok = (await Promise.all(Array.from({length:N}, (_,i) => setup(i, `# ${i}`)))).filter(Boolean).length;
  console.log(`Setup: ${ok}/${N} in ${Date.now()-t0}ms`);

  // Inject unique code
  const t1 = Date.now();
  const injOk = (await Promise.all(Array.from({length:N}, (_,i) => inject(i, `# session ${i} code`)))).filter(Boolean).length;
  console.log(`Inject: ${injOk}/${N} in ${Date.now()-t1}ms`);

  // Verify isolation — every session gets its own code
  const t2 = Date.now();
  let leaks = 0;
  const codes = await Promise.all(Array.from({length:N}, (_,i) => read(i)));
  for (let i = 0; i < N; i++) {
    if (!codes[i]?.includes(`session ${i}`)) leaks++;
  }
  console.log(`Isolation: ${leaks === 0 ? '✅' : '❌ '+leaks+' leaks'} in ${Date.now()-t2}ms`);

  // Also verify the code persists (not overwritten by concurrent writes)
  const codes2 = await Promise.all(Array.from({length:10}, (_,i) => read(i)));
  let persistOk = codes2.every((c,i) => c?.includes(`session ${i}`));
  console.log(`Persistence: ${persistOk ? '✅' : '❌'}`);

  console.log(`\nTotal: ${Date.now()-t0}ms`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
