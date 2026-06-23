/**
 * Scenario loader — reads scenario JSON files, merges common criteria,
 * validates against schema, and returns normalized scenario objects.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { CONFIG, realToolName, TOOL_SCHEMAS } from './config.mjs';

/**
 * Load the JSON schema for validation.
 */
function loadSchema() {
  const schemaPath = resolve(CONFIG.scenariosDir, 'schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf-8'));
}

/**
 * Load common criteria that are merged into every scenario.
 */
function loadCommonCriteria() {
  if (!existsSync(CONFIG.commonCriteriaPath)) return [];
  return JSON.parse(readFileSync(CONFIG.commonCriteriaPath, 'utf-8'));
}

/**
 * Simple JSON Schema validation (covers the fields we need).
 * For production, use ajv — this is a lightweight inline check.
 */
function validateScenario(scenario, schema) {
  const errors = [];

  // Required top-level fields
  for (const field of schema.required || []) {
    if (!(field in scenario)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Tags
  if (!Array.isArray(scenario.tags) || scenario.tags.length === 0) {
    errors.push('tags must be a non-empty array');
  }

  // simulated_user
  if (!scenario.simulated_user?.prompt) {
    errors.push('simulated_user.prompt is required');
  }

  // new_turns_limit
  if (typeof scenario.new_turns_limit !== 'number' || scenario.new_turns_limit < 1 || scenario.new_turns_limit > 50) {
    errors.push('new_turns_limit must be a number between 1 and 50');
  }

  // evaluation_criteria
  if (!Array.isArray(scenario.evaluation_criteria) || scenario.evaluation_criteria.length === 0) {
    errors.push('evaluation_criteria must be a non-empty array');
  } else {
    for (const crit of scenario.evaluation_criteria) {
      if (!crit.id) errors.push('evaluation criterion missing id');
      if (!crit.name) errors.push('evaluation criterion missing name');
      if (!crit.conversation_goal_prompt) errors.push(`criterion "${crit.id}" missing conversation_goal_prompt`);
      if (crit.conversation_goal_prompt && crit.conversation_goal_prompt.length > 2000) {
        errors.push(`criterion "${crit.id}" conversation_goal_prompt exceeds 2000 characters (${crit.conversation_goal_prompt.length})`);
      }
    }
  }

  // Tool mocks — validate keys are known tool names
  if (scenario.tool_mocks) {
    for (const [toolName, mock] of Object.entries(scenario.tool_mocks)) {
      if (!realToolName(toolName)) {
        errors.push(`Unknown tool name in mocks: ${toolName}`);
      }
      if (!mock.default_return_value && mock.default_return_value !== '') {
        errors.push(`Tool mock "${toolName}" missing default_return_value`);
      }
    }
  }

  // Mock coherence check: if the simulated user describes their code,
  // the mock should be consistent. (Best-effort heuristic)
  if (scenario.tool_mocks?.get_current_code?.default_return_value) {
    const mockCode = scenario.tool_mocks.get_current_code.default_return_value;
    if (typeof mockCode === 'object' && mockCode.code !== undefined) {
      // Check that the mock code isn't empty when it shouldn't be
      // (We can't fully automate this — it's a flag for manual review)
    }
  }

  return errors;
}

/**
 * Transform tool mock keys from scenario-library names to real agent tool names,
 * and stringify the return values for the API.
 */
function normalizeToolMocks(toolMocks) {
  if (!toolMocks) return {};
  const normalized = {};
  for (const [scenarioName, mock] of Object.entries(toolMocks)) {
    const realName = realToolName(scenarioName);
    normalized[realName] = {
      default_return_value: typeof mock.default_return_value === 'string'
        ? mock.default_return_value
        : JSON.stringify(mock.default_return_value),
      default_is_error: mock.default_is_error || false,
    };
  }
  return normalized;
}

/**
 * Normalize evaluation criteria from scenario format to API format.
 * The scenario JSON uses the API field names directly (conversation_goal_prompt),
 * so this is mostly adding defaults.
 */
function normalizeCriteria(criteria) {
  return criteria.map(c => ({
    id: c.id,
    name: c.name,
    conversation_goal_prompt: c.conversation_goal_prompt,
    use_knowledge_base: c.use_knowledge_base || false,
  }));
}

/**
 * Load a single scenario file and normalize it.
 */
function loadScenario(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const schema = loadSchema();
  const errors = validateScenario(raw, schema);

  if (errors.length > 0) {
    throw new Error(`Validation errors in ${filePath}:\n  - ${errors.join('\n  - ')}`);
  }

  return raw;
}

/**
 * Load all scenarios from the scenarios directory.
 * @param {Object} options
 * @param {string[]} [options.ids] — specific scenario IDs to load
 * @param {string[]} [options.tags] — only load scenarios matching these tags
 * @returns {{ scenarios: Object[], commonCriteria: Object[], filter: string }}
 */
export function loadAllScenarios(options = {}) {
  const { ids, tags } = options;
  const dir = CONFIG.scenariosDir;
  const commonCriteria = loadCommonCriteria();
  const allFiles = readdirSync(dir)
    .filter(f => extname(f) === '.json' && f !== 'schema.json' && f !== 'common_criteria.json')
    .sort();

  const scenarios = [];
  const errors = [];

  for (const file of allFiles) {
    const filePath = resolve(dir, file);
    try {
      const scenario = loadScenario(filePath);

      // Merge common criteria (avoid duplicate ids)
      const existingIds = new Set(scenario.evaluation_criteria.map(c => c.id));
      const mergedCriteria = [
        ...scenario.evaluation_criteria,
        ...commonCriteria.filter(c => !existingIds.has(c.id)),
      ];

      // Transform tool mocks to real names
      const normalizedMocks = normalizeToolMocks(scenario.tool_mocks || {});

      scenarios.push({
        ...scenario,
        _sourceFile: file,
        tool_mocks: normalizedMocks,
        evaluation_criteria: mergedCriteria,
      });
    } catch (e) {
      errors.push({ file, error: e.message });
    }
  }

  // Apply filters
  let filtered = scenarios;
  let filterDesc = 'all';

  if (ids && ids.length > 0) {
    const idSet = new Set(ids);
    filtered = scenarios.filter(s => idSet.has(s.id));
    filterDesc = `ids=${ids.join(',')}`;
  } else if (tags && tags.length > 0) {
    const tagSet = new Set(tags);
    filtered = scenarios.filter(s => s.tags.some(t => tagSet.has(t)));
    filterDesc = `tags=${tags.join(',')}`;
  }

  if (errors.length > 0) {
    console.warn(`Warning: ${errors.length} scenario(s) failed to load:`);
    for (const e of errors) {
      console.warn(`  ${e.file}: ${e.error}`);
    }
  }

  return {
    scenarios: filtered,
    totalAvailable: scenarios.length,
    filter: filterDesc,
    loadErrors: errors,
  };
}

/**
 * Build the full API request body for a scenario.
 */
export function buildRequest(scenario) {
  const phase = scenario.target_phase;
  const startingNodeId = phase ? CONFIG.phaseNodeIds[phase] : undefined;

  const request = {
    simulation_specification: {
      simulated_user_config: {
        prompt: {
          prompt: CONFIG.simUserPrefix + '\n\n' + scenario.simulated_user.prompt,
          llm: scenario.simulated_user.llm || CONFIG.defaultSimUserLlm,
          temperature: scenario.simulated_user.temperature ?? CONFIG.defaultSimUserTemperature,
        },
        first_message: scenario.partial_conversation_history?.length > 0
          ? undefined  // first_message is appended to history instead
          : (scenario.simulated_user.first_message || undefined),
      },
      tool_mock_config: Object.keys(scenario.tool_mocks).length > 0 ? scenario.tool_mocks : undefined,
      partial_conversation_history: (() => {
          const hist = scenario.partial_conversation_history;
          if (!hist || hist.length === 0) return undefined;
          const entries = hist.map((entry, i) => ({
            role: entry.role,
            message: entry.message,
            time_in_call_secs: entry.time_in_call_secs ?? (i + 1) * 10,
          }));
          // If there's a first_message, append it as the last history turn so the agent responds to it
          if (scenario.simulated_user.first_message) {
            entries.push({
              role: 'user',
              message: scenario.simulated_user.first_message,
              time_in_call_secs: (entries.length + 1) * 10,
            });
          }
          return entries;
        })(),
      dynamic_variables: {
          ...CONFIG.defaultDynamicVariables,
          ...(scenario.dynamic_variables || {}),
        },
    },
    extra_evaluation_criteria: normalizeCriteria(scenario.evaluation_criteria),
    new_turns_limit: scenario.new_turns_limit,
  };

  // conversation_initiation_client_data goes at the TOP level, not inside simulation_specification
  if (startingNodeId) {
    request.conversation_initiation_client_data = {
      starting_workflow_node_id: startingNodeId,
    };
  }

  return request;
}
