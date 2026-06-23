/**
 * MCP Tool Handlers
 *
 * Each handler receives (args, context) where context = { sessionId, session, question }.
 * Returns an MCP tool result: { content: [{ type: 'text', text: '...' }] }
 */

import { prisma } from '../../prismaClient.js';
import { executeCode } from '../judge0.js';
import { generateJavaScriptHarness } from '../harness/javascript.js';
import { generatePythonHarness } from '../harness/python.js';
import { generateJavaHarness } from '../harness/java.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HARNESS_GENERATORS = {
  javascript: generateJavaScriptHarness,
  python: generatePythonHarness,
  java: generateJavaHarness,
};

const DEFAULT_TIME_BUDGET_SECS = 30 * 60; // 30 minutes

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  // Try JSON parse first
  try { return JSON.parse(trimmed); } catch {}
  // Handle Python assignment syntax like 'nums = [1,2,3]' or 's = "a", t = "b"'
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const rhs = trimmed.substring(eqIdx + 1).trim();
    // Multi-arg: split by commas not inside brackets/quotes
    if (rhs.includes(',') && !rhs.startsWith('[') && !rhs.startsWith('(')) {
      const parts = [];
      let depth = 0, current = '', inStr = false;
      for (const ch of rhs) {
        if (ch === '"' || ch === "'") inStr = !inStr;
        if (!inStr) {
          if (ch === '[' || ch === '(') depth++;
          if (ch === ']' || ch === ')') depth--;
        }
        if (ch === ',' && depth === 0 && !inStr) {
          parts.push(current.trim());
          current = '';
        } else { current += ch; }
      }
      if (current.trim()) parts.push(current.trim());
      return parts.map(p => { try { return JSON.parse(p); } catch { return p.replace(/^["']|["']$/g, ''); } });
    }
    // Single value
    try { return JSON.parse(rhs); } catch { return rhs.replace(/^["']|["']$/g, ''); }
  }
  return value;
}

function buildHiddenTests(hiddenTests) {
  if (!Array.isArray(hiddenTests)) return [];
  return hiddenTests.map((test, i) => ({
    id: `h${i + 1}`,
    input: parseMaybeJson(test.input),
    expected: parseMaybeJson(test.expected_output ?? test.expected),
    tags: test.tags || [],
    description: test.description || `hidden ${i + 1}`,
  }));
}

function extractJsonResults(stdout) {
  try {
    const startIdx = stdout.indexOf('###START_JSON###');
    const endIdx = stdout.indexOf('###END_JSON###');
    if (startIdx === -1 || endIdx === -1) return null;
    return JSON.parse(stdout.substring(startIdx + 16, endIdx).trim());
  } catch {
    return null;
  }
}

/**
 * Map Judge0 status codes + test failure patterns → lossy failure category.
 * Categories: compile_error | runtime_error | timeout | basic_case | edge_case
 */
function classifyFailure(executionResult, testResults, hiddenTests) {
  // Compile error
  if (executionResult.compilationError) return 'compile_error';
  if (executionResult.statusId === 6) return 'compile_error';

  // Runtime / timeout
  if (executionResult.runtimeError) return 'runtime_error';
  const statusDesc = (executionResult.statusDescription || '').toLowerCase();
  if (statusDesc.includes('time limit') || executionResult.statusId === 5) return 'timeout';
  if (statusDesc.includes('runtime') || executionResult.statusId >= 7) return 'runtime_error';

  // Check test results
  if (!testResults || !Array.isArray(testResults)) return 'runtime_error';

  const failed = testResults.filter(t => !t.passed);
  if (failed.length === 0) return null; // all passed

  // Determine if failures are on "basic" vs "edge case" tests
  // If any of the first tests (visible/example-like) fail, it's basic_case
  // Otherwise, only hidden/edge tests fail → edge_case
  // This is deliberately coarse — the live agent doesn't need more granularity
  const hasEarlyFailure = testResults.slice(0, 3).some(t => !t.passed);
  return hasEarlyFailure ? 'basic_case' : 'edge_case';
}

// ---------------------------------------------------------------------------
// Tool: get_current_code
// ---------------------------------------------------------------------------

/**
 * Returns the candidate's current code + session metadata.
 * No execution — fast, meant to be called frequently.
 */
export async function getCurrentCode(args, context) {
  const { sessionId, session } = context;

  // Check for test-mode session IDs (prefixed with "live-run-" or "test-")
  const isTestSession = sessionId?.startsWith('live-run-') || sessionId?.startsWith('test-');

  // Refresh session from DB to get latest code
  const fresh = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      latestCode: true,
      latestLanguage: true,
      startedAt: true,
      hintCount: true,
      status: true,
      interviewType: true,
    },
  });

  if (!fresh && !isTestSession) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found' }) }] };
  }

  // For test sessions without a real DB entry, return mock code
  if (isTestSession && !fresh) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          code: `def solve(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        complement = target - n\n        if complement in seen:\n            return [seen[complement], i]\n        seen[n] = i\n    return []`,
          language: 'python',
          elapsed_seconds: 180,
          remaining_seconds: 1620,
          phase_hint: 'implementation',
          hint_count: 0,
          status: 'in_progress',
        }),
      }],
    };
  }

  const now = new Date();
  const startedAt = fresh.startedAt ? new Date(fresh.startedAt).getTime() : null;
  const timeBudgetSecs = DEFAULT_TIME_BUDGET_SECS;
  const elapsedSecs = startedAt ? Math.floor((now.getTime() - startedAt) / 1000) : 0;
  const remainingSecs = startedAt ? Math.max(0, timeBudgetSecs - elapsedSecs) : timeBudgetSecs;

  // Determine phase from remaining time
  let phaseHint = 'understanding';
  if (startedAt && elapsedSecs > 120) {
    // After 2 minutes, assume implementation (or closing if time low)
    const fractionLeft = remainingSecs / timeBudgetSecs;
    phaseHint = fractionLeft < 0.2 ? 'closing' : 'implementation';
  }

  const result = {
    code: fresh.latestCode || '',
    language: fresh.latestLanguage || 'javascript',
    elapsed_seconds: elapsedSecs,
    remaining_seconds: remainingSecs,
    phase_hint: phaseHint,
    hint_count: fresh.hintCount || 0,
    status: fresh.status,
  };

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

// ---------------------------------------------------------------------------
// Tool: run_code_against_tests
// ---------------------------------------------------------------------------

/**
 * Executes the candidate's code against ALL test cases (visible + hidden).
 *
 * Returns FULL detailed results to the agent — every test, pass/fail, expected
 * vs actual, tags, and error messages. The agent needs complete visibility to
 * give effective, targeted hints. The agent's system prompt is responsible for
 * NOT revealing hidden test details to the candidate.
 *
 * The user-facing `/api/code/run` endpoint still returns lossy hidden results
 * (pass/fail counts only). This tool exists specifically for the agent.
 */
export async function runCodeAgainstTests(args, context) {
  const { sessionId, session, question } = context;

  const isTestSession = sessionId?.startsWith('live-run-') || sessionId?.startsWith('test-');

  // Refresh session for latest code
  const fresh = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { latestCode: true, latestLanguage: true, startedAt: true, hintCount: true },
  });

  // For test sessions, return mock test results directly
  if (isTestSession && !fresh) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          passed: 3,
          total: 5,
          all_passed: false,
          failure_category: 'edge_case',
          visible: {
            passed: 2,
            total: 2,
            results: [
              { id: 'v1', name: 'Example 1', visible: true, passed: true, input: [2,7,11,15], expected: [0,1], actual: [0,1] },
              { id: 'v2', name: 'Example 2', visible: true, passed: true, input: [3,2,4], expected: [1,2], actual: [1,2] },
            ],
          },
          hidden: {
            passed: 1,
            total: 3,
            results: [
              { id: 'h1', name: 'Hidden 1', visible: false, passed: true },
              { id: 'h2', name: 'Hidden 2', visible: false, passed: false },
              { id: 'h3', name: 'Hidden 3', visible: false, passed: false },
            ],
          },
          elapsed_seconds: 181,
          remaining_seconds: 1619,
        }),
      }],
    };
  }

  if (!fresh) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found' }) }] };
  }

  const code = fresh.latestCode;
  const language = fresh.latestLanguage || 'javascript';

  if (!code || code.trim().length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'No code submitted yet',
          passed: 0, total: 0, all_passed: false,
          failure_category: 'compile_error',
        }),
      }],
    };
  }

  if (!question) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'No question associated with this session' }),
      }],
    };
  }

  // Load visible tests (examples) + hidden tests — run ALL of them
  const examples = parseJson(question.examples, []);
  const hiddenTestsRaw = parseJson(question.hidden_tests, []);

  const visibleTests = Array.isArray(examples)
    ? examples.map((e, i) => ({
        id: `v${i + 1}`,
        input: parseMaybeJson(e.input),
        expected: parseMaybeJson(e.output),
        tags: ['visible'],
        description: e.explanation || `example ${i + 1}`,
      }))
    : [];

  const hiddenTests = Array.isArray(hiddenTestsRaw)
    ? buildHiddenTests(hiddenTestsRaw)
    : [];

  const allTests = [...visibleTests, ...hiddenTests];

  if (allTests.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'No test cases available for this question' }),
      }],
    };
  }

  // Generate harness and run
  const harnessFn = HARNESS_GENERATORS[language];
  if (!harnessFn) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Unsupported language: ${language}`,
          failure_category: 'compile_error',
        }),
      }],
    };
  }

  let harnessCode;
  try {
    harnessCode = harnessFn(code, allTests);
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Harness generation failed: ${err.message}`,
          failure_category: 'compile_error',
        }),
      }],
    };
  }

  // Execute via Judge0
  let executionResult;
  try {
    executionResult = await executeCode(harnessCode, language, '');
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Execution failed: ${err.message}`,
          passed: 0, total: allTests.length, all_passed: false,
          failure_category: 'runtime_error',
        }),
      }],
    };
  }

  // Handle compile/runtime errors from Judge0
  if (executionResult.compilationError) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          passed: 0,
          total: allTests.length,
          all_passed: false,
          failure_category: 'compile_error',
          error_detail: executionResult.compilationError?.substring(0, 500) || 'Compilation failed',
        }),
      }],
    };
  }

  if (executionResult.runtimeError) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          passed: 0,
          total: allTests.length,
          all_passed: false,
          failure_category: 'runtime_error',
          error_detail: executionResult.runtimeError?.substring(0, 500) || 'Runtime error',
        }),
      }],
    };
  }

  // Parse test results
  const testResults = extractJsonResults(executionResult.stdout);
  if (!testResults || !Array.isArray(testResults)) {
    const stdoutPreview = (executionResult.stdout || '').substring(0, 500);
    const stderrPreview = (executionResult.stderr || '').substring(0, 500);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          passed: 0,
          total: allTests.length,
          all_passed: false,
          failure_category: 'runtime_error',
          error_detail: 'Could not parse test results — the code may have crashed the harness',
          stdout_preview: stdoutPreview || '(empty)',
          stderr_preview: stderrPreview || '(empty)',
        }),
      }],
    };
  }

  // Build per-test detailed results for the agent
  const visibleCount = visibleTests.length;
  const detailedResults = testResults.map((tr, i) => {
    const test = allTests[i] || {};
    const isVisible = i < visibleCount;
    return {
      id: tr.id || test.id || `t${i + 1}`,
      name: tr.name || test.description || `Test ${i + 1}`,
      visible: isVisible,
      passed: tr.passed,
      // Include input/expected/actual so the agent can reason about failures
      // (agent's system prompt must prohibit revealing hidden test details to the candidate)
      input: test.input,
      expected: tr.expected !== undefined ? tr.expected : test.expected,
      actual: tr.actual,
      error: tr.error || null,
      tags: tr.tags || test.tags || [],
    };
  });

  const visibleResults = detailedResults.filter(r => r.visible);
  const hiddenResults = detailedResults.filter(r => !r.visible);

  const passed = detailedResults.filter(t => t.passed).length;
  const total = detailedResults.length;
  const allPassed = passed === total;
  const visiblePassed = visibleResults.filter(t => t.passed).length;
  const hiddenPassed = hiddenResults.filter(t => t.passed).length;

  const failureCategory = allPassed ? null : classifyFailure(executionResult, detailedResults, allTests);

  const now = new Date();
  const startedAt = fresh.startedAt ? new Date(fresh.startedAt).getTime() : null;
  const elapsedSecs = startedAt ? Math.floor((now.getTime() - startedAt) / 1000) : 0;
  const remainingSecs = startedAt ? Math.max(0, DEFAULT_TIME_BUDGET_SECS - elapsedSecs) : DEFAULT_TIME_BUDGET_SECS;

  // Full result for the agent
  const result = {
    passed,
    total,
    all_passed: allPassed,
    failure_category: failureCategory,
    visible: {
      passed: visiblePassed,
      total: visibleResults.length,
      results: visibleResults,
    },
    hidden: {
      passed: hiddenPassed,
      total: hiddenResults.length,
      results: hiddenResults,
    },
    elapsed_seconds: elapsedSecs,
    remaining_seconds: remainingSecs,
  };

  // Log this test run as an event (lossy — feedback agent doesn't need per-test detail)
  try {
    await prisma.eventLog.create({
      data: {
        sessionId,
        eventType: 'test_run',
        payload: {
          passed,
          total,
          allPassed,
          visiblePassed,
          hiddenPassed,
          failureCategory,
          language,
          timestamp: now.toISOString(),
        },
      },
    });
  } catch (err) {
    console.error('[mcp] Failed to log test_run event:', err.message);
  }

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

// ---------------------------------------------------------------------------
// Tool: log_event
// ---------------------------------------------------------------------------

/**
 * Records a structured event for the post-session feedback agent.
 * Increments hint_count on hint_given events.
 */
export async function logEvent(args, context) {
  const { sessionId } = context;
  const { event_type, payload } = args;

  if (!event_type) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'event_type is required' }) }] };
  }

  const validTypes = ['hint_given', 'phase_change', 'code_snapshot', 'test_run', 'interview_started', 'interview_ended'];
  if (!validTypes.includes(event_type)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Invalid event_type: ${event_type}. Must be one of: ${validTypes.join(', ')}`,
        }),
      }],
    };
  }

  try {
    // Record the event
    await prisma.eventLog.create({
      data: {
        sessionId,
        eventType: event_type,
        payload: payload || {},
      },
    });

    // Bump hint_count on hint_given
    if (event_type === 'hint_given') {
      await prisma.session.update({
        where: { id: sessionId },
        data: { hintCount: { increment: 1 } },
      });
    }

    // Set startedAt on interview_started if not already set
    if (event_type === 'interview_started') {
      await prisma.session.updateMany({
        where: { id: sessionId, startedAt: null },
        data: { startedAt: new Date(), status: 'in_progress' },
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ok: true, event_type, session_id: sessionId }),
      }],
    };
  } catch (err) {
    console.error('[mcp] log_event failed:', err.message);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Failed to log event: ${err.message}` }),
      }],
    };
  }
}
