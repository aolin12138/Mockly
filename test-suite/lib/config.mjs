/**
 * Test suite configuration — env loading, constants, tool mappings.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

export const CONFIG = {
  // Agent under test — latest workflow version
  agentId: 'agent_2201ktp0n7mwek6avkphs4x6394m',
  branchId: 'agtbrch_1301ktp0n97rfn4tkjz5626383hm',
  apiKey: env.ELEVENLABS_PLATFORM_KEY || env.VITE_ELEVENLABS_API_KEY || '',

  // API
  baseUrl: 'https://api.elevenlabs.io/v1',
  
  // Runner defaults
  concurrency: 5,
  perScenarioTimeoutMs: 120_000,
  maxRetries: 3,
  retryBackoffMs: [1000, 4000, 16000], // exponential

  // Paths
  scenariosDir: resolve(__dirname, '..', 'scenarios'),
  commonCriteriaPath: resolve(__dirname, '..', 'scenarios', 'common_criteria.json'),
  reportTemplatePath: resolve(__dirname, '..', 'templates', 'report.html'),
  defaultReportPath: resolve(__dirname, '..', 'report.html'),

  // Simulated user defaults
  defaultSimUserLlm: 'gpt-4o',
  defaultSimUserTemperature: 0.3,
  // Prepended to every simulated_user prompt to prevent off-script behavior
  simUserPrefix: 'IMPORTANT: You are SPEAKING aloud in a voice interview. NEVER write code, use code blocks, or type. Keep responses short (1-3 sentences). Stay in character — you are a coding interview candidate. Do NOT offer to paste code, share screen, or send files. If asked to show code, describe it verbally in a sentence. Do NOT volunteer extra context, ask "do you need anything else?", or check if the interviewer is still there. Just answer what was asked and stop.',

  // Node IDs for each workflow phase (used to force starting phase via conversation_initiation_client_data)
  phaseNodeIds: {
    1: 'node_01ksvy7ntre8gsanne5tj7kmca',  // Phase 1: Understanding
    2: 'node_01ksvyddppe8gsannvqqc66p4w',  // Phase 2: Implementation
    3: 'node_01ksvyftate8gsanp9mkqw49tf',  // Phase 3: Time Pressure
    4: 'node_01kt35w596exs8pbna62db1zkr',  // Phase 4: Assessment & Close
  },

  // Required dynamic variables for the agent (all must be present)
  defaultDynamicVariables: {
    question_title: 'Find Maximum Subarray Sum',
    question_statement: 'Write a function that takes a list of integers and returns the maximum sum of any contiguous subarray.',
    constraints: '1 <= len(nums) <= 10^5, -10^4 <= nums[i] <= 10^4',
    example_cases: 'Input: [-2,1,-3,4,-1,2,1,-5,4] => Output: 6 (subarray [4,-1,2,1])',
    difficulty: 'medium',
    company_type: 'general',
    time_budget_minutes: '30',
    remaining_minutes: '30',
    secret__session_id: 'test-suite-session',
  },
};

/**
 * Maps scenario-library tool names → real agent tool names.
 * Client tools are registered with bare names on the agent for simulation compatibility.
 */
export const TOOL_NAME_MAP = {
  get_current_code: 'get_current_code',
  run_code_against_tests: 'run_code_against_tests',
};

/**
 * Returns the real tool name for a scenario-library tool name.
 */
export function realToolName(scenarioName) {
  return TOOL_NAME_MAP[scenarioName] || scenarioName;
}

/**
 * Known tool return schemas — used to validate mock coherence.
 */
export const TOOL_SCHEMAS = {
  getEditorState: {
    code: 'string',
    language: 'string',
    remaining_minutes: 'number',
    hintCount: 'number',
  },
  run_code_against_tests: {
    passedTests: 'number',
    totalTests: 'number',
    allPassed: 'boolean',
    failureCategory: 'string',
    compilationError: 'string|null',
    remainingMinutes: 'number',
  },
};
