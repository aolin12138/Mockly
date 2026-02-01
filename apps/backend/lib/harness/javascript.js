/**
 * JavaScript Harness Generator
 * Wraps user code with test runner that outputs JSON results
 */

export function generateJavaScriptHarness(userCode, visibleTests) {
  const testsCases = visibleTests.map((test, idx) => ({
    id: idx + 1,
    input: test.input,
    expected: test.expectedOutput,
  }));

  const testRunner = `
const testCases = ${JSON.stringify(testsCases, null, 2)};
const results = [];

for (const testCase of testCases) {
  try {
    const actual = lengthOfLongestSubstring(testCase.input);
    const passed = actual === testCase.expected;
    results.push({
      id: testCase.id,
      input: testCase.input,
      expected: testCase.expected,
      actual: actual,
      passed: passed,
      error: null
    });
  } catch (err) {
    results.push({
      id: testCase.id,
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
