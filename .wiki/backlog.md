# Mockly Backlog — Edge Cases & Quality

> Items deferred from 2026-07-15 eval review. Pick up after pipeline smoke test + feedback upgrade complete.

## Edge Cases

### EC-1: Empty CV / 0 years experience
- **Risk:** Fresh grad with no projects — does system handle gracefully?
- **Test:** Create session with minimal CV (name only, no experience)
- **Expected:** Prompt builder generates generic interview questions. Feedback notes "insufficient CV data to check alignment."

### EC-2: Very long CV (5+ pages, 20+ technologies)
- **Risk:** Research pack extraction exceeds context window
- **Test:** 8-page senior CV with 25+ technologies
- **Expected:** Research pack caps at 2 most relevant domains. Prompt builder does not exceed context.

### EC-3: Non-English names / companies
- **Risk:** Unicode handling in prompt builder and display
- **Test:** CV with Chinese company names, characters with accents, emoji in profile
- **Expected:** All Unicode preserved through pipeline. No mojibake in feedback display.

### EC-4: DeepSeek outage / 503
- **Risk:** Prompt builder or judge fails silently
- **Test:** Simulate 503 (mock or block network) during prompt generation
- **Expected:** Error propagated to frontend as retryable message. Session not orphaned.

### EC-5: ElevenLabs agent not provisioned
- **Risk:** Session created but agent doesn't exist
- **Test:** Call generate-feedback with non-existent agent_id
- **Expected:** 400/404 with clear error message.

### EC-6: Feedback generation in-flight collision
- **Risk:** Two calls to generate-feedback for same session
- **Expected:** Second call returns 202 "already in progress."

### EC-7: Session timeout / abandonment
- **Risk:** User starts session, never completes interview
- **Expected:** Stale session sweeper removes orphaned sessions after configurable timeout.

### EC-8: Large transcript
- **Risk:** 100+ turn interview produces transcript > DeepSeek context window
- **Test:** Generate 150-turn synthetic transcript
- **Expected:** Script truncates or summarizes transcript before feeding to feedback generator.

## Quality

### Q-1: no_praise hardening
- **Symptom:** Judge detects interviewer using "that's a great point" in 6/9 cases despite anti-praise rules
- **Fix:** Add explicit negative examples to prompt builder: *"NEVER say: great point, excellent answer, that's wonderful, I love that, fantastic"*
- **Re-eval:** Run all 9 cases after fix

### Q-2: Oversold V2 sim-user scripts
- **Symptom:** `faang-senior-dist-oversold` gap_visible fails — sim-user too competent
- **Fix:** Tighten under_probing scripts to match startup-senior-ai-oversold escalation pattern (vague → deflect → admit)
- **Re-eval:** Re-run faang-senior-dist-oversold after fix

### Q-3: Inter-rater reliability
- **Symptom:** Unknown how stable judge scores are across repeated runs
- **Test:** Run same case 3× with identical config, check score variance
- **Gate:** Stddev per dimension < 1.0, overall score within ±5 points

### Q-4: Audio mode end-to-end
- **Symptom:** All tests are text-only. Voice quality, latency, STT/TTS accuracy untested.
- **Test:** One real audio conversation through full pipeline
- **Metrics:** Latency (agent response time), STT accuracy (compare transcript to known text), TTS naturalness

### Q-5: Concurrent sessions
- **Symptom:** No load testing or multi-session race conditions
- **Test:** 5 simultaneous sessions with different CVs
- **Expected:** No session data leakage between users. No DB deadlocks.

### Q-6: Mobile responsiveness
- **Symptom:** ResultsPage components not tested on mobile viewports
- **Test:** Playwright at 375×812 viewport for all component types
- **Expected:** No horizontal scroll, all text readable, cards stack properly

### Q-7: Backend feedback prompt upgrade
- **Symptom:** Backend still uses old dimension-based evaluation format
- **Fix:** Replace n8n feedback workflow prompt with coaching template from `feedback-eval/feedback-prompt.md`
- **Test:** Smoke test after upgrade verifies coaching fields present

### Q-8: Feedback storage migration
- **Risk:** Existing sessions with old-format feedback break after upgrade
- **Fix:** Backward-compatible parsing: if new fields absent, show legacy view. If present, show coaching view.
