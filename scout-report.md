# ElevenLabs MCP Server API — Research Report

## 1. Objective

Research how to create and configure an MCP server on ElevenLabs via API, wire it into an agent config, use secret dynamic variables as per-tool-call headers, and map tool response values back to dynamic variables via dot-path assignment.

## 2. Scope and Method

**Inspected:** ElevenLabs official docs (web) — API reference for MCP server create, MCP overview page, Dynamic variables page.
**Local files:** `mcp_plan.md` (existing architecture plan), `tech_agent_full.json` (agent config with workflow), `.env` (secrets).

## 3. Key Findings

### 3.1 Create MCP Server — Exact curl Command

**Endpoint:** `POST https://api.elevenlabs.io/v1/convai/mcp-servers`

**Auth:** `xi-api-key` header with your platform API key (`fdb1ed31791beb50b4b9a0e1dc4ad2032a713e289a634371e918599638c66b08`).

```bash
curl -X POST https://api.elevenlabs.io/v1/convai/mcp-servers \
  -H "xi-api-key: fdb1ed31791beb50b4b9a0e1dc4ad2032a713e289a634371e918599638c66b08" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "url": "https://our-domain.com/mcp",
      "name": "Mockly MCP Server",
      "description": "Mockly interview tools — code fetch, test execution, event logging",
      "transport": "STREAMABLE_HTTP",
      "approval_policy": "auto_approve_all",
      "response_timeout_secs": 30,
      "request_headers": {
        "X-MCP-Shared-Secret": "mockly-mcp-shared-secret-2026",
        "X-Session-Id": {
          "variable_name": "secret__session_id"
        }
      }
    }
  }'
```

**Required `config` fields:**
| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | Must use `https` |
| `name` | `string` | Display name in workspace |

**Key optional fields:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `transport` | `"SSE"` \| `"STREAMABLE_HTTP"` | `"SSE"` | Use `STREAMABLE_HTTP` |
| `approval_policy` | `"auto_approve_all"` \| `"require_approval_all"` \| `"require_approval_per_tool"` | `"require_approval_all"` | Use `auto_approve_all` for backend tools |
| `request_headers` | `object` (key → value) | — | Value can be plain `string`, `{"variable_name": "..."}` (dynamic var), `{"secret_id": "..."}` (workspace secret), `{"env_var_label": "..."}` (env var) |
| `response_timeout_secs` | `integer` (5–300) | `30` | Per-tool timeout |
| `secret_token` | string or secret locator | — | Authorization header value |
| `execution_mode` | `"immediate"` \| `"post_tool_speech"` \| `"async"` | `"immediate"` | |
| `tool_config_overrides` | array | — | Per-tool config overrides (includes `assignments`) |
| `disable_compression` | `boolean` | `false` | Enable if server doesn't support compression |

### 3.2 MCP Server Response — ID Field

The response is `McpServerResponseModel`:

```json
{
  "id": "mcp_xxxxxxxxxxxxx",
  "config": { ... },
  "access_info": { ... },
  "dependent_agents": [],
  "metadata": {
    "created_at": 1234567890,
    "owner_user_id": "..."
  }
}
```

**The MCP server ID is at `response.id`.** This is the value you use in agent config.

### 3.3 Wiring MCP Server into Agent Config

In the agent update call, under `conversation_config.agent.prompt`:

```json
{
  "conversation_config": {
    "agent": {
      "prompt": {
        "mcp_server_ids": ["mcp_xxxxxxxxxxxxx"],
        "native_mcp_server_ids": []
      }
    }
  }
}
```

Both fields are arrays of string IDs. From the docs example (Python SDK):

```python
elevenlabs.conversational_ai.agents.update(
    agent_id="agent_...",
    conversation_config={
        "agent": {"prompt": {"mcp_server_ids": [server.id]}},
    },
)
```

**`mcp_server_ids`** — for user-created MCP servers (your backend).
**`native_mcp_server_ids`** — for ElevenLabs native/built-in MCP servers.

Confirmed in the existing agent config (`tech_agent_full.json`), both fields are present under `prompt`:
```json
"mcp_server_ids": [],
"native_mcp_server_ids": []
```

### 3.4 Secret Dynamic Variables (`secret__` prefix)

From [Dynamic variables docs](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables):

> Secret dynamic variables are populated in the same way as normal dynamic variables but indicate to our ElevenAgents that these should **only be used in dynamic variable headers and never sent to an LLM provider** as part of an agent's system prompt or first message.

**To create a secret dynamic variable:** prefix the dynamic variable name with `secret__`.

**Usage pattern for our MCP server:**

1. **Define the header** in the MCP server config `request_headers`, referencing the dynamic variable:
   ```json
   "X-Session-Id": { "variable_name": "secret__session_id" }
   ```

2. **At conversation start**, pass the session ID as a dynamic variable:
   ```python
   config = ConversationInitiationData(
       dynamic_variables={
           "secret__session_id": "sess_abc123"
       }
   )
   ```

3. ElevenLabs resolves `secret__session_id` at runtime and sends it ONLY as the `X-Session-Id` HTTP header on MCP tool calls — **never in the system prompt or to the LLM.**

### 3.5 Dynamic Variable Assignments (Dot-Path Mapping)

From the API spec, `DynamicVariableAssignment` schema:

```json
{
  "source": "response",
  "dynamic_variable": "remaining_minutes",
  "value_path": "remaining_seconds",
  "sanitize": false,
  "preserve_native_type": false
}
```

| Field | Description |
|-------|-------------|
| `source` | Always `"response"` (only supported source currently) |
| `dynamic_variable` | The dynamic variable name to assign to (e.g., `"remaining_minutes"`) |
| `value_path` | Dot notation path into the tool's JSON response (e.g., `"remaining_seconds"`, `"data.user.name"`, `"users.0.email"`) |
| `sanitize` | If `true`, value is removed from tool response before sending to LLM |
| `preserve_native_type` | If `true`, lists/objects stored as native type instead of stringified JSON |

**Where to configure:**
- For MCP tools: nested under `tool_config_overrides[].assignments[]` in the MCP server config
- Can be set at MCP server creation time, or updated later via `PUT /v1/convai/mcp-servers/{id}`
- Can also be set per-tool via the tool configuration override API: `POST /v1/convai/mcp-servers/{mcp_server_id}/tool-configurations`

**Example — assigning `remaining_minutes` from a tool's JSON response field `remaining_seconds`:**
```json
"tool_config_overrides": [
  {
    "tool_name": "get_current_code",
    "assignments": [
      {
        "source": "response",
        "dynamic_variable": "remaining_minutes",
        "value_path": "remaining_seconds"
      }
    ]
  }
]
```

If the tool response is `{"remaining_seconds": 588, ...}`, the dynamic variable `{{remaining_minutes}}` would be set to `588`.

**For secret dynamic variables in assignments:** Use the `sanitize: true` flag to strip the extracted value from the LLM-visible response while still processing the assignment.

### 3.6 Complete Wiring Flow Summary

1. **Create MCP server** → get back `id` (e.g., `"mcp_abc123"`)
2. **Update agent prompt** → add `"mcp_server_ids": ["mcp_abc123"]`
3. **At conversation start** → pass `"secret__session_id": "actual-session-uuid"` as a dynamic variable
4. **EL calls your MCP tools** → sends `X-Session-Id` header with the session ID, `X-MCP-Shared-Secret` header with the shared secret
5. **Tool responses can update dynamic variables** → via `assignments` with dot-path `value_path`
6. **Updated dynamic variables** can be used in agent prompts (e.g., `{{remaining_minutes}}`) and edge conditions in workflow transitions

## 4. Recommended Resources

| Resource | URL |
|----------|-----|
| Create MCP server API ref | https://elevenlabs.io/docs/eleven-agents/api-reference/mcp/create |
| MCP overview (with SDK examples) | https://elevenlabs.io/docs/eleven-agents/customization/tools/mcp |
| Dynamic variables docs | https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables |
| Tool configuration override (for assignments) | https://elevenlabs.io/docs/eleven-agents/api-reference/mcp/tool-configuration/create |
| Update MCP server | https://elevenlabs.io/docs/api-reference/mcp/update |
| Local plan: `mcp_plan.md` | Full architecture for interview MCP tools |
| Local agent config: `tech_agent_full.json` | Existing agent with workflow — shows `mcp_server_ids` and `native_mcp_server_ids` fields |

## 5. Risks and Open Questions

1. **`X-Session-Id` header name conflict:** The ElevenLabs dashboard UI labels headers as "HTTP Headers" but the API schema field is `request_headers`. The dynamic variable reference format `{"variable_name": "secret__session_id"}` is confirmed in the schema — but verify it works end-to-end with a test call.

2. **`approval_policy: auto_approve_all` may not work for all tools out of the box.** Some tools may need explicit approval hashes if the server-level policy is `require_approval_per_tool`. For simplicity, use `auto_approve_all` for backend-to-backend tool calls.

3. **Dynamic variable update timing:** Dynamic variables updated via tool response assignments may not be immediately available for edge condition evaluation in the same turn. Test the lag between tool response and workflow edge evaluation.

4. **Tool discovery:** ElevenLabs probes your MCP server at creation time to list available tools. Your `/mcp` endpoint must be live and respond correctly to the `tools/list` MCP method before the create call succeeds. Ensure your `StreamableHTTPServerTransport` is deployed and reachable.

5. **`value_path` behavior on missing fields:** If the dot path doesn't exist in the response, the assignment is silently skipped (no update, no error). Plan your response shapes accordingly.

## 6. Citations

- ElevenLabs Docs — "Create MCP server" API reference: `POST /v1/convai/mcp-servers` — https://elevenlabs.io/docs/eleven-agents/api-reference/mcp/create
- ElevenLabs Docs — "Model Context Protocol" overview — https://elevenlabs.io/docs/eleven-agents/customization/tools/mcp
- ElevenLabs Docs — "Dynamic variables" — https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- ElevenLabs Docs API schema — `McpServerConfigInput`, `DynamicVariableAssignment`, `ConvAIDynamicVariable` schemas (in OpenAPI spec on create page)
- Project: `mcp_plan.md` — MCP server architecture plan (sections 2–4 on wiring, auth, dynamic variables)
- Project: `tech_agent_full.json` — existing agent workflow, confirms `mcp_server_ids` / `native_mcp_server_ids` fields at `conversation_config.agent.prompt`
