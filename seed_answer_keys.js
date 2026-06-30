#!/usr/bin/env node
/**
 * Seeds answer key data (solutions, common_mistakes, follow_ups, pattern_tags)
 * for all technical questions that don't have them.
 * Run from project root: node seed_answer_keys.js
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

const ANSWER_KEYS = {
  'valid-anagram': {
    solutions: {
      optimal: {
        approach: "Count character frequencies with a hash map or array. Two strings are anagrams if their character counts match exactly.",
        time: "O(n)",
        space: "O(1) — fixed charset size",
        code: "def solve(s, t):\n    from collections import Counter\n    return Counter(s) == Counter(t)"
      }
    },
    common_mistakes: [
      "Using sort() which is O(n log n) instead of counting O(n)",
      "Not handling different length strings as early false",
      "Case sensitivity — 'A' vs 'a'"
    ],
    follow_ups: [
      { variant: "Group anagrams from a list of strings", angle: "Use sorted string or count signature as key", difficulty_delta: "medium" },
    ],
    pattern_tags: ["hash map", "character counting", "sorting"],
  },
  'product-of-array-except-self': {
    solutions: {
      brute_force: {
        approach: "For each index, multiply all other elements",
        time: "O(n^2)", space: "O(1)",
        code: "def solve(nums):\n    n=len(nums); return [product(all)/n for n in nums] # division (not allowed)"
      },
      optimal: {
        approach: "Compute prefix and suffix products. answer[i] = prefix_products[i] * suffix_products[i]",
        time: "O(n)", space: "O(1) output array",
        code: "def solve(nums):\n    n=len(nums); ans=[1]*n\n    p=1\n    for i in range(n): ans[i]=p; p*=nums[i]\n    s=1\n    for i in range(n-1,-1,-1): ans[i]*=s; s*=nums[i]\n    return ans"
      }
    },
    common_mistakes: [
      "Using division when problem explicitly forbids it",
      "Not handling zeros correctly — prefix/suffix still works but division would fail",
      "Creating an extra array for prefix/suffix instead of using the output array"
    ],
    follow_ups: [
      { variant: "What if you had to do it with O(1) extra space beyond output?", angle: "Use output array for prefix, accumulate suffix in a variable", difficulty_delta: "same" },
    ],
    pattern_tags: ["prefix sum", "array manipulation", "in-place"],
  },
  'first-missing-positive': {
    solutions: {
      brute_force: {
        approach: "Sort and scan for first missing positive",
        time: "O(n log n)", space: "O(1)",
        code: "def solve(nums):\n    nums.sort(); t=1\n    for n in nums:\n        if n==t: t+=1\n    return t"
      },
      optimal: {
        approach: "Cyclic sort: put each positive number at its correct index (nums[i] = i+1), then scan for mismatch",
        time: "O(n)", space: "O(1)",
        code: "def solve(nums):\n    n=len(nums)\n    for i in range(n):\n        while 1<=nums[i]<=n and nums[nums[i]-1]!=nums[i]:\n            nums[nums[i]-1],nums[i]=nums[i],nums[nums[i]-1]\n    for i in range(n):\n        if nums[i]!=i+1: return i+1\n    return n+1"
      }
    },
    common_mistakes: [
      "Sorting first (O(n log n)) when O(n) is expected",
      "Not ignoring zeros and negatives — they don't affect the answer",
      "Infinite loop in cyclic sort if duplicates aren't handled"
    ],
    follow_ups: [
      { variant: "What if the input is too large for O(n) memory?", angle: "Discuss tradeoffs — cyclic sort uses O(1) extra space", difficulty_delta: "harder" },
    ],
    pattern_tags: ["cyclic sort", "array indexing", "in-place"],
  },
  'minimum-size-subarray-sum': {
    solutions: {
      brute_force: {
        approach: "Check every subarray, sum and compare to target",
        time: "O(n^2)", space: "O(1)",
        code: "def solve(target, nums):\n    n=len(nums); best=n+1\n    for i in range(n):\n        s=0\n        for j in range(i,n):\n            s+=nums[j]\n            if s>=target: best=min(best,j-i+1); break\n    return 0 if best>n else best"
      },
      optimal: {
        approach: "Sliding window: expand right until sum >= target, then shrink left",
        time: "O(n)", space: "O(1)",
        code: "def solve(target, nums):\n    l=0; s=0; best=len(nums)+1\n    for r in range(len(nums)):\n        s+=nums[r]\n        while s>=target:\n            best=min(best,r-l+1)\n            s-=nums[l]; l+=1\n    return 0 if best>len(nums) else best"
      }
    },
    common_mistakes: [
      "Using overflow-prone prefix sum + binary search when sliding window is simpler",
      "Forgetting to shrink from the left after finding a valid window",
      "Using best = Infinity but returning 0 when no subarray exists — off-by-one on the edge case"
    ],
    follow_ups: [
      { variant: "What if elements can be negative?", angle: "Sliding window breaks — need prefix sum + monotonic deque for O(n)", difficulty_delta: "harder" },
    ],
    pattern_tags: ["sliding window", "two pointers", "prefix sum"],
  },
};

// Questions that already have answer keys (from original seed) — skip
const SKIP = ['longest-substring-without-repeating-characters'];

async function main() {
  for (const [slug, data] of Object.entries(ANSWER_KEYS)) {
    if (SKIP.includes(slug)) continue;

    const q = await prisma.question.findUnique({ where: { id: slug } });
    if (!q) {
      console.log(`⚠ Skipped ${slug}: not found`);
      continue;
    }

    // Only update if fields are empty
    const hasSol = q.solutions && (typeof q.solutions === 'object' ? Object.keys(q.solutions).length > 0 : true);
    const hasMistakes = Array.isArray(q.commonMistakes) && q.commonMistakes.length > 0;
    const hasFollowUps = Array.isArray(q.followUps) && q.followUps.length > 0;
    const hasTags = Array.isArray(q.pattern_tags) && q.pattern_tags.length > 0;

    if (!hasSol || !hasMistakes || !hasFollowUps || !hasTags) {
      await prisma.question.update({
        where: { id: slug },
        data: {
          ...(!hasSol ? { solutions: data.solutions } : {}),
          ...(!hasMistakes ? { common_mistakes: data.commonMistakes } : {}),
          ...(!hasFollowUps ? { follow_ups: data.followUps } : {}),
          ...(!hasTags ? { pattern_tags: data.pattern_tags } : {}),
        },
      });
      console.log(`✅ ${slug}: answer keys seeded`);
    } else {
      console.log(`✓ ${slug}: already has answer keys`);
    }
  }
  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
