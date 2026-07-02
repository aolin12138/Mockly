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

/** Resolve a session ID with fuzzy matching (strips quotes/whitespace). */
function resolveId(sessionId) {
  if (!sessionId) return null;
  if (store.has(sessionId)) return sessionId;
  const clean = sessionId.trim().replace(/^["']|["']$/g, '');
  if (clean !== sessionId && store.has(clean)) return clean;
  return null;
}

export function setupTestSession(sessionId, { code = '', language = 'python', question = null, mockResults = null } = {}) {
  store.set(sessionId, { code, language, question, mockResults });
}

export function injectTestCode(sessionId, code, language = 'python') {
  const realId = resolveId(sessionId) || sessionId;
  const entry = store.get(realId);
  if (!entry) {
    store.set(realId, { code, language, question: null, mockResults: null });
  } else {
    entry.code = code;
    if (language) entry.language = language;
    entry.mockResults = null;
  }
}

export function getTestSession(sessionId) {
  const realId = resolveId(sessionId);
  return realId ? (store.get(realId) || null) : null;
}

export function cleanupTestSession(sessionId) {
  const realId = resolveId(sessionId) || sessionId;
  store.delete(realId);
}

export function isTestSessionId(sessionId) {
  return resolveId(sessionId) !== null;
}
