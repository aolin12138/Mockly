# QA Surface Audit Pattern

> Load when: auditing a codebase for gaps, designing smoke tests, or thinking like a QA engineer.

## The Surface Audit Method

Every system boundary is a potential failure point. Audit by tracing every path a request takes:

```
User action → Frontend → API → Backend → External service → Backend → DB → Frontend → User sees
```

For each arrow, ask: "What if this fails? What does the user see?"

## The Failure Surface Checklist

### 1. Auth boundary
- [ ] Token expired → 401 → redirect to login?
- [ ] Token missing → 401 → graceful?
- [ ] Wrong permissions → 403 → clear message?
- [ ] CSRF/CORS misconfigured → 403/blocked → diagnostic?

### 2. Session lifecycle
- [ ] Create session with empty CV → handled?
- [ ] Create session with huge CV → context window? truncation?
- [ ] Session never started (user closed tab) → cleanup?
- [ ] Session abandoned mid-interview → status? deletion?
- [ ] Session completed normally → feedback generated?
- [ ] Revisit session from history → cached or re-fetched?

### 3. External service failures
- [ ] DeepSeek 503 → retryable error? user message?
- [ ] DeepSeek bad JSON → degraded output? "try again"?
- [ ] ElevenLabs agent not found → clear error?
- [ ] ElevenLabs transcript fetch fails → retry? fallback?
- [ ] n8n webhook timeout → retry? stale session cleanup?
- [ ] Tavily search fails → prompt generated without research?

### 4. Data integrity
- [ ] Feedback stored as JSON → parseable every time?
- [ ] Schema change (new field added) → old sessions break?
- [ ] Large transcript → DB size limit?
- [ ] Concurrent feedback generation → collision handling?

### 5. Frontend states
- [ ] Loading state → spinner/skeleton while waiting?
- [ ] Empty state → "no sessions yet" message?
- [ ] Error state → retry button? back to dashboard?
- [ ] Partial data → some sections missing → renders what it can?
- [ ] Browser back/forward → state consistency?
- [ ] Mobile viewport → all components readable?

## How to Use in a Smoke Test

For each scenario, define:

```js
{
  scenario: "Dashboard → old session with feedback",
  setup: "Create session, generate feedback, store in DB",
  action: "GET /session/:id → renders ResultsPage",
  expect: {
    feedbackLoadedImmediately: true,
    noGenerateFeedbackCalled: true,  // cached path
    allSectionsRendered: true
  }
}
```

## Real Example: Our Missing Smoke Scenarios

| # | Scenario | Current status |
|---|---|---|
| 1 | New session → interview → feedback → results page | ✅ Tested |
| 2 | Reopen old session from dashboard | ❌ Not tested |
| 3 | Open incomplete session (status=incomplete) | ❌ Not tested |
| 4 | Session where transcript fetch failed | ❌ Not tested |
| 5 | Session where DeepSeek returned error | ❌ Not tested |
| 6 | Dashboard with 10+ sessions (pagination) | ❌ Not tested |
| 7 | Multiple users, no session leakage | ❌ Not tested |

## Audit Output

After audit, produce:
1. **Risk matrix** — scenarios × impact × likelihood
2. **Test plan** — which harness tests each scenario
3. **Gap list** — scenarios with no coverage yet
