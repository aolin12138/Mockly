import express from 'express';
import { prisma } from '../prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { executeCode } from '../lib/judge0.js';
import { generateJavaScriptHarness } from '../lib/harness/javascript.js';
import { generatePythonHarness } from '../lib/harness/python.js';
import { generateJavaHarness } from '../lib/harness/java.js';

const router = express.Router();

const MAX_CODE_LENGTH = 50 * 1024; // 50KB

const HARNESS_GENERATORS = {
  javascript: generateJavaScriptHarness,
  python: generatePythonHarness,
  java: generateJavaHarness,
};

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function buildVisibleTestsFromExamples(examples) {
  return examples.map((example, index) => ({
    id: `v${index + 1}`,
    input: parseMaybeJson(example.input),
    expected: parseMaybeJson(example.output),
    description: example.explanation || `example ${index + 1}`,
  }));
}

function buildHiddenTests(hiddenTests) {
  return hiddenTests.map((test, index) => ({
    id: `h${index + 1}`,
    input: parseMaybeJson(test.input),
    expected: parseMaybeJson(test.expected_output),
    description: test.description || `hidden ${index + 1}`,
  }));
}

/**
 * Extract JSON results from stdout
 * Looks for ###START_JSON### and ###END_JSON### markers
 */
function extractJsonResults(stdout) {
  try {
    const startIdx = stdout.indexOf('###START_JSON###');
    const endIdx = stdout.indexOf('###END_JSON###');

    if (startIdx === -1 || endIdx === -1) {
      return null;
    }

    const jsonStr = stdout.substring(startIdx + 16, endIdx).trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error extracting JSON results:', error);
    return null;
  }
}

/**
 * POST /api/run
 * Execute code against visible tests
 * Body: { questionId, code, language }
 */
router.post('/run', authMiddleware, async (req, res) => {
  try {
    const { questionId, code, language } = req.body;

    console.log('Code run request:', {
      questionId,
      codeLength: code?.length,
      language,
      code: code?.substring(0, 100),
    });

    // Validation
    if (!questionId || !code || !language) {
      return res.status(400).json({
        error: 'questionId, code, and language are required',
      });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(413).json({
        error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} bytes`,
      });
    }

    if (!HARNESS_GENERATORS[language]) {
      return res.status(400).json({
        error: `Unsupported language: ${language}. Supported: javascript, python, java`,
      });
    }

    // Fetch question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return res.status(404).json({
        error: 'Question not found',
      });
    }

    const examples = parseJson(question.examples, []);
    const hiddenTestsRaw = parseJson(question.hidden_tests, []);

    if (!Array.isArray(examples) || examples.length === 0) {
      return res.status(500).json({
        error: 'Question has no runnable examples',
      });
    }

    const visibleTests = buildVisibleTestsFromExamples(examples);
    const hiddenTests = Array.isArray(hiddenTestsRaw) ? buildHiddenTests(hiddenTestsRaw) : [];

    console.log('Visible tests:', visibleTests);
    console.log('Hidden tests:', hiddenTests.length);

    const allTests = [...visibleTests, ...hiddenTests];
    const harnessFn = HARNESS_GENERATORS[language];
    const harnessCode = harnessFn(code, allTests);

    console.log('Generated harness code:', harnessCode.substring(0, 500));

    // Execute code on Judge0
    let executionResult;
    try {
      executionResult = await executeCode(harnessCode, language, '');
    } catch (error) {
      return res.status(500).json({
        error: 'Code execution failed',
        message: error.message,
      });
    }

    // Check for compilation or runtime errors
    if (executionResult.compilationError) {
      console.error('Compilation error:', executionResult.compilationError);
      return res.status(200).json({
        success: false,
        error: 'Compilation Error',
        details: executionResult.compilationError,
        visibleTestResults: [],
        visiblePassedTests: 0,
        hiddenTestResults: [],
        hiddenPassedTests: 0,
        totalVisibleTests: visibleTests.length,
        totalHiddenTests: hiddenTests.length,
      });
    }

    if (executionResult.runtimeError) {
      console.error('Runtime error:', executionResult.runtimeError);
      return res.status(200).json({
        success: false,
        error: 'Runtime Error',
        details: executionResult.runtimeError,
        visibleTestResults: [],
        visiblePassedTests: 0,
        hiddenTestResults: [],
        hiddenPassedTests: 0,
        totalVisibleTests: visibleTests.length,
        totalHiddenTests: hiddenTests.length,
      });
    }

    // Extract test results from stdout
    const allTestResults = extractJsonResults(executionResult.stdout);

    console.log('Execution result:', {
      stdout: executionResult.stdout,
      stderr: executionResult.stderr,
      compilationError: executionResult.compilationError,
      runtimeError: executionResult.runtimeError,
      testResults: allTestResults,
    });

    if (!allTestResults || !Array.isArray(allTestResults)) {
      return res.status(200).json({
        success: false,
        error: 'Failed to parse test results',
        details: 'Could not extract test results from code output',
        stdout: executionResult.stdout.substring(0, 500),
        stderr: executionResult.stderr.substring(0, 500),
        visibleTestResults: [],
        visiblePassedTests: 0,
        hiddenTestResults: [],
        hiddenPassedTests: 0,
        totalVisibleTests: visibleTests.length,
        totalHiddenTests: hiddenTests.length,
      });
    }

    // Separate visible and hidden test results
    const visibleTestResults = allTestResults.slice(0, visibleTests.length);
    const hiddenTestResults = allTestResults.slice(visibleTests.length);

    // Count passed tests
    const visiblePassedTests = visibleTestResults.filter(t => t.passed).length;
    const hiddenPassedTests = hiddenTestResults.filter(t => t.passed).length;

    res.json({
      success: true,
      visibleTestResults,
      visiblePassedTests,
      totalVisibleTests: visibleTests.length,
      hiddenPassedTests,
      totalHiddenTests: hiddenTests.length,
      executionTime: executionResult.executionTime,
      memoryUsed: executionResult.memoryUsed,
    });
  } catch (error) {
    console.error('Error in /run endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
