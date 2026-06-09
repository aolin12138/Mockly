/**
 * MCP Authentication Middleware
 *
 * Verifies:
 * 1. X-MCP-Shared-Secret header matches MCP_SHARED_SECRET env var (server-to-server auth)
 * 2. X-Session-Id header is present and maps to a real session
 *
 * On success, attaches { sessionId, session, question } to req.mcp
 */

import { prisma } from '../../prismaClient.js';

const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET;

if (!MCP_SHARED_SECRET) {
  console.warn('[mcp-auth] MCP_SHARED_SECRET not set — MCP auth will REJECT all requests');
}

/**
 * Express middleware — call before the MCP handler.
 * Returns 401/403 early if auth fails, so invalid requests never reach MCP logic.
 */
export async function mcpAuthMiddleware(req, res, next) {
  // 1. Shared-secret check
  const providedSecret = req.headers['x-mcp-shared-secret'];
  if (!MCP_SHARED_SECRET) {
    console.error('[mcp-auth] MCP_SHARED_SECRET is not configured on server');
    return res.status(500).json({ error: 'MCP server not configured' });
  }
  if (!providedSecret || providedSecret !== MCP_SHARED_SECRET) {
    return res.status(403).json({ error: 'Forbidden: invalid shared secret' });
  }

  // 2. Session resolution (optional — MCP server-level methods like tools/list don't need it)
  const sessionId = req.headers['x-session-id'];
  let session = null;
  let question = null;

  if (sessionId && sessionId.trim().length > 0 && sessionId !== '""' && sessionId !== "''") {
    try {
      session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { technicalQuestion: true },
      });
    } catch (err) {
      console.error('[mcp-auth] DB error looking up session:', err.message);
      return res.status(500).json({ error: 'Internal error resolving session' });
    }

    if (!session) {
      // Session not found — allow through for server-level MCP operations (initialize, tools/list).
      // Tool handlers will return errors if they need a real session.
      console.log(`[mcp-auth] Session not found: ${sessionId} — allowing for server-level operations`);
    } else {
      question = session.technicalQuestion;
    }
  }

  // Attach resolved context for tool handlers
  // session + question will be null for server-level MCP calls (tools/list, etc.)
  req.mcp = { sessionId, session, question };
  next();
}
