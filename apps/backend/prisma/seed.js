import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

console.log('Loading .env from:', path.join(rootDir, '.env'));
dotenv.config({ path: path.join(rootDir, '.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing questions
  await prisma.question.deleteMany({});
  console.log('✓ Cleared existing questions');

  // Seed: Longest Substring Without Repeating Characters
  const longestSubstringQuestion = await prisma.question.create({
    data: {
      slug: 'longest-substring-without-repeating-characters',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'medium',
      skillTargets: ['sliding-window', 'hash-table', 'string-manipulation'],
      tags: ['leetcode-3', 'interview-classic'],
      problemStatement: `Given a string s, find the length of the longest substring without repeating characters.

A substring is a contiguous sequence of characters within a string.

Examples:
- Input: s = "abcabcbb", Output: 3 (Explanation: The answer is "abc", which has length 3.)
- Input: s = "bbbbb", Output: 1 (Explanation: The answer is "b", which has length 1.)
- Input: s = "pwwkew", Output: 3 (Explanation: The answer is "wke", which has length 3.)`,
      constraints: [
        '0 <= s.length <= 5 * 10^4',
        's consists of English letters, digits, symbols and spaces.',
        'Time Complexity: O(n)',
        'Space Complexity: O(min(m, n)) where m is the character set size',
      ],
      boilerplate: {
        javascript: `function lengthOfLongestSubstring(s) {
  // Your solution here
  // Return the length of the longest substring without repeating characters
}`,
        python: `def lengthOfLongestSubstring(s: str) -> int:
    # Your solution here
    # Return the length of the longest substring without repeating characters
    pass`,
        java: `public class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Your solution here
        // Return the length of the longest substring without repeating characters
        return 0;
    }
}`,
      },
      visibleTests: [
        {
          id: 'v1',
          input: 'abcabcbb',
          expected: 3,
          description: 'Input: "abcabcbb", Output: 3 (Substring "abc")',
        },
        {
          id: 'v2',
          input: 'bbbbb',
          expected: 1,
          description: 'Input: "bbbbb", Output: 1 (Substring "b")',
        },
        {
          id: 'v3',
          input: 'pwwkew',
          expected: 3,
          description: 'Input: "pwwkew", Output: 3 (Substring "wke")',
        },
      ],
      hiddenTests: [
        {
          id: 'h1',
          input: '',
          expected: 0,
          tags: ['empty_input'],
        },
        {
          id: 'h2',
          input: ' ',
          expected: 1,
          tags: ['whitespace'],
        },
        {
          id: 'h3',
          input: 'abba',
          expected: 2,
          tags: ['window_reset_bug'],
        },
        {
          id: 'h4',
          input: 'tmmzuxt',
          expected: 5,
          tags: ['last_seen_update_bug'],
        },
        {
          id: 'h5',
          input: 'dvdf',
          expected: 3,
          tags: ['off_by_one'],
        },
      ],
      failureModes: [
        'Incorrect window reset when encountering duplicate',
        'Non-monotonic left pointer (moving backwards)',
        'Incorrect last-seen character index tracking',
        'Using O(n^2) substring scanning instead of sliding window',
        'Off-by-one errors in length calculation',
      ],
      hints: [
        'Level 1: Use a sliding window approach with two pointers (left and right)',
        'Level 2: Maintain a hash map to track the last seen index of each character',
        'Level 3: The left pointer should only move forward (monotonic invariant)',
      ],
      interviewerProbes: [
        'Walk me through your solution with the example "abba"',
        'What is the invariant of your sliding window?',
        'Can you explain why the left pointer never moves backward?',
        'What is the time and space complexity of your solution?',
        'How would your solution handle edge cases like empty strings or single characters?',
      ],
    },
  });

  console.log('✓ Seeded question:', longestSubstringQuestion.slug);
  console.log('\n📊 Seed Summary:');
  console.log(`✓ Created 1 question: "${longestSubstringQuestion.title}"`);
  console.log(`✓ Visible tests: ${longestSubstringQuestion.visibleTests.length}`);
  console.log(`✓ Hidden tests: ${longestSubstringQuestion.hiddenTests.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seeding complete!');
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
