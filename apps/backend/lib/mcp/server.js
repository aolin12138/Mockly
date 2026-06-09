/**
 * MCP Server Setup
 *
 * Creates an McpServer with three tools (get_current_code, run_code_against_tests,
 * log_event), managed via a pool of StreamableHTTP transports keyed by
 * ElevenLabs' Mcp-Session-Id.
 *
 * Exports two Express handlers:
 *   mcpPostHandler — for POST /mcp (tool calls, initialization)
 *   mcpGetHandler  — for GET  /mcp (SSE streams)
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { getCurrentCode, runCodeAgainstTests, logEvent } from './tools.js';

// ---------------------------------------------------------------------------
// Transport pool
// ---------------------------------------------------------------------------

/** @type {Record<string, StreamableHTTPServerTransport>} */
const transports = {};

/** @type {Record<string, { sessionId: string, session: object, question: object|null }>} */
const transportContexts = {};

function createTransport() {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sessionId) => {
      console.log(`[mcp] Session initialized: ${sessionId}`);
      transports[sessionId] = transport;
    },
  });

  // Wrap onclose to also clean up context
  const originalOnclose = transport.onclose;
  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      delete transports[sid];
      delete transportContexts[sid];
      console.log(`[mcp] Transport closed for session ${sid}`);
    }
  };

  return transport;
}

// ---------------------------------------------------------------------------
// Build the server + register tools
// ---------------------------------------------------------------------------

function buildMcpServer() {
  const server = new McpServer({
    name: 'mockly-interview-mcp',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
      logging: {},
    },
  });

  // --- Tool: get_current_code ---
  server.registerTool(
    'get_current_code',
    {
      description:
        'Read the candidate\'s current code from the platform editor. ' +
        'Returns the full source, language, elapsed/remaining seconds, ' +
        'current phase hint, and how many hints have been given so far. ' +
        'Call this frequently to monitor candidate progress — it is fast and read-only.',
      inputSchema: z.object({}).strict(),
    },
    async (args, extra) => {
      const mcpSessionId = extra.sessionId;
      const ctx = transportContexts[mcpSessionId];
      if (!ctx) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No session context — reinitialize the connection' }) }] };
      }
      return await getCurrentCode(args, ctx);
    }
  );

  // --- Tool: run_code_against_tests ---
  server.registerTool(
    'run_code_against_tests',
    {
      description:
        'Execute the candidate\'s current code against ALL test cases (visible examples + ' +
        'hidden edge cases) using a sandboxed runner (Judge0). Returns FULL per-test results ' +
        'including input, expected output, actual output, pass/fail, and error messages — for ' +
        'both visible and hidden tests. This gives you complete visibility to give targeted, ' +
        'relevant hints. CRITICAL RULE: you must NEVER reveal hidden test inputs, expected ' +
        'outputs, or specific hidden test details to the candidate. Use the failure patterns ' +
        'to shape your hints, but describe them in general terms only (e.g. "consider edge ' +
        'cases" not "your code fails on empty string with expected 0 got null").',
      inputSchema: z.object({}).strict(),
    },
    async (args, extra) => {
      const mcpSessionId = extra.sessionId;
      const ctx = transportContexts[mcpSessionId];
      if (!ctx) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No session context — reinitialize the connection' }) }] };
      }
      return await runCodeAgainstTests(args, ctx);
    }
  );

  // --- Tool: log_event ---
  server.registerTool(
    'log_event',
    {
      description:
        'Record a structured event for the post-interview feedback agent. ' +
        'Use this to log: hints given (event_type: "hint_given"), phase transitions ' +
        '(event_type: "phase_change"), code snapshots (event_type: "code_snapshot"), ' +
        'test runs (event_type: "test_run"), interview start/end ' +
        '(event_type: "interview_started", "interview_ended"). ' +
        'The feedback agent reads these events after the session to generate detailed analysis.',
      inputSchema: z.object({
        event_type: z.enum([
          'hint_given', 'phase_change', 'code_snapshot', 'test_run',
          'interview_started', 'interview_ended',
        ]).describe('The type of event to record'),
        payload: z.object({}).passthrough().optional()
          .describe('Event-specific data as a JSON object'),
      }),
    },
    async (args, extra) => {
      const mcpSessionId = extra.sessionId;
      const ctx = transportContexts[mcpSessionId];
      if (!ctx) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No session context — reinitialize the connection' }) }] };
      }
      return await logEvent(args, ctx);
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// POST /mcp handler
// ---------------------------------------------------------------------------

/**
 * Express handler for POST /mcp.
 * Expects req.mcp to be set by auth middleware (sessionId, session, question).
 */
export async function mcpPostHandler(req, res) {
  const ctx = req.mcp;
  if (!ctx) {
    return res.status(500).json({ error: 'MCP auth context missing' });
  }

  const sessionId = req.headers['mcp-session-id'];

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      // Re-attach context in case it was cleaned up
      if (!transportContexts[sessionId]) {
        transportContexts[sessionId] = ctx;
      }
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = createTransport();
      const server = buildMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      // After initialization, store context keyed by the MCP session ID
      const mcpSid = transport.sessionId;
      if (mcpSid) {
        transportContexts[mcpSid] = ctx;
      }
      return;
    } else if (sessionId) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: Session ID required' },
        id: null,
      });
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] POST handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

/**
 * Express handler for GET /mcp (SSE streams).
 */
export async function mcpGetHandler(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).json({ error: 'Invalid or missing session ID' });
  }

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('[mcp] GET handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
