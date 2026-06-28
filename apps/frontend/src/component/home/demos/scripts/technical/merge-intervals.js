// Technical script: Merge Intervals. Sort + sweep approach. JavaScript.
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
    { text: 'merge', className: FN },
    { text: '(', className: PUNCT },
    { text: 'intervals', className: PARAM },
    { text: ') {', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'if', className: KW },
    { text: ' (intervals.', className: '' },
    { text: 'length', className: '' },
    { text: ' <= ', className: OP },
    { text: '1', className: NUM },
    { text: ') ', className: '' },
    { text: 'return', className: KW },
    { text: ' intervals;', className: '' },
  ],
  [
    { text: '  intervals.', className: '' },
    { text: 'sort', className: FN },
    { text: '((a, b) => a[0] - b[0]);', className: '' },
  ],
  [
    { text: '  ', className: '' },
    { text: 'const', className: KW },
    { text: ' result', className: '' },
    { text: ' = ', className: OP },
    { text: '[intervals[0]];', className: '' },
  ],
  [
    { text: '  ', className: '' },
    { text: 'for', className: KW },
    { text: ' (', className: PUNCT },
    { text: 'let', className: KW },
    { text: ' i', className: '' },
    { text: ' = ', className: OP },
    { text: '1', className: NUM },
    { text: '; i < intervals.', className: '' },
    { text: 'length', className: '' },
    { text: '; i++) {', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'const', className: KW },
    { text: ' last', className: '' },
    { text: ' = ', className: OP },
    { text: 'result[result.', className: '' },
    { text: 'length', className: '' },
    { text: ' - 1];', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (last[1] >= intervals[i][0]) {', className: '' },
  ],
  [
    { text: '      last[1]', className: '' },
    { text: ' = ', className: OP },
    { text: 'Math.', className: '' },
    { text: 'max', className: FN },
    { text: '(last[1], intervals[i][1]);', className: '' },
  ],
  [
    { text: '    } ', className: KW },
    { text: 'else', className: KW },
    { text: ' {', className: PUNCT },
  ],
  [
    { text: '      result.', className: '' },
    { text: 'push', className: FN },
    { text: '(intervals[i]);', className: '' },
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
    { text: ' result;', className: '' },
  ],
  [
    { text: '}', className: PUNCT },
  ],
];

// Diff version: adds missing `.sort()` before the sweep
const REPLACEMENT_LINE = [
  { text: '  intervals.', className: '' },
  { text: 'sort', className: FN },
  { text: '((a, b) => a[0] - b[0]);', className: '' },
  { text: '  // sort by start time', className: CMT },
];

// Test cases: 3 pass, 1 fail (unsorted input — initial code skips sort)
const TEST_CASES = [
  {
    pass: true,
    input: '[[1,3],[2,6],[8,10],[15,18]]',
    expected: '[[1,6],[8,10],[15,18]]',
    actual: '[[1,6],[8,10],[15,18]]',
  },
  {
    pass: true,
    input: '[[1,4],[4,5]]',
    expected: '[[1,5]]',
    actual: '[[1,5]]',
  },
  {
    pass: true,
    input: '[[1,4],[2,3]]',
    expected: '[[1,4]]',
    actual: '[[1,4]]',
  },
  // Edge case: unsorted input — sorting missing initially, diff adds sort
  {
    pass: false,
    input: '[[2,6],[1,3],[15,18],[8,10]]',
    expected: '[[1,6],[8,10],[15,18]]',
    actual: '[[2,6],[1,3],[15,18],[8,10]]',
  },
];

export default {
  id: 'merge-intervals',
  demo: 'technical',
  duration: 14000,
  tags: ['sorting', 'intervals'],
  frames: [
    {
      t: 600,
      type: 'typewrite',
      target: 'problem_title',
      text: 'Merge Intervals',
    },
    {
      t: 2000,
      type: 'typewrite',
      target: 'problem_body',
      text: 'Given an array of intervals, merge all overlapping intervals and return the result.',
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
    { t: 4560, type: 'code_line', line: LINES[13] },
    { t: 7500, type: 'run_tests' },
    { t: 7500, type: 'test_result', testCase: TEST_CASES[0] },
    { t: 7800, type: 'test_result', testCase: TEST_CASES[1] },
    { t: 8100, type: 'test_result', testCase: TEST_CASES[2] },
    { t: 8400, type: 'test_result', testCase: TEST_CASES[3] },
    {
      t: 10500,
      type: 'code_edit',
      lineIndex: 2,
      replacement: REPLACEMENT_LINE,
    },
    { t: 11000, type: 'run_tests' },
    { t: 13000, type: 'submit' },
  ],
  captions: [
    { t: 0, text: 'Sort once, then sweep and merge' },
    { t: 4500, text: 'Failing on unsorted interval input' },
    { t: 10500, text: 'Add sort and all tests pass' },
  ],
};
