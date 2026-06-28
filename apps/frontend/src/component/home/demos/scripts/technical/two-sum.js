// Canonical Technical script. Per spec §7.3 storyboard.
// Two-Sum problem, hash-map approach. JavaScript.
//
// Token classNames for code syntax (slate colors on dark bg):
//   kw     = keyword (function, const, let, return, if)    text-sky-300
//   fn     = function/method name                           text-emerald-300
//   param  = parameter / variable                           text-slate-200
//   op     = operator / assignment                          text-rose-300
//   num    = number literal                                 text-amber-300
//   str    = string literal                                 text-emerald-400
//   punct  = punctuation (;{},)                             text-slate-500
//   cmt    = comment                                        text-slate-600 italic
//
// Timeline (ms):
//   0      panel chrome; left pane starts typing problem
//   600    problem title starts; body at 2000
//   3000   code starts typing line-by-line at ~120ms/line
//   7500   Run tests button highlights; tests populate
//   8000   test results reveal row by row: 3 pass, 1 fail
//   10500  diff: edit one line, re-run, all pass
//   13000  Submit highlights; loops
//   14000  cycle wraps
//

const KW = 'text-sky-300';
const FN = 'text-emerald-300';
const PARAM = 'text-slate-200';
const OP = 'text-rose-300';
const NUM = 'text-amber-300';
const STR = 'text-emerald-400';
const PUNCT = 'text-slate-500';
const CMT = 'text-slate-600 italic';

// Tokenized code lines. Each line is an array of { text, className }.
const LINES = [
  [
    { text: 'function', className: KW },
    { text: ' ', className: '' },
    { text: 'twoSum', className: FN },
    { text: '(', className: PUNCT },
    { text: 'nums', className: PARAM },
    { text: ', ', className: '' },
    { text: 'target', className: PARAM },
    { text: ') {', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'const', className: KW },
    { text: ' seen', className: '' },
    { text: ' = ', className: OP },
    { text: 'new', className: KW },
    { text: ' Map', className: FN },
    { text: '();', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'for', className: KW },
    { text: ' (', className: PUNCT },
    { text: 'let', className: KW },
    { text: ' i', className: '' },
    { text: ' = ', className: OP },
    { text: '0', className: NUM },
    { text: '; i < ', className: '' },
    { text: 'nums.length', className: PARAM },
    { text: '; i++) {', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'const', className: KW },
    { text: ' need', className: '' },
    { text: ' = ', className: OP },
    { text: 'target', className: PARAM },
    { text: ' - ', className: OP },
    { text: 'nums', className: PARAM },
    { text: '[i];', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (seen.', className: '' },
    { text: 'has', className: FN },
    { text: '(need)) ', className: '' },
    { text: 'return', className: KW },
    { text: ' [seen.', className: '' },
    { text: 'get', className: FN },
    { text: '(need), i];', className: PUNCT },
  ],
  [
    { text: '    seen.', className: '' },
    { text: 'set', className: FN },
    { text: '(nums[i], i);', className: PUNCT },
  ],
  [
    { text: '  }', className: PUNCT },
  ],
  [
    { text: '}', className: PUNCT },
  ],
];

// The line to replace with the diff (line index 3 — the "need" line).
// In the canonical storyboard, the code initially works for all test cases
// but we show a deliberate "bug" line that gets fixed in the diff.
// Original line 3: `const need = target - nums[i];` (same as above)
// Diff version: adds explicit check (not really a bug, just a visual diff)
const REPLACEMENT_LINE = [
  { text: '    ', className: '' },
  { text: 'const', className: KW },
  { text: ' need', className: '' },
  { text: ' = ', className: OP },
  { text: 'target', className: PARAM },
  { text: ' - ', className: OP },
  { text: 'nums', className: PARAM },
  { text: '[i];', className: PUNCT },
  { text: '  // compute complement', className: CMT },
];

// Test cases: most pass, one fails before diff, all pass after.
const TEST_CASES = [
  {
    pass: true,
    input: 'nums=[2,7,11,15], target=9',
    expected: '[0,1]',
    actual: '[0,1]',
  },
  {
    pass: true,
    input: 'nums=[3,2,4], target=6',
    expected: '[1,2]',
    actual: '[1,2]',
  },
  {
    pass: true,
    input: 'nums=[3,3], target=6',
    expected: '[0,1]',
    actual: '[0,1]',
  },
  // Edge case: empty array — initially fails, then diff fixes it
  {
    pass: false,
    input: 'nums=[], target=0',
    expected: 'undefined',
    actual: 'Error: null pointer',
  },
];

export default {
  id: 'two-sum',
  demo: 'technical',
  duration: 14000,
  tags: ['canonical', 'hash-map', 'arrays'],
  frames: [
    { t: 600, type: 'typewrite', target: 'problem_title', text: 'Two-Sum' },
    { t: 2000, type: 'typewrite', target: 'problem_body', text: 'Given an array of integers and a target, return indices of the two numbers that add to the target. You may assume exactly one solution and you cannot use the same element twice.' },
    { t: 2500, type: 'callout', id: 'code-live-callout', x: 55, y: 30, text: 'Code in real time with voice on the side', align: 'right' },
    { t: 3000, type: 'code_line', line: LINES[0] },
    { t: 3120, type: 'code_line', line: LINES[1] },
    { t: 3240, type: 'code_line', line: LINES[2] },
    { t: 3360, type: 'code_line', line: LINES[3] },
    { t: 3480, type: 'code_line', line: LINES[4] },
    { t: 3600, type: 'code_line', line: LINES[5] },
    { t: 3720, type: 'code_line', line: LINES[6] },
    { t: 3840, type: 'code_line', line: LINES[7] },
    { t: 4200, type: 'callout', id: 'tests-callout', x: 55, y: 30, text: 'See your code run against real test cases', align: 'right' },
    { t: 5000, type: 'agent_orb', state: 'speaking' },
    { t: 5000, type: 'typewrite', target: 'agent_hint', text: 'Consider using a hash map to track seen values' },
    { t: 6800, type: 'agent_orb', state: 'idle' },
    { t: 7500, type: 'run_tests' },
    { t: 7500, type: 'test_result', testCase: TEST_CASES[0] },
    { t: 7800, type: 'test_result', testCase: TEST_CASES[1] },
    { t: 8100, type: 'test_result', testCase: TEST_CASES[2] },
    { t: 8400, type: 'test_result', testCase: TEST_CASES[3] },
    { t: 8800, type: 'callout', id: 'fail-callout', x: 30, y: 82, text: 'Edge case missed — iterate and fix', align: 'center' },
    { t: 10500, type: 'code_edit', lineIndex: 3, replacement: REPLACEMENT_LINE },
    { t: 11000, type: 'run_tests' },
    { t: 11500, type: 'callout', id: 'done-callout', x: 30, y: 82, text: 'Iterate fast, ship the cleaner solution', align: 'center' },
    { t: 13000, type: 'submit' },
  ],
  captions: [
    { t: 0, text: 'Code in real time, voice on the side' },
    { t: 4500, text: 'See your code run against real test cases' },
    { t: 10500, text: 'Iterate fast, ship the cleaner solution' },
  ],
};
