/**
 * Text-only WS client wrapping the ElevenLabs SDK Conversation class.
 *
 * Provides:
 *   start() — connect and begin the conversation
 *   sendUser(text) — send a user message
 *   awaitAgentReply({ timeoutMs }) — wait for the next agent response
 *   endSession() — disconnect cleanly
 *   getConversationId() — get the conversation ID from initiation metadata
 *   fetchTranscript() — GET full transcript with workflow_node_id + tool_calls
 *   rawEvents — array of every raw WS message received (for debugging)
 */
import { Conversation } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/Conversation.js';
import { ClientTools } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/ClientTools.js';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js/Client.js';
import { NullAudioInterface } from './null-audio.mjs';

export class LiveConversationClient {
  static #sendPatched = false;
  /** @type {Map<string, {nodeId: string, title: string}>} */
  static #sessionMap = new Map();

  /** @type {Conversation|null} */
  #conversation = null;

  /** @type {ElevenLabsClient} */
  #client;

  /** @type {NullAudioInterface} */
  #audio;

  /** @type {ClientTools} */
  #clientTools;

  /** @type {string} */
  #agentId;

  /** @type {Object} */
  #initConfig;

  /** @type {Array<Object>} raw WS messages received */
  rawEvents = [];

  /** @type {Array<{ role: string, message: string }>} sequential agent responses (interim) */
  #agentResponseParts = [];

  /** @type {number} timestamp of last agent response chunk */
  #lastAgentChunkTime = 0;

  /** @type {{ resolve: Function, reject: Function }|null} */
  #pendingReply = null;

  /** @type {{ resolve: Function, reject: Function }|null} */
  #pendingAgentChunk = null;

  /** @type {boolean} */
  #ended = false;

  /** @type {number} timestamp of last skip_turn */
  #lastSkipTurn = 0;

  /**
   * @param {Object} opts
   * @param {string} opts.apiKey - ElevenLabs platform key
   * @param {string} opts.agentId
   * @param {Object} [opts.dynamicVariables]
   * @param {Object} [opts.clientToolMocks] - { toolName: () => value }
   * @param {boolean} [opts.textOnly=true]
   * @param {string} [opts.startingNodeId] - starting_workflow_node_id to attempt
   * @param {string} [opts.title] - conversation title visible in ElevenLabs UI
   * @param {Object} [opts.extraBody] - additional fields for custom_llm_extra_body
   */
  constructor(opts) {
    this.#agentId = opts.agentId;
    this.#client = new ElevenLabsClient({ apiKey: opts.apiKey });
    this.#audio = new NullAudioInterface();

    // Build tool mocks
    this.#clientTools = new ClientTools();
    if (opts.clientToolMocks) {
      for (const [name, handler] of Object.entries(opts.clientToolMocks)) {
        this.#clientTools.register(name, handler);
      }
    }

    // Build config override
    const textOnly = opts.textOnly !== false;
    const configOverride = {
      ...(opts.conversationConfigOverride || {}),
    };
    if (textOnly) {
      configOverride.conversation = {
        ...(configOverride.conversation || {}),
        text_only: true,
      };
    }

    // Starting node ID can go in multiple places — capture all
    const extraBody = {
      ...(opts.extraBody || {}),
    };
    if (opts.startingNodeId && !extraBody.starting_workflow_node_id) {
      extraBody.starting_workflow_node_id = opts.startingNodeId;
    }

    this.#initConfig = {
      extraBody,
      conversationConfigOverride: configOverride,
      dynamicVariables: opts.dynamicVariables || {},
      title: opts.title || null,
    };
  }

  /**
   * Start the conversation session.
   * Resolves once the WS is open (conversation_id may not yet be available).
   */
  async start() {
    const nodeId = this.#initConfig.extraBody?.starting_workflow_node_id;
    const title = this.#initConfig.title;
    
    // Permanently wrap WebSocket.send to inject starting_workflow_node_id
    // and title into the first conversation_initiation_client_data of EACH
    // conversation (needed for parallel scenarios).
    if (nodeId && !LiveConversationClient.#sendPatched) {
      LiveConversationClient.#sendPatched = true;
      const WSModule = await import('ws');
      const WsClass = WSModule.default || WSModule.WebSocket || WSModule;
      const origSend = WsClass.prototype.send;
      WsClass.prototype.send = function(data) {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'conversation_initiation_client_data') {
            const sid = msg.dynamic_variables?.secret__session_id;
            const wsData = sid ? LiveConversationClient.#sessionMap.get(sid) : null;
            if (wsData?.nodeId && !msg.starting_workflow_node_id) {
              msg.starting_workflow_node_id = wsData.nodeId;
              console.log('[ws-client] Injected starting_workflow_node_id:', wsData.nodeId, 'for', sid?.slice(-8));
            }
            if (wsData?.title && !msg.custom_llm_extra_body?.title) {
              msg.custom_llm_extra_body = msg.custom_llm_extra_body || {};
              msg.custom_llm_extra_body.title = wsData.title;
            }
            data = JSON.stringify(msg);
          }
        } catch {}
        return origSend.call(this, data);
      };
    }
    // Register by session_id so the send wrapper can find us.
    const sessionId = this.#initConfig.dynamicVariables?.secret__session_id;
    if (nodeId && sessionId) {
      LiveConversationClient.#sessionMap.set(sessionId, { nodeId, title: title || '' });
    }
    
    return new Promise((resolve, reject) => {
      this.#conversation = new Conversation({
        client: this.#client,
        agentId: this.#agentId,
        requiresAuth: true,
        audioInterface: this.#audio,
        clientTools: this.#clientTools,
        config: this.#initConfig,
        callbackAgentResponse: (text) => {
          this.#agentResponseParts.push({ role: 'agent', message: text });
          this.#lastAgentChunkTime = Date.now();
          if (this.#pendingAgentChunk) {
            this.#pendingAgentChunk.resolve(null);
          }
        },
        callbackMessageReceived: (message) => {
          // Detect skip_turn calls — agent is intentionally staying silent
          if (message?.type === 'client_tool_call' && message.client_tool_call?.tool_name === 'skip_turn') {
            this.#lastSkipTurn = Date.now();
          }
          // Capture agent_chat_response_part (voice/text streaming chunks)
          if (message?.type === 'agent_chat_response_part' && message.message?.trim()) {
            this.#agentResponseParts.push({ role: 'agent', message: message.message });
            this.#lastAgentChunkTime = Date.now();
            this.#lastSkipTurn = 0;
            if (this.#pendingAgentChunk) this.#pendingAgentChunk.resolve(null);
          }
          // Capture agent_response events — in text-only mode, follow-up
          // responses often arrive as agent_response (final assembled text).
          // Only push if different from what agent_chat_response_part already gave.
          if (message?.type === 'agent_response' && message.agent_response_event?.agent_response?.trim()) {
            const text = message.agent_response_event.agent_response;
            // Avoid duplicates: if the last part has the same text, skip
            const lastPart = this.#agentResponseParts[this.#agentResponseParts.length - 1];
            if (!lastPart || lastPart.message !== text) {
              this.#agentResponseParts.push({ role: 'agent', message: text });
              this.#lastAgentChunkTime = Date.now();
              this.#lastSkipTurn = 0;
              if (this.#pendingAgentChunk) this.#pendingAgentChunk.resolve(null);
            }
          }
          this.rawEvents.push(message);
        },
      });

      this.#conversation.on('error', (err) => {
        if (!this.#ended) reject(err);
      });

      this.#conversation.startSession()
        .then(() => resolve())
        .catch(reject);
    });
  }

  /**
   * Wait until the conversation ID is available from the initiation metadata.
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<string>}
   */
  async waitForConversationId(timeoutMs = 10000) {
    const existing = this.getConversationId();
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const poll = () => {
        const id = this.getConversationId();
        if (id) return resolve(id);
        if (Date.now() - startTime > timeoutMs) {
          return reject(new Error(`Timeout waiting for conversation ID after ${timeoutMs}ms`));
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  /**
   * Send a user text message.
   * @param {string} text
   */
  sendUser(text) {
    if (!this.#conversation) throw new Error('Session not started');
    this.#conversation.sendUserMessage(text);
  }

  /**
   * Send a contextual_update to inject background context.
   * Agent reads this as prior conversation without consuming a turn.
   */
  sendContextualUpdate(text) {
    if (!text || !this.#conversation) return;
    try {
      this.#conversation._ws?.send(JSON.stringify({
        type: 'contextual_update',
        contextual_update: { text },
      }));
    } catch { /* best-effort */ }
  }

  /**
   * Wait for the next complete agent reply.
   * The SDK fires callbackAgentResponse per text chunk; we aggregate.
   * After a quiescent period with no new chunks, we resolve with the joined text.
   *
   * @param {Object} [opts]
   * @param {number} [opts.timeoutMs=30000] - max wait for a reply
   * @param {number} [opts.quiescentMs=1200] - silence after last chunk = done
   * @returns {Promise<{ role: string, message: string }>}
   */
  async awaitAgentReply(opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const quiescentMs = opts.quiescentMs ?? 1200;

    const startTime = Date.now();
    const partsBefore = this.#agentResponseParts.length;
    // Reset skip_turn marker so it only counts a skip_turn fired *this* turn.
    // Without this, one skip_turn early in the conversation would cause every
    // later awaitAgentReply to short-circuit instantly.
    const skipTurnSnapshot = this.#lastSkipTurn;
    this.#lastSkipTurn = 0;

    // Wait for at least one new chunk, then wait for quiescence
    // After receiving a text chunk, keep waiting if tool activity is ongoing
    let lastAnyEvent = this.#lastAgentChunkTime;
    
    while (true) {
      // Check BOTH: pre-existing skip_turn (snapshot) AND new skip_turn that
      // arrived during *this* turn. Either one qualifies.
      const effectiveSkipTurn = Math.max(skipTurnSnapshot, this.#lastSkipTurn);
      if (effectiveSkipTurn > 0 && Date.now() - effectiveSkipTurn >= 3000) {
        const newParts = this.#agentResponseParts.slice(partsBefore);
        const joined = newParts.map(p => p.message).join(' ').trim();
        return { role: 'agent', message: joined, skipTurn: true };
      }

      // Check if we already have chunks and they've gone silent
      const newParts = this.#agentResponseParts.slice(partsBefore);
      const elapsedSinceLastText = Date.now() - this.#lastAgentChunkTime;

      // Check raw events for recent tool activity (MCP calls in flight)
      const recentToolEvents = this.rawEvents.slice(-20).filter(ev =>
        ev.type === 'mcp_tool_call' || ev.type === 'client_tool_call'
      );
      const lastToolTime = recentToolEvents.length > 0
        ? Date.now() // Conservative: if any tool event exists, assume ongoing
        : 0;
      const elapsedSinceLastTool = Date.now() - lastToolTime;
      const anyRecentToolActivity = recentToolEvents.some(ev => {
        if (ev.type === 'mcp_tool_call') {
          return ev.mcp_tool_call?.state === 'loading';
        }
        return false;
      });

      if (newParts.length > 0 && elapsedSinceLastText >= quiescentMs && !anyRecentToolActivity) {
        const joined = newParts.map(p => p.message).join(' ').trim();
        if (joined.length > 0) {
          return { role: 'agent', message: joined };
        }
        // Empty parts — reset partsBefore to skip these and keep waiting
        partsBefore = this.#agentResponseParts.length;
      }

      if (Date.now() - startTime >= timeoutMs) {
        // Timeout — return what we have, or throw
        if (newParts.length > 0) {
          const joined = newParts.map(p => p.message).join(' ').trim();
          if (joined.length > 0) {
            return { role: 'agent', message: joined };
          }
        }
        throw new Error(`Timeout awaiting agent reply after ${timeoutMs}ms`);
      }

      // Wait for next agent chunk or timeout
      const waitMs = Math.min(quiescentMs, 200);
      await new Promise((resolve) => {
        this.#pendingAgentChunk = { resolve, reject: resolve };
        setTimeout(() => {
          if (this.#pendingAgentChunk?.resolve === resolve) {
            this.#pendingAgentChunk = null;
            resolve();
          }
        }, waitMs);
      });
    }
  }

  /**
   * End the session cleanly.
   */
  endSession() {
    this.#ended = true;
    if (this.#conversation) {
      try { this.#conversation.endSession(); } catch { /* ignore */ }
    }
  }

  /**
   * Get the conversation ID from the raw events.
   * @returns {string|null}
   */
  getConversationId() {
    if (this.#conversation) {
      return this.#conversation.getConversationId() || null;
    }
    return this.#extractConversationId();
  }

  /**
   * Extract conversation_id from raw initiation metadata event.
   * @returns {string|null}
   */
  #extractConversationId() {
    for (const ev of this.rawEvents) {
      if (ev.type === 'conversation_initiation_metadata') {
        return ev.conversation_initiation_metadata_event?.conversation_id || null;
      }
    }
    return null;
  }

  /**
   * Fetch the full transcript from the REST API.
   * Polls until the conversation status is "done" (eventual consistency) or timeout.
   *
   * @param {Object} [opts]
   * @param {string} [opts.apiKey]
   * @param {number} [opts.timeoutMs=60000] - total max wait time
   * @param {number} [opts.pollMs=3000] - interval between polls
   * @returns {Promise<Object>} GetConversationResponseModel
   */
  async fetchTranscript(opts = {}) {
    const convId = this.getConversationId();
    if (!convId) throw new Error('No conversation ID available');
    const apiKey = opts.apiKey || this.#client._options?.apiKey;
    const timeoutMs = opts.timeoutMs ?? 60000;
    const pollMs = opts.pollMs ?? 3000;

    const startTime = Date.now();
    let lastErr;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${convId}`,
          { headers: { 'xi-api-key': apiKey } }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = await res.json();

        // If status is "done" and we have transcript entries, return immediately
        if (data.status === 'done' && data.transcript?.length > 0) {
          return data;
        }

        // Still processing — wait and retry
        if (data.status !== 'done') {
          lastErr = new Error(`Conversation status: ${data.status}`);
        } else if (!data.transcript?.length) {
          lastErr = new Error('Conversation done but transcript empty');
        }

        await new Promise(r => setTimeout(r, pollMs));
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, pollMs));
      }
    }

    // One final attempt before giving up
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${convId}`,
        { headers: { 'xi-api-key': apiKey } }
      );
      if (res.ok) return await res.json();
    } catch { /* ignore */ }

    throw lastErr || new Error(`Timed out fetching transcript after ${timeoutMs}ms`);
  }

  /**
   * Normalise the server transcript into a simpler array.
   * Each entry: { role, message, workflowNodeId, toolCalls, toolResults }
   *
   * @param {Object} serverResponse - from fetchTranscript
   * @returns {Array<Object>}
   */
  static normaliseTranscript(serverResponse) {
    const transcript = serverResponse.transcript || [];
    // Strip MocklyMCPServer_ prefix from tool names for readability
    const cleanName = (name) => (name || '').replace(/^MocklyMCPServer_/, '');
    return transcript.map(turn => ({
      role: turn.role || 'unknown',
      message: turn.message || '',
      agent_metadata: turn.agent_metadata || null,
      tool_calls: (turn.tool_calls || []).map(tc => ({
        tool_name: cleanName(tc.tool_name),
        params_as_json: tc.params_as_json,
        tool_has_been_called: tc.tool_has_been_called,
      })),
      tool_results: (turn.tool_results || []).map(tr => ({
        tool_name: cleanName(tr.tool_name),
        result_value: tr.result_value,
        is_error: tr.is_error,
      })),
      // Also add camelCase convenience fields for programmatic use
      workflowNodeId: turn.agent_metadata?.workflow_node_id || null,
      toolCalls: (turn.tool_calls || []).map(tc => ({
        toolName: cleanName(tc.tool_name),
        paramsAsJson: tc.params_as_json,
        toolHasBeenCalled: tc.tool_has_been_called,
      })),
      toolResults: (turn.tool_results || []).map(tr => ({
        toolName: cleanName(tr.tool_name),
        resultValue: tr.result_value,
        isError: tr.is_error,
      })),
    }));
  }
}
