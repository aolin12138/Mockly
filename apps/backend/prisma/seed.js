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

  const firstQuestion = await prisma.question.create({
    data: {
      id: 'longest-substring-without-repeating-characters',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'medium',
      topics: ['strings', 'sliding-window'],
      pattern_tags: ['strings', 'sliding-window', 'hashmaps'],
      languages_supported: ['python', 'js', 'java', 'cpp', 'go'],
      estimated_time_min: 30,
      problem_statement: `Given a string s, return the length of the longest substring without repeating characters.\nA substring is a contiguous sequence of characters.\nReturn 0 when the input string is empty.`,
      examples: [
        {
          input: '"abcabcbb"',
          output: '3',
          explanation: 'The longest substring without repeated characters is "abc".',
        },
        {
          input: '"bbbbb"',
          output: '1',
          explanation: 'Any valid substring contains only one unique character.',
        },
        {
          input: '"pwwkew"',
          output: '3',
          explanation: 'A longest valid substring is "wke".',
        },
      ],
      constraints: [
        '0 <= s.length <= 5 * 10^4',
        's consists of English letters, digits, symbols, and spaces.',
      ],
      hidden_tests: [
        {
          input: '""',
          expected_output: '0',
          description: 'empty input',
        },
        {
          input: '" "',
          expected_output: '1',
          description: 'single space',
        },
        {
          input: '"abba"',
          expected_output: '2',
          description: 'window reset',
        },
        {
          input: '"tmmzuxt"',
          expected_output: '5',
          description: 'last seen update',
        },
        {
          input: '"dvdf"',
          expected_output: '3',
          description: 'off by one',
        },
        {
          input: '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"',
          expected_output: '62',
          description: 'basic case',
        },
      ],
      solutions: {
        brute_force: {
          approach: 'Check every substring and verify whether all characters in it are unique.',
          time: 'O(n^2)',
          space: 'O(n)',
          code: `def solve(s: str) -> int:\n    best = 0\n    n = len(s)\n\n    for i in range(n):\n        seen = set()\n        for j in range(i, n):\n            if s[j] in seen:\n                break\n            seen.add(s[j])\n            best = max(best, j - i + 1)\n\n    return best`,
        },
        optimal: {
          approach: 'Use a sliding window and a map of last-seen indices to move the left bound without rescanning.',
          time: 'O(n)',
          space: 'O(min(n, charset))',
          code: `def solve(s: str) -> int:\n    left = 0\n    best = 0\n    last_seen = {}\n\n    for right, ch in enumerate(s):\n        if ch in last_seen and last_seen[ch] >= left:\n            left = last_seen[ch] + 1\n        last_seen[ch] = right\n        best = max(best, right - left + 1)\n\n    return best`,
        },
      },
      hint_framework: {
        key_insights: [
          'The current candidate substring must always contain unique characters.',
          'When a repeated character appears, move the left bound to exclude the prior occurrence.',
          'Track last-seen positions to move left directly instead of scanning.',
        ],
        common_misdirections: [
          {
            approach: 'Restart scanning from each character with nested loops',
            note: 'Works on small inputs but does repeated work and misses the linear target.',
          },
          {
            approach: 'Reset left to duplicate_index + 1 even when left is already ahead',
            note: 'Can move the window backward and produce incorrect lengths.',
          },
        ],
        tier_targets: {
          '1': 'Nudge toward maintaining a moving valid substring window without naming the technique.',
          '2': 'Name the sliding-window plus last-seen-index idea without giving update rules.',
          '3': 'Explain how to update left and right bounds with last-seen checks, without code.',
        },
        never_reveal: [
          'the exact code',
          'the final complexity before derivation',
          'the exact off-by-one index update as a direct instruction',
        ],
        expected_path: 'nested substring checks -> identify repeated rescan waste -> keep a valid moving window -> use last-seen map to jump left -> derive linear solution',
      },
      common_mistakes: [
        'Moving left pointer backward when duplicate index is before the current window.',
        'Computing window length as right - left instead of right - left + 1.',
        'Updating last_seen after length update in a way that misses duplicate handling.',
      ],
      follow_ups: [
        {
          variant: 'What if you must return the actual substring, not just its length?',
          angle: 'Track best window boundaries',
          difficulty_delta: 'harder',
        },
        {
          variant: 'What if characters are streamed one-by-one and memory is bounded?',
          angle: 'Online processing constraints',
          difficulty_delta: 'harder',
        },
      ],
      meta: {
        source: 'classic',
        author: 'mockly-seed',
        created: '2026-04-21',
      },
    },
  });

  console.log('✓ Seeded question:', firstQuestion.id);
  console.log('\n📊 Seed Summary:');
  console.log(`✓ Created 1 question: "${firstQuestion.title}"`);
  console.log(`✓ Hidden tests: ${firstQuestion.hidden_tests.length}`);
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
