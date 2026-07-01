/**
 * Test session endpoints — used by the eval harness to set up test sessions
 * and by the sim-user to inject code during live test conversations.
 *
 * All endpoints require a TEST_API_KEY shared secret. This is separate from
 * the MCP shared secret so the harness can't accidentally talk to MCP.
 */

import { Router } from 'express';
import { setupTestSession, injectTestCode, getTestSession, cleanupTestSession } from '../lib/test-store.js';

const router = Router();
const TEST_API_KEY = process.env.TEST_API_KEY;

function requireTestKey(req, res, next) {
  if (!TEST_API_KEY) {
    return res.status(500).json({ error: 'TEST_API_KEY not configured on server' });
  }
  const provided = req.headers['x-test-api-key'];
  if (!provided || provided !== TEST_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: invalid test API key' });
  }
  next();
}

/**
 * POST /api/test/setup
 * Called by the harness before a test scenario runs.
 * Sets up the in-memory store with question context.
 *
 * Body: {
 *   sessionId: string,        // the live-run-* ID for this test
 *   question: {               // matches the Question model shape
 *     examples: [...],
 *     hidden_tests: [...],
 *     function_name: string,
 *     ...
 *   },
 *   code: string (optional),  // initial code (empty by default)
 *   language: string (optional, default 'python')
 * }
 */
router.post('/setup', requireTestKey, (req, res) => {
  const { sessionId, question, code, language, mockResults } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  setupTestSession(sessionId, {
    code: code || '',
    language: language || 'python',
    question: question || null,
    mockResults: mockResults || null,
  });
  console.log(`[test] Session set up: ${sessionId} (mock: ${!!mockResults})`);
  res.json({ ok: true, sessionId });
});

/**
 * POST /api/test/code
 * Called by the sim-user during "coding" to inject code.
 *
 * Body: {
 *   sessionId: string,
 *   code: string,
 *   language: string (optional, default 'python')
 * }
 */
router.post('/code', requireTestKey, (req, res) => {
  const { sessionId, code, language } = req.body;
  if (!sessionId || !code) {
    return res.status(400).json({ error: 'sessionId and code are required' });
  }
  injectTestCode(sessionId, code, language);
  console.log(`[test] Code injected for ${sessionId}: ${code.length} chars`);
  res.json({ ok: true, sessionId, codeLength: code.length });
});

/**
 * GET /api/test/session/:sessionId
 * Returns the current state of a test session (for debugging).
 */
router.get('/session/:sessionId', requireTestKey, (req, res) => {
  const session = getTestSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Test session not found' });
  }
  res.json({ ok: true, code: session.code, language: session.language });
});

/**
 * DELETE /api/test/session/:sessionId
 * Clean up a test session after the test completes.
 */
router.delete('/session/:sessionId', requireTestKey, (req, res) => {
  cleanupTestSession(req.params.sessionId);
  res.json({ ok: true });
});

export default router;
