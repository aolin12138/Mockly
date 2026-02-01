/**
 * Java Harness Generator
 * Wraps user code with test runner that outputs JSON results
 */

export function generateJavaHarness(userCode, visibleTests) {
  const testsCases = visibleTests.map((test, idx) => ({
    id: idx + 1,
    input: test.input,
    expected: test.expectedOutput,
  }));

  const testRunner = `
import java.util.*;

public class TestRunner {
    public static void main(String[] args) {
        Solution solution = new Solution();
        List<Map<String, Object>> results = new ArrayList<>();
        
        Object[][] testCases = {
            ${testsCases.map(t => `{ ${t.id}, "${t.input}", ${t.expected} }`).join(',\n            ')}
        };
        
        for (Object[] testCase : testCases) {
            int id = (int) testCase[0];
            String input = (String) testCase[1];
            int expected = (int) testCase[2];
            
            try {
                int actual = solution.lengthOfLongestSubstring(input);
                boolean passed = actual == expected;
                
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("id", id);
                result.put("input", input);
                result.put("expected", expected);
                result.put("actual", actual);
                result.put("passed", passed);
                result.put("error", null);
                results.add(result);
            } catch (Exception e) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("id", id);
                result.put("input", input);
                result.put("expected", expected);
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
