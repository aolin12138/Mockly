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
      where: { id: parseInt(questionId) },
    });

    if (!question) {
      return res.status(404).json({
        error: 'Question not found',
      });
    }

    // Parse visible tests
    let visibleTests = [];
    try {
      visibleTests = typeof question.visibleTests === 'string'
        ? JSON.parse(question.visibleTests)
        : question.visibleTests;
    } catch (parseError) {
      console.error('Error parsing visible tests:', parseError);
      return res.status(500).json({
        error: 'Failed to parse question tests',
      });
    }

    // Generate harness with visible tests
    const harnessFn = HARNESS_GENERATORS[language];
    const harnessCode = harnessFn(code, visibleTests);

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
      return res.status(200).json({
        success: false,
        error: 'Compilation Error',
        details: executionResult.compilationError,
        testResults: [],
        passedTests: 0,
        totalTests: visibleTests.length,
      });
    }

    if (executionResult.runtimeError) {
      return res.status(200).json({
        success: false,
        error: 'Runtime Error',
        details: executionResult.runtimeError,
        testResults: [],
        passedTests: 0,
        totalTests: visibleTests.length,
      });
    }

    // Extract test results from stdout
    const testResults = extractJsonResults(executionResult.stdout);

    if (!testResults || !Array.isArray(testResults)) {
      return res.status(200).json({
        success: false,
        error: 'Failed to parse test results',
        details: 'Could not extract test results from code output',
        testResults: [],
        passedTests: 0,
        totalTests: visibleTests.length,
      });
    }

    // Count passed tests
    const passedTests = testResults.filter(t => t.passed).length;

    // Return results (never include hidden test information)
    res.json({
      success: true,
      testResults, // Each test: { id, input, expected, actual, passed, error }
      passedTests,
      totalTests: visibleTests.length,
      executionTime: executionResult.executionTime,
      memoryUsed: executionResult.memoryUsed,
      // Hidden test summary (never leak data)
      hiddenTestsEstimate: {
        totalCount: await prisma.question.findUnique({
          where: { id: parseInt(questionId) },
          select: { hiddenTests: true },
        }).then(q => {
          try {
            const hidden = typeof q.hiddenTests === 'string' ? JSON.parse(q.hiddenTests) : q.hiddenTests;
            return Array.isArray(hidden) ? hidden.length : 0;
          } catch {
            return 0;
          }
        }),
        message: 'Hidden tests will be evaluated when you submit',
      },
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
