/**
 * JavaScript Harness Generator
 * Wraps user code with test runner that outputs JSON results
 * Dynamically extracts function name from user code
 */

export function generateJavaScriptHarness(userCode, allTests) {
  const testsCases = allTests.map((test, idx) => {
    const testCase = {
      id: idx + 1,
      input: test.input,
      name: test.name || test.tag || test.description || `Test ${idx + 1}`,
      tags: test.tags || [],
    };
    // Always include expected, even if it's 0, false, null, etc.
    if ('expected' in test || 'expectedOutput' in test) {
      testCase.expected = test.expected !== undefined ? test.expected : test.expectedOutput;
    }
    return testCase;
  });

  // Extract function name from user code
  const funcNameMatch = userCode.match(/function\s+(\w+)\s*\(/);
  if (!funcNameMatch) {
    throw new Error('Could not find function definition in user code');
  }
  const functionName = funcNameMatch[1];

  const testRunner = `
const testCases = ${JSON.stringify(testsCases, null, 2)};
const results = [];

for (const testCase of testCases) {
  try {
    // If input is an array, spread as multiple arguments; otherwise pass as single arg
    const args = Array.isArray(testCase.input) ? testCase.input : [testCase.input];
    const actual = ${functionName}(...args);
    const passed = 'expected' in testCase ? actual === testCase.expected : true;
    results.push({
      id: testCase.id,
      name: testCase.name,
      tags: testCase.tags,
      input: testCase.input,
      expected: testCase.expected,
      actual: actual,
      passed: passed,
      error: null
    });
  } catch (err) {
    results.push({
      id: testCase.id,
      name: testCase.name,
      tags: testCase.tags,
      input: testCase.input,
      expected: testCase.expected,
      actual: null,
      passed: false,
      error: err.message
    });
  }
}

console.log('###START_JSON###');
console.log(JSON.stringify(results));
console.log('###END_JSON###');
`;

  return userCode + '\n' + testRunner;
}

export default {
  generateJavaScriptHarness,
};
