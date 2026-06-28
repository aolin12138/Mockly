// Technical script: Linked List Cycle. Floyd's Tortoise and Hare. JavaScript.
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
    { text: 'hasCycle', className: FN },
    { text: '(', className: PUNCT },
    { text: 'head', className: PARAM },
    { text: ') {', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'if', className: KW },
    { text: ' (', className: PUNCT },
    { text: '!head', className: '' },
    { text: ' || ', className: OP },
    { text: '!head.next', className: '' },
    { text: ') ', className: '' },
    { text: 'return', className: KW },
    { text: ' ', className: '' },
    { text: 'false', className: KW },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'let', className: KW },
    { text: ' slow', className: '' },
    { text: ' = ', className: OP },
    { text: 'head', className: '' },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'let', className: KW },
    { text: ' fast', className: '' },
    { text: ' = ', className: OP },
    { text: 'head', className: '' },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'while', className: KW },
    { text: ' (fast', className: '' },
    { text: ' && ', className: OP },
    { text: 'fast.next', className: '' },
    { text: ') {', className: PUNCT },
  ],
  [
    { text: '    slow', className: '' },
    { text: ' = ', className: OP },
    { text: 'slow.next', className: '' },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '    fast', className: '' },
    { text: ' = ', className: OP },
    { text: 'fast.next.next', className: '' },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (slow', className: '' },
    { text: ' === ', className: OP },
    { text: 'fast) ', className: '' },
    { text: 'return', className: KW },
    { text: ' ', className: '' },
    { text: 'true', className: KW },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  }', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'return', className: KW },
    { text: ' ', className: '' },
    { text: 'false', className: KW },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '}', className: PUNCT },
  ],
];

// Diff version: the initial code had a weak while condition
// `while (fast.next)` without null-guarding `fast` itself.
// The diff wraps it with `while (fast && fast.next)`.
const ORIGINAL_WHILE_LINE = [
  { text: '  ', className: '' },
  { text: 'while', className: KW },
  { text: ' (fast.next) {', className: PUNCT },
  { text: '  // missing fast null guard', className: CMT },
];

const FIXED_WHILE_LINE = [
  { text: '  ', className: '' },
  { text: 'while', className: KW },
  { text: ' (fast', className: '' },
  { text: ' && ', className: OP },
  { text: 'fast.next', className: '' },
  { text: ') {', className: PUNCT },
  { text: '  // null-safe loop guard', className: CMT },
];

// Override LINES[4] to show the buggy version
LINES[4] = ORIGINAL_WHILE_LINE;

// Test cases: 3 pass, 1 fail (edge: fast pointer null check missed)
const TEST_CASES = [
  {
    pass: true,
    input: 'head=[3,2,0,-4], pos=1',
    expected: 'true',
    actual: 'true',
  },
  {
    pass: true,
    input: 'head=[1,2], pos=0',
    expected: 'true',
    actual: 'true',
  },
  {
    pass: true,
    input: 'head=[1], pos=-1',
    expected: 'false',
    actual: 'false',
  },
  // Edge case: single node with null next — fast.next throws without fast guard
  {
    pass: false,
    input: 'head=[1,2], pos=-1',
    expected: 'false',
    actual: 'Error: cannot read next of null',
  },
];

export default {
  id: 'linked-list-cycle',
  demo: 'technical',
  duration: 14000,
  tags: ['two-pointer', 'linked-list', 'floyd'],
  frames: [
    {
      t: 600,
      type: 'typewrite',
      target: 'problem_title',
      text: 'Linked List Cycle',
    },
    {
      t: 2000,
      type: 'typewrite',
      target: 'problem_body',
      text: 'Given the head of a linked list, determine if the list has a cycle. Use O(1) memory.',
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
    { t: 7500, type: 'run_tests' },
    { t: 7500, type: 'test_result', testCase: TEST_CASES[0] },
    { t: 7800, type: 'test_result', testCase: TEST_CASES[1] },
    { t: 8100, type: 'test_result', testCase: TEST_CASES[2] },
    { t: 8400, type: 'test_result', testCase: TEST_CASES[3] },
    {
      t: 10500,
      type: 'code_edit',
      lineIndex: 4,
      replacement: FIXED_WHILE_LINE,
    },
    { t: 11000, type: 'run_tests' },
    { t: 13000, type: 'submit' },
  ],
  captions: [
    { t: 0, text: 'Tortoise and hare meet in cycles' },
    { t: 4500, text: 'Null pointer on acyclic two-node list' },
    { t: 10500, text: 'Guard both fast and fast.next' },
  ],
};
