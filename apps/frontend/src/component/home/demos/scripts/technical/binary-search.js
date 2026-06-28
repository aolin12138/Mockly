// Technical script: Binary Search. Iterative approach. JavaScript.
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
// Initial code has an off-by-one bug in the mid calculation.
// LINES[3] is overridden below with the buggy version.
const LINES = [
  [
    { text: 'function', className: KW },
    { text: ' ', className: '' },
    { text: 'binarySearch', className: FN },
    { text: '(', className: PUNCT },
    { text: 'nums', className: PARAM },
    { text: ', ', className: '' },
    { text: 'target', className: PARAM },
    { text: ') {', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'let', className: KW },
    { text: ' left', className: '' },
    { text: ' = ', className: OP },
    { text: '0', className: NUM },
    { text: ', right', className: '' },
    { text: ' = ', className: OP },
    { text: 'nums.', className: '' },
    { text: 'length', className: '' },
    { text: ' - ', className: OP },
    { text: '1', className: NUM },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'while', className: KW },
    { text: ' (left <= right) {', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'const', className: KW },
    { text: ' mid', className: '' },
    { text: ' = ', className: OP },
    { text: 'Math.', className: '' },
    { text: 'floor', className: FN },
    { text: '((left + right) / 2);', className: '' },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (nums[mid]', className: '' },
    { text: ' === ', className: OP },
    { text: 'target) ', className: '' },
    { text: 'return', className: KW },
    { text: ' mid;', className: '' },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (nums[mid] < target) {', className: '' },
  ],
  [
    { text: '      left', className: '' },
    { text: ' = ', className: OP },
    { text: 'mid', className: '' },
    { text: ' + ', className: OP },
    { text: '1', className: NUM },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '    } ', className: KW },
    { text: 'else', className: KW },
    { text: ' {', className: PUNCT },
  ],
  [
    { text: '      right', className: '' },
    { text: ' = ', className: OP },
    { text: 'mid', className: '' },
    { text: ' - ', className: OP },
    { text: '1', className: NUM },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '    }', className: PUNCT },
  ],
  [
    { text: '  }', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'return', className: KW },
    { text: ' -', className: OP },
    { text: '1', className: NUM },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '}', className: PUNCT },
  ],
];

// Buggy mid line: off-by-one — `mid = floor((left + right - 1) / 2)`
// causes the search to miss the rightmost element.
const BUGGY_MID_LINE = [
  { text: '    ', className: '' },
  { text: 'const', className: KW },
  { text: ' mid', className: '' },
  { text: ' = ', className: OP },
  { text: 'Math.', className: '' },
  { text: 'floor', className: FN },
  { text: '((left + right - 1) / 2);', className: '' },
  { text: '  // bug: off-by-one', className: CMT },
];

// Fixed mid line: correct formula
const FIXED_MID_LINE = [
  { text: '    ', className: '' },
  { text: 'const', className: KW },
  { text: ' mid', className: '' },
  { text: ' = ', className: OP },
  { text: 'Math.', className: '' },
  { text: 'floor', className: FN },
  { text: '((left + right) / 2);', className: '' },
  { text: '  // corrected midpoint', className: CMT },
];

// Override with buggy version — the diff will fix it
LINES[3] = BUGGY_MID_LINE;

// Test cases: 3 pass, 1 fail (off-by-one — target at rightmost edge)
const TEST_CASES = [
  {
    pass: true,
    input: 'nums=[1,3,5,7,9], target=5',
    expected: '2',
    actual: '2',
  },
  {
    pass: true,
    input: 'nums=[1,3,5,7,9], target=1',
    expected: '0',
    actual: '0',
  },
  // Off-by-one bug: target 9 at rightmost index never gets checked
  {
    pass: false,
    input: 'nums=[1,3,5,7,9], target=9',
    expected: '4',
    actual: '-1',
  },
  // Empty array edge case — loop never runs, returns -1 correctly
  {
    pass: true,
    input: 'nums=[], target=10',
    expected: '-1',
    actual: '-1',
  },
];

export default {
  id: 'binary-search',
  demo: 'technical',
  duration: 14000,
  tags: ['binary-search', 'arrays'],
  frames: [
    {
      t: 600,
      type: 'typewrite',
      target: 'problem_title',
      text: 'Binary Search',
    },
    {
      t: 2000,
      type: 'typewrite',
      target: 'problem_body',
      text: 'Given a sorted array and a target, return the index of target, or -1 if not found. Must run in O(log n).',
    },
    { t: 3000, type: 'code_line', line: LINES[0] },
    { t: 3120, type: 'code_line', line: LINES[1] },
    { t: 3240, type: 'code_line', line: LINES[2] },
    { t: 3360, type: 'code_line', line: LINES[3] },
    { t: 3480, type: 'code_line', line: LINES[4] },
    { t: 3600, type: 'code_line', line: LINES[5] },
    { t: 3720, type: 'code_line', line: LINES[6] },
    { t: 3840, type: 'code_line', line: LINES[7] },
    { t: 3960, type: 'code_line', line: LINES[8] },
    { t: 4080, type: 'code_line', line: LINES[9] },
    { t: 4200, type: 'code_line', line: LINES[10] },
    { t: 4320, type: 'code_line', line: LINES[11] },
    { t: 4440, type: 'code_line', line: LINES[12] },
    { t: 7500, type: 'run_tests' },
    { t: 7500, type: 'test_result', testCase: TEST_CASES[0] },
    { t: 7800, type: 'test_result', testCase: TEST_CASES[1] },
    { t: 8100, type: 'test_result', testCase: TEST_CASES[2] },
    { t: 8400, type: 'test_result', testCase: TEST_CASES[3] },
    {
      t: 10500,
      type: 'code_edit',
      lineIndex: 3,
      replacement: FIXED_MID_LINE,
    },
    { t: 11000, type: 'run_tests' },
    { t: 13000, type: 'submit' },
  ],
  captions: [
    { t: 0, text: 'Divide and conquer in log n' },
    { t: 4500, text: 'Off-by-one misses the last element' },
    { t: 10500, text: 'Fix the midpoint and all pass' },
  ],
};
