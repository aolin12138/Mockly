You are a senior full-stack engineer. Implement a complete “Technical Interview Session” feature in a Next.js + React + TypeScript app using Prisma + Postgres and Judge0 for sandboxed execution.

GOAL
Build a technical interview page that:
1) Shows a randomly selected coding question from the DB.
2) Provides a Monaco Editor coding environment.
3) Supports JavaScript, Python, and Java.
4) Runs visible + hidden tests via backend → Judge0.
5) Shows detailed results for visible tests, and only a redacted hidden summary to the user.
6) Produces a structured “run report” suitable for an interviewer agent (agent hook placeholder only).

STACK ASSUMPTIONS
- Next.js App Router (app/ directory)
- TypeScript
- Prisma connected to Postgres
- Frontend uses @monaco-editor/react
- Backend calls Judge0 CE API

LANGUAGE SUPPORT (LOCK THESE)
- JavaScript (Node): Judge0 language_id = 63
- Python 3: Judge0 language_id = 71
- Java: Judge0 language_id = 62

All three languages must be supported end-to-end:
- Monaco syntax highlighting
- Boilerplate per language
- Language-specific harness generation
- Judge0 execution

DATA MODEL
Add a new Prisma model Question with JSON fields:
- slug (unique)
- title
- difficulty (enum easy/medium/hard)
- skillTargets (JSON array of strings)
- tags (JSON array of strings)
- problemStatement (string)
- constraints (JSON array of strings)
- boilerplate (JSON object keyed by language: javascript/python/java)
- visibleTests (JSON array of { id, input, expected })
- hiddenTests (JSON array of { id, input, expected, tags })
- failureModes (JSON array of strings)
- hints (JSON array of strings)
- interviewerProbes (JSON array of strings)
- createdAt, updatedAt

SEED DATA
Seed exactly 1 high-quality question: “Longest Substring Without Repeating Characters”

Function signatures:
- JavaScript: function lengthOfLongestSubstring(s)
- Python: def lengthOfLongestSubstring(s):
- Java: public static int lengthOfLongestSubstring(String s)

Visible tests:
- v1: s="abcabcbb" → 3
- v2: s="bbbbb" → 1
- v3: s="pwwkew" → 3

Hidden tests (with tags, never shown to user):
- h1: s="" → 0 tags ["empty_input"]
- h2: s=" " → 1 tags ["whitespace"]
- h3: s="abba" → 2 tags ["window_reset_bug"]
- h4: s="tmmzuxt" → 5 tags ["last_seen_update_bug"]
- h5: s="dvdf" → 3 tags ["off_by_one"]

Hints (3 levels):
- Sliding window invariant
- Left pointer monotonicity
- Last-seen index tracking

Failure modes:
- Incorrect window reset
- Non-monotonic left pointer
- Incorrect last-seen updates
- O(n^2) substring scans

Interviewer probes:
- Walk through "abba"
- State the invariant
- Time/space complexity
- Why this is linear

BACKEND API REQUIREMENTS

1) GET /api/questions/random
- Returns a random question WITHOUT hiddenTests.
- Include: slug, title, difficulty, skillTargets, tags, problemStatement, constraints, boilerplate, visibleTests (optional).
- Random selection can be simple.

2) POST /api/run
Request:
{
  "questionSlug": string,
  "language": "javascript" | "python" | "java",
  "code": string
}

Behavior:
- Load Question by slug.
- Generate language-specific harness code.
- Embed visible + hidden tests inside the harness.
- Run via Judge0 (submit + poll).
- Parse stdout using sentinel markers.

HARNESS CONTRACT (ALL LANGUAGES)
Harness must print exactly ONE JSON report wrapped by sentinels:

===REPORT_START===
{ ...json... }
===REPORT_END===

JSON shape:
{
  "visible": {
    "passed": number,
    "total": number,
    "results": [
      { "id": "v1", "passed": true, "expected": 3, "got": 3 }
      OR { "id": "v2", "passed": false, "expected": 3, "got": 2, "error": "..." }
    ]
  },
  "hidden": {
    "passed": number,
    "total": number,
    "failedTags": string[],
    "signature": string
  }
}

Hidden signature rules (same across languages):
- runtime error → "runtime_error_hidden"
- window_reset_bug → "window_reset_bug"
- last_seen_update_bug → "last_seen_update_bug"
- off_by_one → "off_by_one"
- empty_input → "empty_input"
- else failedTags.length>0 → "logic_error"
- else "ok"

POST /api/run RESPONSE
Return to USER (frontend):
{
  "compileError": string | null,
  "runtimeError": string | null,
  "visible": { passed, total, results },
  "hiddenSummary": { passed, total, status }  // PASSED | FAILED
}

Do NOT return hiddenTags or hiddenSignature to the user.

Also construct (but do not send yet) an AGENT PAYLOAD object:
{
  questionSlug,
  attempt,            // incremented per run (can be passed from frontend)
  language,
  code,
  visibleResults,
  hidden: { failedTags, signature }
}

Leave a clear TODO comment where agent integration will happen.

JUDGE0 CLIENT
- Implement helper to submit + poll Judge0.
- Support RapidAPI headers if JUDGE0_API_KEY exists; otherwise self-hosted mode.
- Env vars:
  JUDGE0_BASE_URL
  JUDGE0_API_KEY (optional)

FRONTEND PAGE REQUIREMENTS

Create page: /technical-interview
- Load question via GET /api/questions/random
- Render problem statement + constraints
- Monaco Editor with language selector (JS / Python / Java)
- Load correct boilerplate per language
- Run button → POST /api/run
- Reset button resets editor to boilerplate
- Output panel:
  - Compile/runtime errors
  - Visible test table (id, pass/fail, expected, got, error)
  - Hidden summary line only: “Hidden tests: X/Y passed”

UI Layout:
- Left: problem + constraints
- Right: editor
- Bottom/right: run output

FILES TO CREATE / MODIFY
1) prisma/schema.prisma
2) prisma/seed.ts
3) src/lib/prisma.ts
4) src/lib/judge0.ts
5) src/lib/harness/javascript.ts
6) src/lib/harness/python.ts
7) src/lib/harness/java.ts
8) app/api/questions/random/route.ts
9) app/api/run/route.ts
10) app/technical-interview/page.tsx
11) Optional shared types in src/types/interview.ts

ACCEPTANCE CRITERIA
- All three languages compile and run correctly.
- Visible tests show detailed failures.
- Hidden tests never leak inputs/outputs.
- Sentinel-based parsing works even if user prints logs.
- No user code is ever executed locally (Judge0 only).
- Code is clean, minimal, and production-safe.

Now implement everything above exactly.
