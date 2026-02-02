/**
 * Java Harness Generator
 * Wraps user code with test runner that outputs JSON results
 * Dynamically extracts class and method names from user code
 */

export function generateJavaHarness(userCode, allTests) {
  const testsCases = allTests.map((test, idx) => {
    const testCase = {
      id: idx + 1,
      input: test.input,
    };
    // Always include expected, even if it's 0, false, null, etc.
    if ('expected' in test || 'expectedOutput' in test) {
      testCase.expected = test.expected !== undefined ? test.expected : test.expectedOutput;
    }
    return testCase;
  });

  // Extract method name from user code - look for public method
  const methodMatch = userCode.match(/public\s+(?:static\s+)?(?:int|String|boolean|double|long)\s+(\w+)\s*\(/);
  if (!methodMatch) {
    throw new Error('Could not find public method definition in user code');
  }
  const methodName = methodMatch[1];

  const testRunner = `
import java.util.*;

public class TestRunner {
    public static void main(String[] args) {
        Solution solution = new Solution();
        List<Map<String, Object>> results = new ArrayList<>();
        
        java.util.List<Map<String, Object>> testCases = new ArrayList<>();
        ${testsCases.map(t => {
    const testInput = `"${t.input.replace(/"/g, '\\"')}"`;
    if ('expected' in t) {
      return `Map<String, Object> test${t.id} = new LinkedHashMap<>();
        test${t.id}.put("id", ${t.id});
        test${t.id}.put("input", ${testInput});
        test${t.id}.put("expected", ${t.expected});
        testCases.add(test${t.id});`;
    } else {
      return `Map<String, Object> test${t.id} = new LinkedHashMap<>();
        test${t.id}.put("id", ${t.id});
        test${t.id}.put("input", ${testInput});
        testCases.add(test${t.id});`;
    }
  }).join('\n        ')}
        
        for (Map<String, Object> testCase : testCases) {
            try {
                int id = (int) testCase.get("id");
                String input = (String) testCase.get("input");
                Object expectedObj = testCase.get("expected");
                
                int actual = solution.${methodName}(input);
                boolean passed = expectedObj != null ? actual == (int) expectedObj : true;
                
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("id", id);
                result.put("input", input);
                result.put("expected", expectedObj);
                result.put("actual", actual);
                result.put("passed", passed);
                result.put("error", null);
                results.add(result);
            } catch (Exception e) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("id", testCase.get("id"));
                result.put("input", testCase.get("input"));
                result.put("expected", testCase.get("expected"));
                result.put("actual", null);
                result.put("passed", false);
                result.put("error", e.getMessage());
                results.add(result);
            }
        }
        
        System.out.println("###START_JSON###");
        System.out.println(new com.google.gson.Gson().toJson(results));
        System.out.println("###END_JSON###");
    }
}

${userCode}
`;

  return testRunner;
}

export default {
  generateJavaHarness,
};
