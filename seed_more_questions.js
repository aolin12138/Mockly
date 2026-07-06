#!/usr/bin/env node
/**
 * Seeds 10 new technical questions with full answer keys (optimal solutions with code,
 * common_mistakes, follow_ups, pattern_tags) + boilerplate + examples + constraints + hidden_tests.
 *
 * Run from project root: node seed_more_questions.js
 */
import 'dotenv/config';
import pg from 'pg';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pg;
const { PrismaClient } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Boilerplate for each language ──────────────────────────────────────────
const py = (sig, body) => `def ${sig}:\n${body.split('\n').map(l => '    ' + l).join('\n')}`;
const js = (sig, body) => `function ${sig} {\n${body.split('\n').map(l => '  ' + l).join('\n')}\n}`;

// ── Question catalogue ──────────────────────────────────────────────────────
const QUESTIONS = [
  // 1. EASY — Binary Search
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    topics: ['binary search', 'arrays'],
    pattern_tags: ['binary search', 'divide and conquer'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 25,
    problem_statement: "Given a sorted (ascending) integer array nums and a target value, return the index of target in nums. If target does not exist, return -1. You must write an algorithm with O(log n) runtime complexity.\n\n**Example 1:**\nInput: nums = [-1,0,3,5,9,12], target = 9\nOutput: 4\n\n**Example 2:**\nInput: nums = [-1,0,3,5,9,12], target = 2\nOutput: -1",
    boilerplate: {
      javascript: js('binarySearch(nums, target)', '// Return the index of target in nums, or -1\nreturn -1;'),
      python: py('binarySearch(nums: list[int], target: int) -> int', '# Return the index of target in nums, or -1\nreturn -1'),
    },
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4', explanation: '9 is at index 4.' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1', explanation: '2 is not in the array.' },
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i], target <= 10^4', 'All integers in nums are unique.', 'nums is sorted in ascending order.'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'nums = [1,2,3,4,5,6,7], target = 5', description: 'middle element', expected_output: '4' },
      { tags: ['edge_case'], input: 'nums = [5], target = 5', description: 'single element found', expected_output: '0' },
      { tags: ['edge_case'], input: 'nums = [5], target = 3', description: 'single element not found', expected_output: '-1' },
      { tags: ['edge_case'], input: 'nums = [1,3,5,7,9], target = 1', description: 'first element', expected_output: '0' },
      { tags: ['performance'], input: 'nums = [...Array(100000).keys()], target = 99999', description: 'large array last element', expected_output: '99999' },
    ],
    hint_framework: { phase2: ['Think about how to eliminate half the search space at each step.'], phase3: ['Watch your mid calculation for potential integer overflow.', 'Make sure the loop terminates when left passes right.'] },
    solutions: {
      optimal: {
        approach: "Classic binary search: maintain [left, right] bounds. Compute mid, compare nums[mid] to target, and eliminate the half that can't contain the target.",
        time: 'O(log n)',
        space: 'O(1)',
        code: 'def binarySearch(nums, target):\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = left + (right - left) // 2\n        if nums[mid] == target:\n            return mid\n        elif nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1',
      },
    },
    common_mistakes: [
      "`mid = (left + right) // 2` can overflow in languages with fixed-width ints; use `left + (right - left) // 2`",
      "Using `while left < right` instead of `<=` — misses the single-element case",
      "Not moving left/right past mid — infinite loop on unfound targets",
    ],
    follow_ups: [
      { variant: 'Find the first/last occurrence of target in a sorted array with duplicates', angle: 'Modify the condition: when nums[mid]==target, move right=mid-1 for first, left=mid+1 for last', difficulty_delta: 'medium' },
    ],
    meta: {},
  },

  // 2. EASY — Linked List Cycle Detection
  {
    id: 'linked-list-cycle',
    title: 'Linked List Cycle',
    difficulty: 'easy',
    topics: ['linked list', 'two pointers'],
    pattern_tags: ['fast and slow pointers', 'linked list'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 25,
    problem_statement: "Given head, the head of a linked list, determine if the linked list has a cycle in it. A cycle exists if some node can be reached again by continuously following the next pointer. Return true if there is a cycle, false otherwise.\n\n**Example 1:**\nInput: head = [3,2,0,-4], pos = 1 (tail connects to node at index 1)\nOutput: true\n\n**Example 2:**\nInput: head = [1,2], pos = -1 (no cycle)\nOutput: false",
    boilerplate: {
      javascript: js('hasCycle(head)', '// Return true if the linked list has a cycle\nreturn false;'),
      python: py('hasCycle(head) -> bool', '# Return True if the linked list has a cycle\nreturn False'),
    },
    examples: [
      { input: 'head = [3,2,0,-4], pos = 1', output: 'true', explanation: 'Tail connects to index 1, forming a cycle.' },
      { input: 'head = [1,2], pos = -1', output: 'false', explanation: 'No cycle; the list terminates.' },
    ],
    constraints: ['Number of nodes in the list is in range [0, 10^4].', '-10^5 <= Node.val <= 10^5', 'pos is -1 or a valid index in the linked list.'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'head with cycle at middle', description: 'medium cycle', expected_output: 'true' },
      { tags: ['edge_case'], input: 'head = null', description: 'empty list', expected_output: 'false' },
      { tags: ['edge_case'], input: 'single node no cycle', description: 'single node', expected_output: 'false' },
      { tags: ['edge_case'], input: 'single node self-cycle', description: 'self-loop', expected_output: 'true' },
      { tags: ['performance'], input: 'long list with late cycle', description: 'large list', expected_output: 'true' },
    ],
    hint_framework: { phase2: ['What if you had two pointers moving at different speeds?'], phase3: ['Think about what happens when a faster pointer laps a slower one.'] },
    solutions: {
      brute_force: {
        approach: 'Store visited nodes in a hash set. If we see a node twice, there is a cycle.',
        time: 'O(n)',
        space: 'O(n)',
        code: 'def hasCycle(head):\n    seen = set()\n    while head:\n        if head in seen:\n            return True\n        seen.add(head)\n        head = head.next\n    return False',
      },
      optimal: {
        approach: "Floyd's cycle-finding algorithm: fast pointer moves 2 steps, slow moves 1. If they meet, there is a cycle. If fast reaches null, there isn't.",
        time: 'O(n)',
        space: 'O(1)',
        code: 'def hasCycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow == fast:\n            return True\n    return False',
      },
    },
    common_mistakes: [
      'Forgetting the fast.next null check before accessing fast.next.next',
      'Using slow==fast as the loop condition instead of checking fast/fast.next — pre-meet termination',
      'Hash set approach uses O(n) memory; optimal is O(1) with two pointers',
    ],
    follow_ups: [
      { variant: 'Find the node where the cycle begins (Linked List Cycle II)', angle: 'After meet, reset one pointer to head, move both at speed 1 until they meet again', difficulty_delta: 'medium' },
    ],
    meta: {},
  },

  // 3. MEDIUM — Validate Binary Search Tree
  {
    id: 'validate-bst',
    title: 'Validate Binary Search Tree',
    difficulty: 'medium',
    topics: ['binary tree', 'dfs'],
    pattern_tags: ['tree traversal', 'recursion', 'binary search tree'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 30,
    problem_statement: "Given the root of a binary tree, determine if it is a valid binary search tree (BST). A valid BST is defined as follows: (1) The left subtree of a node contains only nodes with keys less than the node's key. (2) The right subtree of a node contains only nodes with keys greater than the node's key. (3) Both the left and right subtrees must also be BSTs.\n\n**Example 1:**\nInput: root = [2,1,3]\nOutput: true\n\n**Example 2:**\nInput: root = [5,1,4,null,null,3,6]\nOutput: false (right child 3 is less than root 5)",
    boilerplate: {
      javascript: js('isValidBST(root)', '// Return true if the tree is a valid BST\nreturn true;'),
      python: py('isValidBST(root) -> bool', '# Return True if the tree is a valid BST\nreturn True'),
    },
    examples: [
      { input: 'root = [2,1,3]', output: 'true', explanation: 'Left < 2 < Right.' },
      { input: 'root = [5,1,4,null,null,3,6]', output: 'false', explanation: '4 > 5 but 3 < 5 — the right subtree has an invalid node.' },
    ],
    constraints: ['Number of nodes in the range [1, 10^4].', '-2^31 <= Node.val <= 2^31 - 1'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'balanced BST', description: 'valid balanced tree', expected_output: 'true' },
      { tags: ['edge_case'], input: 'single node', description: 'single node', expected_output: 'true' },
      { tags: ['edge_case'], input: 'right grandchild invalid', description: 'grandchild violates ancestor bound', expected_output: 'false' },
      { tags: ['edge_case'], input: 'duplicate values', description: 'equal values (not strictly <)', expected_output: 'false' },
      { tags: ['edge_case'], input: 'deep left chain', description: 'degenerate left-only valid tree', expected_output: 'true' },
    ],
    hint_framework: { phase2: ['The naive check (left.val < root.val < right.val) is insufficient — the constraint propagates.', 'Think about tracking valid ranges: each node must be within (min, max).'], phase3: ['Use recursion with min/max bounds that tighten as you descend.'] },
    solutions: {
      optimal: {
        approach: 'Recursive DFS with a valid range (min, max) for each node. The root starts at (-inf, +inf). For each node: verify min < node.val < max, then recurse left with (min, node.val) and right with (node.val, max).',
        time: 'O(n)',
        space: 'O(h) — recursion stack depth',
        code: 'def isValidBST(root, lo=float("-inf"), hi=float("inf")):\n    if not root:\n        return True\n    if root.val <= lo or root.val >= hi:\n        return False\n    return isValidBST(root.left, lo, root.val) and isValidBST(root.right, root.val, hi)',
      },
    },
    common_mistakes: [
      'Only checking children, not the entire subtree range — e.g., root.right.left must be > root.val',
      'Using >= instead of > (BSTs typically require strictly greater/less)',
      'In-order traversal approach: forgetting that equal values are not allowed in strict BSTs',
    ],
    follow_ups: [
      { variant: 'Validate using an in-order traversal', angle: 'In-order traversal of a valid BST yields strictly increasing values — track the previous value', difficulty_delta: 'same' },
    ],
    meta: {},
  },

  // 4. MEDIUM — Valid Parentheses (stack)
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    topics: ['stack', 'string'],
    pattern_tags: ['stack', 'string manipulation'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 20,
    problem_statement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. A string is valid if: (1) Open brackets are closed by the same type of brackets, (2) Open brackets are closed in the correct order, (3) Every close bracket has a corresponding open bracket of the same type.\n\n**Example 1:**\nInput: s = '()'\nOutput: true\n\n**Example 2:**\nInput: s = '()[]{}'\nOutput: true\n\n**Example 3:**\nInput: s = '(]'\nOutput: false",
    boilerplate: {
      javascript: js('isValid(s)', '// Return true if parentheses are valid\nreturn false;'),
      python: py('isValid(s: str) -> bool', '# Return True if parentheses are valid\nreturn False'),
    },
    examples: [
      { input: "s = '()'", output: 'true', explanation: 'Single pair.' },
      { input: "s = '()[]{}'", output: 'true', explanation: 'Multiple pairs, correctly nested.' },
      { input: "s = '(]'", output: 'false', explanation: 'Mismatched types.' },
    ],
    constraints: ['1 <= s.length <= 10^4', "s consists of parentheses only '()[]{}'."],
    hidden_tests: [
      { tags: ['basic_case'], input: 'nested valid', description: 'deeply nested', expected_output: 'true' },
      { tags: ['edge_case'], input: 'single open bracket', description: 'unclosed', expected_output: 'false' },
      { tags: ['edge_case'], input: 'single close bracket', description: 'unopened', expected_output: 'false' },
      { tags: ['edge_case'], input: 'interleaved types', description: '[{]} cross-nested', expected_output: 'false' },
      { tags: ['performance'], input: 'very long valid string', description: 'large input', expected_output: 'true' },
    ],
    hint_framework: { phase2: ['What data structure naturally tracks "most recent open" to match the next close?'], phase3: ['Push opens; when you see a close, check the top of the structure matches.'] },
    solutions: {
      optimal: {
        approach: 'Use a stack: push opening brackets; for closing brackets, pop and check match. At the end the stack must be empty.',
        time: 'O(n)',
        space: 'O(n)',
        code: 'def isValid(s):\n    stack = []\n    pairs = {")": "(", "]": "[", "}": "{"}\n    for ch in s:\n        if ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n        else:\n            stack.append(ch)\n    return len(stack) == 0',
      },
    },
    common_mistakes: [
      'Forgetting to check stack emptiness before pop — an empty stack on a close bracket means unmatched',
      'Not checking that the stack is empty at the end — leftover opens are unclosed',
      'Mixing up key/value in the pairs dictionary (using open as key)',
    ],
    follow_ups: [
      { variant: 'What if the string can contain other characters (e.g., letters, digits)?', angle: 'Skip non-bracket characters — only process ()[]{}', difficulty_delta: 'same' },
    ],
    meta: {},
  },

  // 5. MEDIUM — Container With Most Water
  {
    id: 'container-most-water',
    title: 'Container With Most Water',
    difficulty: 'medium',
    topics: ['arrays', 'two pointers', 'greedy'],
    pattern_tags: ['two pointers', 'greedy'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 30,
    problem_statement: "You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container that holds the most water. Return the maximum amount of water the container can store. You may not slant the container.\n\n**Example 1:**\nInput: height = [1,8,6,2,5,4,8,3,7]\nOutput: 49\nExplanation: Lines at indices 1 and 8 form the container. width=7, height=min(8,7)=7, area=49.\n\n**Example 2:**\nInput: height = [1,1]\nOutput: 1",
    boilerplate: {
      javascript: js('maxArea(height)', '// Return the maximum water container area\nreturn 0;'),
      python: py('maxArea(height: list[int]) -> int', '# Return the maximum water container area\nreturn 0'),
    },
    examples: [
      { input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49', explanation: 'Lines at indices 1 and 8, area = 7 * min(8,7) = 49.' },
      { input: 'height = [1,1]', output: '1', explanation: 'Two lines, area = 1 * 1 = 1.' },
    ],
    constraints: ['n == height.length', '2 <= n <= 10^5', '0 <= height[i] <= 10^4'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'wide short walls', description: 'short wide container', expected_output: 'correct_area' },
      { tags: ['edge_case'], input: 'single pair', description: 'two lines', expected_output: 'correct_area' },
      { tags: ['edge_case'], input: 'all same height', description: 'uniform heights', expected_output: 'correct_area' },
      { tags: ['edge_case'], input: 'tall narrow > wide short', description: 'height beats width', expected_output: 'correct_area' },
      { tags: ['performance'], input: 'large array decreasing', description: '10^5 elements', expected_output: 'correct_area' },
    ],
    hint_framework: { phase2: ['The brute force checks all n*(n-1)/2 pairs — can you avoid checking most of them?', 'Think about starting from the widest container and moving inward.'], phase3: ['When you move the pointer, which one should you move? The shorter wall limits the area.'] },
    solutions: {
      brute_force: { approach: 'Check every pair (i, j). Area = (j-i) * min(h[i], h[j]).', time: 'O(n^2)', space: 'O(1)', code: 'def maxArea(height):\n    best = 0\n    for i in range(len(height)):\n        for j in range(i+1, len(height)):\n            best = max(best, (j-i) * min(height[i], height[j]))\n    return best' },
      optimal: {
        approach: 'Two pointers from ends. At each step, compute area and move the pointer with the shorter line inward (because moving the taller one can never increase the bottleneck height).',
        time: 'O(n)',
        space: 'O(1)',
        code: 'def maxArea(height):\n    l, r = 0, len(height) - 1\n    best = 0\n    while l < r:\n        w = r - l\n        h = min(height[l], height[r])\n        best = max(best, w * h)\n        if height[l] < height[r]:\n            l += 1\n        else:\n            r -= 1\n    return best',
      },
    },
    common_mistakes: [
      'Moving the taller pointer instead of the shorter one — the shorter limits the area, moving the taller guarantees no improvement',
      'Forgetting to compute area BEFORE moving a pointer — off-by-one on the final candidate',
      'Assuming the answer is always at the ends — you must test all candidate pairs the two-pointer walk generates',
    ],
    follow_ups: [
      { variant: 'What if the container walls have varying thickness / can\'t hold water at some heights?', angle: 'Adapt to Trapping Rain Water pattern — use prefix/suffix max arrays', difficulty_delta: 'hard' },
    ],
    meta: {},
  },

  // 6. MEDIUM — Top K Frequent Elements (heap)
  {
    id: 'top-k-frequent',
    title: 'Top K Frequent Elements',
    difficulty: 'medium',
    topics: ['heap', 'hash map', 'sorting'],
    pattern_tags: ['heap / priority queue', 'hash map', 'bucket sort'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 30,
    problem_statement: "Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order. Your algorithm's time complexity must be better than O(n log n).\n\n**Example 1:**\nInput: nums = [1,1,1,2,2,3], k = 2\nOutput: [1,2]\n\n**Example 2:**\nInput: nums = [1], k = 1\nOutput: [1]",
    boilerplate: {
      javascript: js('topKFrequent(nums, k)', '// Return the k most frequent elements\nreturn [];'),
      python: py('topKFrequent(nums: list[int], k: int) -> list[int]', '# Return the k most frequent elements\nreturn []'),
    },
    examples: [
      { input: 'nums = [1,1,1,2,2,3], k = 2', output: '[1,2]', explanation: '1 appears 3 times, 2 appears 2 times — these are the top 2.' },
      { input: 'nums = [1], k = 1', output: '[1]', explanation: 'Only one element.' },
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4', 'k is in the range [1, number of unique elements].', 'The answer is guaranteed to be unique.'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'multiple elements, k=2', description: 'standard case', expected_output: 'top 2' },
      { tags: ['edge_case'], input: 'all same value, k=1', description: 'single unique element', expected_output: 'that value' },
      { tags: ['edge_case'], input: 'k equals unique count', description: 'all elements', expected_output: 'all unique' },
      { tags: ['edge_case'], input: 'ties in frequency', description: 'tie-breaking', expected_output: 'any correct' },
      { tags: ['performance'], input: 'large sparse array', description: '10^5 elements', expected_output: 'correct top k' },
    ],
    hint_framework: { phase2: ['Count frequencies first (hash map). Then you need the top k from those counts.', 'What data structure efficiently maintains the k largest (or smallest) items?'], phase3: ['A min-heap of size k gives O(n log k). Alternatively, bucket sort by frequency gives O(n).'] },
    solutions: {
      optimal: {
        approach: 'Count frequencies with a hash map. Use a min-heap of size k to track top k (push (freq, num), pop smallest when heap > k). Alternatively, bucket sort: create buckets indexed by frequency, collect from highest.',
        time: 'O(n log k) with heap, O(n) with bucket sort',
        space: 'O(n)',
        code: 'from collections import Counter\nimport heapq\ndef topKFrequent(nums, k):\n    freq = Counter(nums)\n    return heapq.nlargest(k, freq.keys(), key=freq.get)',
      },
    },
    common_mistakes: [
      'Sorting all frequencies O(n log n) when O(n log k) is possible with a heap (k <= n)',
      'Building a max-heap of all n elements instead of a min-heap of size k — O(n log n) vs O(n log k)',
      'Not handling the case where k equals the number of unique elements — the heap grows to all elements',
    ],
    follow_ups: [
      { variant: 'What if the data is a stream and you need the top k at any moment?', angle: 'Use a frequency hash map + a min-heap of (freq, element) — update frequencies and heap on each new element', difficulty_delta: 'medium' },
    ],
    meta: {},
  },

  // 7. MEDIUM — Longest Palindromic Substring (DP / expand-around-center)
  {
    id: 'longest-palindromic-substring',
    title: 'Longest Palindromic Substring',
    difficulty: 'medium',
    topics: ['strings', 'dynamic programming'],
    pattern_tags: ['two pointers', 'dynamic programming', 'string manipulation'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 35,
    problem_statement: "Given a string s, return the longest palindromic substring in s. A palindrome reads the same forward and backward.\n\n**Example 1:**\nInput: s = 'babad'\nOutput: 'bab' (or 'aba')\n\n**Example 2:**\nInput: s = 'cbbd'\nOutput: 'bb'",
    boilerplate: {
      javascript: js('longestPalindrome(s)', '// Return the longest palindromic substring\nreturn "";'),
      python: py('longestPalindrome(s: str) -> str', "# Return the longest palindromic substring\nreturn ''"),
    },
    examples: [
      { input: "s = 'babad'", output: "'bab'", explanation: "Both 'bab' and 'aba' are valid." },
      { input: "s = 'cbbd'", output: "'bb'", explanation: 'The even-length pair.' },
    ],
    constraints: ['1 <= s.length <= 1000', 's consists of only digits and English letters.'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'short palindrome', description: 'odd length', expected_output: 'entire string' },
      { tags: ['edge_case'], input: 'single char', description: 'length 1', expected_output: 'single char' },
      { tags: ['edge_case'], input: 'all same char', description: 'all "a"', expected_output: 'entire string' },
      { tags: ['edge_case'], input: 'no palindrome > 1', description: '"abcde"', expected_output: 'any single char' },
      { tags: ['performance'], input: '1000 chars mixed', description: 'max length', expected_output: 'longest substring' },
    ],
    hint_framework: { phase2: ['A palindrome expands symmetrically from a center. How many possible centers are there?', 'Consider both odd-length (single center) and even-length (pair center) palindromes.'], phase3: ['For each center, expand outward while characters match. Track the longest found.'] },
    solutions: {
      brute_force: { approach: 'Check every substring O(n^2) and verify palindrome O(n) each — total O(n^3).', time: 'O(n^3)', space: 'O(1)', code: '' },
      optimal: {
        approach: 'Expand around center: for each of the 2n-1 possible centers (each char and each pair), expand outward while chars match. Track the longest palindrome found.',
        time: 'O(n^2)',
        space: 'O(1)',
        code: 'def longestPalindrome(s):\n    n = len(s)\n    best = ""\n    for i in range(n):\n        # odd length\n        l = r = i\n        while l >= 0 and r < n and s[l] == s[r]:\n            if r - l + 1 > len(best):\n                best = s[l:r+1]\n            l -= 1; r += 1\n        # even length\n        l, r = i, i + 1\n        while l >= 0 and r < n and s[l] == s[r]:\n            if r - l + 1 > len(best):\n                best = s[l:r+1]\n            l -= 1; r += 1\n    return best',
      },
    },
    common_mistakes: [
      "Forgetting to check even-length palindromes (center between two chars) — 'bb' would be missed",
      'Manacher\'s algorithm is overkill for n≤1000 constraints and rarely expected in interviews',
      'Not tracking the best palindrome length separately from the substring — causes unnecessary string copying',
    ],
    follow_ups: [
      { variant: 'Can you solve it with O(n) time?', angle: "Manacher's algorithm achieves O(n) by using previously computed palindrome radii", difficulty_delta: 'hard' },
    ],
    meta: {},
  },

  // 8. HARD — Merge K Sorted Lists (heap / divide-and-conquer)
  {
    id: 'merge-k-sorted-lists',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard',
    topics: ['linked list', 'heap', 'divide and conquer'],
    pattern_tags: ['heap / priority queue', 'divide and conquer', 'linked list'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 40,
    problem_statement: "You are given an array of k linked-lists, each sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return its head.\n\n**Example 1:**\nInput: lists = [[1,4,5],[1,3,4],[2,6]]\nOutput: [1,1,2,3,4,4,5,6]\n\n**Example 2:**\nInput: lists = []\nOutput: []\n\n**Example 3:**\nInput: lists = [[]]\nOutput: []",
    boilerplate: {
      javascript: js('mergeKLists(lists)', '// Return the head of the merged sorted list\nreturn null;'),
      python: py('mergeKLists(lists: list) -> ListNode', '# Return the head of the merged sorted list\nreturn None'),
    },
    examples: [
      { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]', explanation: 'All sorted sub-lists merged into one.' },
      { input: 'lists = []', output: '[]', explanation: 'Empty input.' },
    ],
    constraints: ['k == lists.length', '0 <= k <= 10^4', '0 <= lists[i].length <= 500', '-10^4 <= Node.val <= 10^4', 'Sum of lists[i].length will not exceed 10^4.'],
    hidden_tests: [
      { tags: ['basic_case'], input: '3 sorted lists', description: 'standard merge', expected_output: 'fully sorted' },
      { tags: ['edge_case'], input: 'empty input list', description: 'k=0', expected_output: '[]' },
      { tags: ['edge_case'], input: 'single list', description: 'k=1', expected_output: 'same list' },
      { tags: ['edge_case'], input: 'all empty lists', description: 'k>1, all null', expected_output: 'null' },
      { tags: ['performance'], input: 'many short lists', description: 'k=100, short lists', expected_output: 'sorted' },
    ],
    hint_framework: { phase2: ['Merging two sorted lists is O(n). How can you generalize to k lists?', 'What data structure gives you the smallest element across k lists in O(log k) time?'], phase3: ['A min-heap of (head value, list index, node) lets you extract the minimum in O(log k). Push the next node from that list after extraction.'] },
    solutions: {
      brute_force: { approach: 'Collect all values into an array, sort, rebuild linked list.', time: 'O(N log N)', space: 'O(N)', code: '' },
      optimal: {
        approach: 'Min-heap of size k: push the head of each list. Repeatedly pop the smallest, append to result, and push the next node from that list.',
        time: 'O(N log k)',
        space: 'O(k) for heap, O(1) output linked list',
        code: 'import heapq\n\ndef mergeKLists(lists):\n    heap = []\n    for i, node in enumerate(lists):\n        if node:\n            heapq.heappush(heap, (node.val, i, node))\n    dummy = curr = ListNode(0)\n    while heap:\n        val, i, node = heapq.heappop(heap)\n        curr.next = node\n        curr = curr.next\n        if node.next:\n            heapq.heappush(heap, (node.next.val, i, node.next))\n    return dummy.next',
      },
    },
    common_mistakes: [
      'Using list index as heap tiebreaker with mutable node.val — heap corruption if node.val changes (but we only push unmodified nodes)',
      'Forgetting to advance curr after attaching a node — infinite append to the same position',
      'Merge-two-at-a-time approach: merging sequentially is O(kN), pairwise merging (divide-and-conquer) is O(N log k)',
    ],
    follow_ups: [
      { variant: 'What if you cannot use extra memory (heap)?', angle: 'Pairwise merge using divide-and-conquer: merge lists[0] and lists[1], then merge that with lists[2], etc. in a tournament style O(N log k)', difficulty_delta: 'same' },
    ],
    meta: {},
  },

  // 9. HARD — Word Ladder (graph BFS)
  {
    id: 'word-ladder',
    title: 'Word Ladder',
    difficulty: 'hard',
    topics: ['graph', 'bfs', 'strings'],
    pattern_tags: ['graph bfs', 'string manipulation'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 40,
    problem_statement: "A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that: (1) Every adjacent pair differs by exactly one letter, (2) Every si for 1 <= i <= k is in wordList, (3) sk == endWord. Given beginWord, endWord, and wordList, return the number of words in the shortest transformation sequence (including beginWord and endWord), or 0 if no such sequence exists.\n\n**Example 1:**\nInput: beginWord = 'hit', endWord = 'cog', wordList = ['hot','dot','dog','lot','log','cog']\nOutput: 5 (hit -> hot -> dot -> dog -> cog)\n\n**Example 2:**\nInput: beginWord = 'hit', endWord = 'cog', wordList = ['hot','dot','dog','lot','log']\nOutput: 0 (endWord not in list)",
    boilerplate: {
      javascript: js('ladderLength(beginWord, endWord, wordList)', '// Return the length of the shortest transformation sequence\nreturn 0;'),
      python: py('ladderLength(beginWord: str, endWord: str, wordList: list[str]) -> int', '# Return the length of the shortest transformation sequence\nreturn 0'),
    },
    examples: [
      { input: "beginWord = 'hit', endWord = 'cog', wordList = ['hot','dot','dog','lot','log','cog']", output: '5', explanation: 'Shortest path: hit→hot→dot→dog→cog.' },
      { input: "beginWord = 'hit', endWord = 'cog', wordList = ['hot','dot','dog','lot','log']", output: '0', explanation: 'endWord not in list.' },
    ],
    constraints: ['1 <= beginWord.length <= 10', 'endWord.length == beginWord.length', '1 <= wordList.length <= 5000', 'All words are lowercase English letters.', 'beginWord != endWord'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'direct transformation', description: 'adjacent in list', expected_output: '2' },
      { tags: ['edge_case'], input: 'endWord not in list', description: 'impossible', expected_output: '0' },
      { tags: ['edge_case'], input: 'no path exists', description: 'disconnected component', expected_output: '0' },
      { tags: ['edge_case'], input: 'beginWord == endWord', description: 'already there', expected_output: '1' },
      { tags: ['performance'], input: 'long wordList with path', description: '5000 words', expected_output: 'correct length' },
    ],
    hint_framework: { phase2: ['This is a shortest-path problem on a graph. What are the nodes and edges?', 'Each word is a node; an edge exists between words that differ by one letter.'], phase3: ['BFS from beginWord — for each word, generate all possible one-letter mutations and check if in wordList. Use a visited set.'] },
    solutions: {
      optimal: {
        approach: 'BFS from beginWord. For each word in the queue, generate all possible words one letter different (26 * L candidates), and if the candidate is in wordList, add to queue. Track depth. Use a set for O(1) wordList lookups.',
        time: 'O(L * 26 * N) where L = word length, N = wordList size',
        space: 'O(N)',
        code: 'from collections import deque\ndef ladderLength(beginWord, endWord, wordList):\n    words = set(wordList)\n    if endWord not in words:\n        return 0\n    q = deque([(beginWord, 1)])\n    seen = {beginWord}\n    while q:\n        word, dist = q.popleft()\n        if word == endWord:\n            return dist\n        for i in range(len(word)):\n            for c in "abcdefghijklmnopqrstuvwxyz":\n                nxt = word[:i] + c + word[i+1:]\n                if nxt in words and nxt not in seen:\n                    seen.add(nxt)\n                    q.append((nxt, dist + 1))\n    return 0',
      },
    },
    common_mistakes: [
      'Building the full adjacency graph upfront O(N² * L) instead of generating neighbors on the fly',
      'Not tracking visited words — infinite cycle through the graph',
      'Missing the early-return when current word == endWord after dequeuing',
    ],
    follow_ups: [
      { variant: 'Return all shortest transformation sequences (Word Ladder II)', angle: 'BFS to build parent pointers, then DFS backtracking from endWord to beginWord', difficulty_delta: 'hard' },
    ],
    meta: {},
  },

  // 10. HARD — Find Median from Data Stream (two heaps)
  {
    id: 'find-median-data-stream',
    title: 'Find Median from Data Stream',
    difficulty: 'hard',
    topics: ['heap', 'design'],
    pattern_tags: ['two heaps', 'data stream'],
    languages_supported: ['python', 'javascript'],
    estimated_time_min: 35,
    problem_statement: "Implement a MedianFinder class that supports: (1) addNum(int num) — adds the integer num to the data structure, (2) findMedian() — returns the median of all elements so far. The median is the middle value in an ordered list. If the list has an even number of elements, return the mean of the two middle values.\n\n**Example:**\nMedianFinder mf = new MedianFinder();\nmf.addNum(1); mf.addNum(2); mf.findMedian() -> 1.5\nmf.addNum(3); mf.findMedian() -> 2.0",
    boilerplate: {
      javascript: 'class MedianFinder {\n  constructor() {}\n  addNum(num) {}\n  findMedian() { return 0; }\n}',
      python: 'class MedianFinder:\n    def __init__(self):\n        pass\n    def addNum(self, num: int) -> None:\n        pass\n    def findMedian(self) -> float:\n        return 0.0',
    },
    examples: [
      { input: 'addNum(1); addNum(2); findMedian()', output: '1.5', explanation: 'Sorted: [1,2], median = (1+2)/2 = 1.5.' },
      { input: 'addNum(3); findMedian()', output: '2.0', explanation: 'Sorted: [1,2,3], median = 2.' },
    ],
    constraints: ['-10^5 <= num <= 10^5', 'At most 5 * 10^4 calls to addNum and findMedian.', 'At least one element will exist when findMedian is called.'],
    hidden_tests: [
      { tags: ['basic_case'], input: 'ascending sequence', description: '1..5 in order', expected_output: '3.0' },
      { tags: ['edge_case'], input: 'single element', description: 'only one value', expected_output: 'that value' },
      { tags: ['edge_case'], input: 'duplicates', description: 'repeated values', expected_output: 'correct median' },
      { tags: ['edge_case'], input: 'interleaved', description: 'mix of high and low', expected_output: 'correct median' },
      { tags: ['performance'], input: '50000 operations', description: 'max load', expected_output: 'correct median' },
    ],
    hint_framework: { phase2: ['The median splits the data into a "small half" and a "large half".', 'What data structure gives you the maximum of the small half and the minimum of the large half efficiently?'], phase3: ['Use a max-heap for the smaller half (so you can access the largest small value) and a min-heap for the larger half (smallest large value). Balance sizes: |small| == |large| or |small| == |large| + 1.'] },
    solutions: {
      optimal: {
        approach: 'Two heaps: a max-heap (small) for the lower half and a min-heap (large) for the upper half. Add to small first (negate for max-heap), balance: if small has 2+ more than large, move to large. If small\'s max > large\'s min, swap. Median: if sizes equal → mean of tops; else small\'s top.',
        time: 'O(log n) per addNum, O(1) per findMedian',
        space: 'O(n)',
        code: 'import heapq\n\nclass MedianFinder:\n    def __init__(self):\n        self.small = []  # max-heap (negate)\n        self.large = []  # min-heap\n\n    def addNum(self, num):\n        heapq.heappush(self.small, -num)\n        if self.small and self.large and -self.small[0] > self.large[0]:\n            heapq.heappush(self.large, -heapq.heappop(self.small))\n        if len(self.small) > len(self.large) + 1:\n            heapq.heappush(self.large, -heapq.heappop(self.small))\n        if len(self.large) > len(self.small):\n            heapq.heappush(self.small, -heapq.heappop(self.large))\n\n    def findMedian(self):\n        if len(self.small) > len(self.large):\n            return float(-self.small[0])\n        return (-self.small[0] + self.large[0]) / 2.0',
      },
    },
    common_mistakes: [
      'Forgetting to rebalance after adding — can lead to stale tops in the wrong heap',
      'Python: using a min-heap as a max-heap without negating values; forgetting to negate back on access',
      'Integer division (//) for median of two ints — must use float division (/) to get correct decimal',
    ],
    follow_ups: [
      { variant: 'What if the data is too large to fit in memory?', angle: 'Use reservoir sampling or count-min sketch for approximate medians; two-heap approach requires full data', difficulty_delta: 'hard' },
    ],
    meta: {},
  },
];

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  for (const q of QUESTIONS) {
    const exists = await prisma.question.findUnique({ where: { id: q.id } });
    if (exists) {
      console.log(`✓ ${q.id}: already exists, skipping`);
      continue;
    }
    await prisma.question.create({ data: q });
    console.log(`✅ ${q.id}: seeded (${q.difficulty}, ${q.topics.join(', ')})`);
  }
  console.log(`\nDone! ${QUESTIONS.length} questions processed.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
