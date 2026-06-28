// Technical script: Valid Palindrome. Two-pointer approach. JavaScript.
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
    { text: 'isPalindrome', className: FN },
    { text: '(', className: PUNCT },
    { text: 's', className: PARAM },
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
    { text: 's.length - 1', className: '' },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'while', className: KW },
    { text: ' (left < right) {', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'const', className: KW },
    { text: ' l', className: '' },
    { text: ' = ', className: OP },
    { text: 's[left]', className: PARAM },
    { text: '.', className: '' },
    { text: 'toLowerCase', className: FN },
    { text: '();', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'const', className: KW },
    { text: ' r', className: '' },
    { text: ' = ', className: OP },
    { text: 's[right]', className: PARAM },
    { text: '.', className: '' },
    { text: 'toLowerCase', className: FN },
    { text: '();', className: PUNCT },
  ],
  [
    { text: '    ', className: '' },
    { text: 'if', className: KW },
    { text: ' (l ', className: '' },
    { text: '!==', className: OP },
    { text: ' r) ', className: '' },
    { text: 'return', className: KW },
    { text: ' ', className: '' },
    { text: 'false', className: KW },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '    left++;', className: '' },
    { text: '  ', className: '' },
    { text: 'right--;', className: '' },
  ],
  [
    { text: '  }', className: PUNCT },
  ],
  [
    { text: '  ', className: '' },
    { text: 'return', className: KW },
    { text: ' ', className: '' },
    { text: 'true', className: KW },
    { text: ';', className: PUNCT },
  ],
  [
    { text: '}', className: PUNCT },
  ],
];

// Diff version: adds regex sanitization to skip non-alphanumeric chars
const REPLACEMENT_LINE_LEFT = [
  { text: '    const l = s[left]', className: '' },
  { text: '.replace', className: FN },
  { text: '(', className: PUNCT },
  { text: '/[^a-zA-Z0-9]/g', className: STR },
  { text: ", '')", className: STR },
  { text: '.', className: '' },
  { text: 'toLowerCase', className: FN },
  { text: '();', className: PUNCT },
  { text: '  // sanitize', className: CMT },
];

const REPLACEMENT_LINE_RIGHT = [
  { text: '    const r = s[right]', className: '' },
  { text: '.replace', className: FN },
  { text: '(', className: PUNCT },
  { text: '/[^a-zA-Z0-9]/g', className: STR },
  { text: ", '')", className: STR },
  { text: '.', className: '' },
  { text: 'toLowerCase', className: FN },
  { text: '();', className: PUNCT },
  { text: '  // sanitize', className: CMT },
];

// Test cases: 3 pass, 1 fail (non-alphanumeric edge — initial code doesn't sanitize)
const TEST_CASES = [
  {
    pass: true,
    input: '"racecar"',
    expected: 'true',
    actual: 'true',
  },
  {
    pass: true,
    input: '"hello"',
    expected: 'false',
    actual: 'false',
  },
  // Punctuation edge case — fails without sanitization
  {
    pass: false,
    input: '"A man, a plan, a canal: Panama"',
    expected: 'true',
    actual: 'false',
  },
  {
    pass: true,
    input: '"aba"',
    expected: 'true',
    actual: 'true',
  },
];

export default {
  id: 'valid-palindrome',
  demo: 'technical',
  duration: 14000,
  tags: ['two-pointer', 'strings'],
  frames: [
    {
      t: 600,
      type: 'typewrite',
      target: 'problem_title',
      text: 'Valid Palindrome',
    },
    {
      t: 2000,
      type: 'typewrite',
      target: 'problem_body',
      text: 'Given a string, determine if it is a palindrome considering only alphanumeric characters and ignoring case.',
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
    { t: 7500, type: 'run_tests' },
    { t: 7500, type: 'test_result', testCase: TEST_CASES[0] },
    { t: 7800, type: 'test_result', testCase: TEST_CASES[1] },
    { t: 8100, type: 'test_result', testCase: TEST_CASES[2] },
    { t: 8400, type: 'test_result', testCase: TEST_CASES[3] },
    {
      t: 10500,
      type: 'code_edit',
      lineIndex: 3,
      replacement: REPLACEMENT_LINE_LEFT,
    },
    {
      t: 10680,
      type: 'code_edit',
      lineIndex: 4,
      replacement: REPLACEMENT_LINE_RIGHT,
    },
    { t: 11200, type: 'run_tests' },
    { t: 13000, type: 'submit' },
  ],
  captions: [
    { t: 0, text: 'Two pointers meet in the middle' },
    { t: 4500, text: 'Failing on punctuation and spaces' },
    { t: 10500, text: 'Sanitize input then compare chars' },
  ],
};
