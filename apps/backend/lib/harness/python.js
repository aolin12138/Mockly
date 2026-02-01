/**
 * Python Harness Generator
 * Wraps user code with test runner that outputs JSON results
 */

export function generatePythonHarness(userCode, visibleTests) {
  const testsCases = visibleTests.map((test, idx) => ({
    id: idx + 1,
    input: test.input,
    expected: test.expectedOutput,
  }));

  const testRunner = `
import json

test_cases = ${JSON.stringify(testsCases, null, 2).replace(/\\/g, '\\\\')}
results = []

for test_case in test_cases:
    try:
        actual = lengthOfLongestSubstring(test_case['input'])
        passed = actual == test_case['expected']
        results.append({
            'id': test_case['id'],
            'input': test_case['input'],
            'expected': test_case['expected'],
            'actual': actual,
            'passed': passed,
            'error': None
        })
    except Exception as err:
        results.append({
            'id': test_case['id'],
            'input': test_case['input'],
            'expected': test_case['expected'],
            'actual': None,
            'passed': False,
            'error': str(err)
        })

print('###START_JSON###')
print(json.dumps(results))
print('###END_JSON###')
`;

  return userCode + '\n' + testRunner;
}

export default {
  generatePythonHarness,
};
