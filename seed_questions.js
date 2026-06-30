#!/usr/bin/env node
/**
 * Seed boilerplate + fix hidden test tags for all technical questions.
 * Run from project root: node seed_questions.js
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

const BOILERPLATES = {
  'valid-anagram': {
    javascript: `function isAnagram(s, t) {
  // Return true if t is an anagram of s, false otherwise
  return false;
}`,
    python: `def isAnagram(s: str, t: str) -> bool:
    # Return True if t is an anagram of s, False otherwise
    return False`,
    java: `public class Solution {
    public boolean isAnagram(String s, String t) {
        // Return true if t is an anagram of s, false otherwise
        return false;
    }
}`,
  },
  'product-of-array-except-self': {
    javascript: `function productExceptSelf(nums) {
  // Return an array answer such that answer[i] = product of all elements except nums[i]
  return [];
}`,
    python: `def productExceptSelf(nums: list[int]) -> list[int]:
    # Return an array answer where answer[i] = product of all elements except nums[i]
    return []`,
    java: `public class Solution {
    public int[] productExceptSelf(int[] nums) {
        // Return an array answer where answer[i] = product of all elements except nums[i]
        return new int[nums.length];
    }
}`,
  },
  'longest-substring-without-repeating-characters': {
    javascript: `function lengthOfLongestSubstring(s) {
  // Return the length of the longest substring without repeating characters
  return 0;
}`,
    python: `def lengthOfLongestSubstring(s: str) -> int:
    # Return the length of the longest substring without repeating characters
    return 0`,
    java: `public class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Return the length of the longest substring without repeating characters
        return 0;
    }
}`,
  },
  'first-missing-positive': {
    javascript: `function firstMissingPositive(nums) {
  // Return the smallest positive integer not present in nums
  return 1;
}`,
    python: `def firstMissingPositive(nums: list[int]) -> int:
    # Return the smallest positive integer not present in nums
    return 1`,
    java: `public class Solution {
    public int firstMissingPositive(int[] nums) {
        // Return the smallest positive integer not present in nums
        return 1;
    }
}`,
  },
};

const TAG_FIXES = {
  'valid-anagram': {
    tags: [
      ['empty_input', 'edge_case'],
      ['single_char', 'basic_case'],
      ['unicode', 'edge_case'],
      ['long_string', 'performance'],
      ['different_lengths', 'basic_case'],
    ],
  },
  'product-of-array-except-self': {
    tags: [
      ['zeros', 'edge_case'],
      ['all_zeros', 'edge_case'],
      ['negative_numbers', 'edge_case'],
      ['single_element', 'basic_case'],
      ['large_array', 'performance'],
    ],
  },
  'longest-substring-without-repeating-characters': {
    tags: [
      ['empty_string', 'edge_case'],
      ['single_char', 'basic_case'],
      ['all_same', 'edge_case'],
      ['repeating_pattern', 'edge_case'],
      ['long_string', 'performance'],
    ],
  },
  'first-missing-positive': {
    tags: [
      ['empty_array', 'edge_case'],
      ['all_negative', 'edge_case'],
      ['duplicates', 'edge_case'],
      ['consecutive', 'basic_case'],
      ['large_gap', 'edge_case'],
    ],
  },
};

const ANSWER_KEYS = {
  'valid-anagram': { solutions: { optimal: { approach: "Count characters. Two strings are anagrams iff character counts match.", time: "O(n)", space: "O(1)", code: "from collections import Counter\ndef solve(s,t): return Counter(s)==Counter(t)" } }, common_mistakes: ["Using sort O(n log n) instead of counting O(n)", "Not checking lengths first", "Case sensitivity"], follow_ups: [{ variant: "Group anagrams from a list", angle: "Use count signature as key", difficulty_delta: "medium" }], pattern_tags: ["hash map", "counting"] },
  'product-of-array-except-self': { solutions: { optimal: { approach: "Prefix and suffix products. answer[i] = prefix[i] * suffix[i].", time: "O(n)", space: "O(1)", code: "def solve(nums):\n    n=len(nums); ans=[1]*n\n    p=1\n    for i in range(n): ans[i]=p; p*=nums[i]\n    s=1\n    for i in range(n-1,-1,-1): ans[i]*=s; s*=nums[i]\n    return ans" } }, common_mistakes: ["Using division when forbidden", "Zeros break division but not prefix/suffix", "Extra array instead of output"], follow_ups: [{ variant: "O(1) extra space beyond output?", angle: "Use output array for prefix", difficulty_delta: "same" }], pattern_tags: ["prefix sum", "arrays"] },
  'first-missing-positive': { solutions: { optimal: { approach: "Cyclic sort: put each positive at index value-1, then scan for first mismatch.", time: "O(n)", space: "O(1)", code: "def solve(nums):\n    n=len(nums)\n    for i in range(n):\n        while 1<=nums[i]<=n and nums[nums[i]-1]!=nums[i]:\n            nums[nums[i]-1],nums[i]=nums[i],nums[nums[i]-1]\n    for i in range(n):\n        if nums[i]!=i+1: return i+1\n    return n+1" } }, common_mistakes: ["Sorting O(n log n) when O(n) expected", "Ignoring negatives/zeros", "Infinite loop with duplicates"], follow_ups: [{ variant: "Too large for O(n) memory?", angle: "Cyclic sort uses O(1) extra", difficulty_delta: "harder" }], pattern_tags: ["cyclic sort", "array indexing"] },
  'minimum-size-subarray-sum': { solutions: { optimal: { approach: "Sliding window: expand right until sum >= target, shrink left to minimize.", time: "O(n)", space: "O(1)", code: "def solve(target,nums):\n    l=s=0; best=len(nums)+1\n    for r in range(len(nums)):\n        s+=nums[r]\n        while s>=target:\n            best=min(best,r-l+1)\n            s-=nums[l]; l+=1\n    return 0 if best>len(nums) else best" } }, common_mistakes: ["Forgetting to shrink left", "Overflow with prefix sum binary search", "Off-by-one on no-solution case"], follow_ups: [{ variant: "What if elements can be negative?", angle: "Sliding window breaks; use prefix sum + monotonic deque", difficulty_delta: "harder" }], pattern_tags: ["sliding window", "two pointers"] },
};

async function main() {
  for (const [slug, boilerplate] of Object.entries(BOILERPLATES)) {
    await prisma.question.updateMany({
      where: { id: slug },
      data: { boilerplate },
    });
    console.log(`✅ ${slug}: boilerplate seeded`);

    // Seed answer keys if missing
    const ak = ANSWER_KEYS[slug];
    if (ak) {
      const q = await prisma.question.findUnique({ where: { id: slug } });
      if (q) {
        const solEmpty = !q.solutions || (typeof q.solutions === 'object' && Object.keys(q.solutions).length === 0);
        const mistEmpty = !q.common_mistakes || (Array.isArray(q.common_mistakes) && q.common_mistakes.length === 0);
        const fuEmpty = !q.follow_ups || (Array.isArray(q.follow_ups) && q.follow_ups.length === 0);
        const tagsEmpty = !q.pattern_tags || (Array.isArray(q.pattern_tags) && q.pattern_tags.length === 0);
        if (solEmpty || mistEmpty || fuEmpty || tagsEmpty) {
          await prisma.question.update({
            where: { id: slug },
            data: {
              ...(solEmpty ? { solutions: ak.solutions } : {}),
              ...(mistEmpty ? { common_mistakes: ak.commonMistakes } : {}),
              ...(fuEmpty ? { follow_ups: ak.followUps } : {}),
              ...(tagsEmpty ? { pattern_tags: ak.pattern_tags } : {}),
            },
          });
        }
      }
    }

    const fix = TAG_FIXES[slug];
    if (fix) {
      const question = await prisma.question.findUnique({ where: { id: slug } });
      if (question) {
        let hiddenTests = question.hidden_tests;
        if (typeof hiddenTests === 'string') hiddenTests = JSON.parse(hiddenTests);
        if (Array.isArray(hiddenTests)) {
          for (let i = 0; i < hiddenTests.length && i < fix.tags.length; i++) {
            hiddenTests[i].tags = fix.tags[i];
          }
          await prisma.question.update({ where: { id: slug }, data: { hidden_tests: hiddenTests } });
          console.log(`   Tags fixed for ${hiddenTests.length} hidden tests`);
        }
      }
    }
  }
  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
