/**
 * In-memory test session store.
 * Keyed by session ID (live-run-* or test-*).
 * Stores code, language, and question context for MCP tools.
 *
 * This is completely separate from the production Prisma-backed sessions.
 * No database writes — ephemeral, per-process.
 */

/** @type {Map<string, { code: string, language: string, question: object|null }>} */
const store = new Map();

/**
 * Set up a test session with question context.
 */
export function setupTestSession(sessionId, { code = '', language = 'python', question = null } = {}) {
  store.set(sessionId, { code, language, question });
}

/**
 * Inject code into a test session (called by sim-user during "coding").
 */
export function injectTestCode(sessionId, code, language = 'python') {
  const entry = store.get(sessionId);
  if (!entry) {
    store.set(sessionId, { code, language, question: null });
  } else {
    entry.code = code;
    if (language) entry.language = language;
  }
}

/**
 * Get the current state of a test session.
 * Returns null if the session doesn't exist.
 */
export function getTestSession(sessionId) {
  return store.get(sessionId) || null;
}

/**
 * Clean up a test session after the test completes.
 */
export function cleanupTestSession(sessionId) {
  store.delete(sessionId);
}

/**
 * Check if a session ID is a test session.
 * Accepts IDs that have been explicitly set up via setupTestSession().
 */
export function isTestSessionId(sessionId) {
  if (!sessionId) return false;
  // Check if we have a test session set up for this ID
  return store.has(sessionId);
}
