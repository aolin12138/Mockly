/**
 * Python Harness Generator
 * Wraps user code with test runner that outputs JSON results
 * Dynamically extracts function name from user code
 */

export function generatePythonHarness(userCode, allTests) {
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
  const funcNameMatch = userCode.match(/def\s+(\w+)\s*\(/);
  if (!funcNameMatch) {
    throw new Error('Could not find function definition in user code');
  }
  const functionName = funcNameMatch[1];

  const testRunner = `
import json

test_cases = ${JSON.stringify(testsCases, null, 2)}
results = []

for test_case in test_cases:
    try:
        actual = ${functionName}(test_case['input'])
        passed = actual == test_case['expected'] if 'expected' in test_case else True
        results.append({
            'id': test_case['id'],
            'name': test_case['name'],
            'tags': test_case.get('tags', []),
            'input': test_case['input'],
            'expected': test_case.get('expected'),
            'actual': actual,
            'passed': passed,
            'error': None
        })
    except Exception as err:
        results.append({
            'id': test_case['id'],
            'name': test_case['name'],
            'tags': test_case.get('tags', []),
            'input': test_case['input'],
            'expected': test_case.get('expected'),
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
