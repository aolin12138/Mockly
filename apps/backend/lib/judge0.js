import axios from 'axios';

const LANGUAGE_IDS = {
  javascript: 63,
  python: 71,
  java: 62,
};

const JUDGE0_CONFIG = {
  baseURL: process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com',
  rapidAPIKey: process.env.JUDGE0_RAPID_API_KEY,
  rapidAPIHost: process.env.JUDGE0_RAPID_API_HOST || 'judge0-ce.p.rapidapi.com',
  isRapidAPI: !!process.env.JUDGE0_RAPID_API_KEY,
};

/**
 * Create axios instance with appropriate headers
 */
function createJudge0Client() {
  const headers = {};

  if (JUDGE0_CONFIG.isRapidAPI) {
    headers['X-RapidAPI-Key'] = JUDGE0_CONFIG.rapidAPIKey;
    headers['X-RapidAPI-Host'] = JUDGE0_CONFIG.rapidAPIHost;
  }

  headers['Content-Type'] = 'application/json';

  return axios.create({
    baseURL: JUDGE0_CONFIG.baseURL,
    headers,
    timeout: 30000,
  });
}

/**
 * Submit code to Judge0
 * @param {string} code - Source code to execute
 * @param {string} language - 'javascript', 'python', or 'java'
 * @param {string} stdin - Standard input (if needed)
 * @returns {Promise<string>} Token for polling results
 */
export async function submitCode(code, language, stdin = '') {
  if (!LANGUAGE_IDS[language]) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const client = createJudge0Client();

  try {
    const response = await client.post('/submissions', {
      source_code: code,
      language_id: LANGUAGE_IDS[language],
      stdin: stdin,
      wait: false, // Don't wait for result, return token immediately
    });

    if (!response.data.token) {
      throw new Error('No token returned from Judge0');
    }

    return response.data.token;
  } catch (error) {
    console.error('Judge0 submission error:', error.message);
    throw new Error(`Failed to submit code to Judge0: ${error.message}`);
  }
}

/**
 * Poll for submission result
 * @param {string} token - Submission token from submitCode
 * @param {number} maxAttempts - Maximum poll attempts (default 30, ~30 seconds)
 * @param {number} pollInterval - Poll interval in ms (default 1000)
 * @returns {Promise<Object>} Submission result
 */
export async function pollResult(token, maxAttempts = 30, pollInterval = 1000) {
  if (!token) {
    throw new Error('Token is required for polling');
  }

  const client = createJudge0Client();
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await client.get(`/submissions/${token}`);
      const result = response.data;

      // Status 1 = In Queue, 2 = Processing
      if (result.status.id > 2) {
        // Completed (3+)
        return result;
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error(`Poll attempt ${attempts + 1} failed:`, error.message);
      if (attempts >= maxAttempts - 1) {
        throw new Error(`Failed to poll Judge0 after ${maxAttempts} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
  }

  throw new Error(`Submission ${token} did not complete within ${maxAttempts * pollInterval}ms`);
}

/**
 * Parse Judge0 result
 * @param {Object} result - Result from pollResult
 * @returns {Object} Parsed result with code, stdout, stderr, status info
 */
export function parseResult(result) {
  return {
    token: result.token,
    status: result.status,
    languageId: result.language_id,
    compilationError: result.compile_error,
    runtimeError: result.runtime_error,
    stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf-8') : '',
    stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf-8') : '',
    exitCode: result.exit_code,
    executionTime: result.time,
    memoryUsed: result.memory,
    statusId: result.status.id,
    statusDescription: result.status.description,
  };
}

/**
 * Execute code and get results (convenience function)
 * @param {string} code - Source code
 * @param {string} language - Language
 * @param {string} stdin - Standard input
 * @returns {Promise<Object>} Parsed result
 */
export async function executeCode(code, language, stdin = '') {
  const token = await submitCode(code, language, stdin);
  const result = await pollResult(token);
  return parseResult(result);
}

export default {
  submitCode,
  pollResult,
  parseResult,
  executeCode,
  LANGUAGE_IDS,
};
