#!/usr/bin/env node
/**
 * Seed boilerplate + fix hidden test tags for all technical questions.
 * Run from project root: node seed_questions.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// Fix hidden test tags: add meaningful tags for better failure classification
const TAG_FIXES = {
  'valid-anagram': {
    // Tags for hidden tests (by index)
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

async function main() {
  for (const [slug, boilerplate] of Object.entries(BOILERPLATES)) {
    // Update boilerplate
    await prisma.question.updateMany({
      where: { id: slug },
      data: { boilerplate },
    });
    console.log(`✅ ${slug}: boilerplate seeded (${Object.keys(boilerplate).join(', ')})`);

    // Fix hidden test tags
    const fix = TAG_FIXES[slug];
    if (fix) {
      const question = await prisma.question.findUnique({ where: { id: slug } });
      if (question) {
        let hiddenTests = question.hidden_tests;
        if (typeof hiddenTests === 'string') {
          hiddenTests = JSON.parse(hiddenTests);
        }
        if (Array.isArray(hiddenTests)) {
          for (let i = 0; i < hiddenTests.length && i < fix.tags.length; i++) {
            hiddenTests[i].tags = fix.tags[i];
          }
          await prisma.question.update({
            where: { id: slug },
            data: { hidden_tests: hiddenTests },
          });
          console.log(`   Tags fixed for ${hiddenTests.length} hidden tests`);
        }
      }
    }
  }

  console.log('\nDone! All questions seeded.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
