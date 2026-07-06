#!/usr/bin/env python3
"""
One-off patch for the n8n "Technical feedback" workflow (pbjDnkI5TDO9bto5).

Fixes applied (see ../README.md "Known production gaps"):
 1. System prompt: hints_used MUST equal the number of entries in HINTS
    (harness caught the grader counting a failed-test disclosure as a hint),
    and no fabricated candidate quotes when TRANSCRIPT is not available.
 2. Format prompt node: derive per-test failures and by-category summary from
    results.visibleTests.details (what the backend actually sends) instead of
    the never-sent results.failures / results.by_category.

Backs up the current live workflow to ../../n8n-backups/ before patching.
Usage: python patch-workflow.py  (reads N8N_API from repo .env)
"""
import json, re, sys, urllib.request, datetime, pathlib

HERE = pathlib.Path(__file__).resolve()
REPO = HERE.parents[3]
WF_ID = "pbjDnkI5TDO9bto5"
BASE = "http://localhost:5678/api/v1/workflows/" + WF_ID
BACKUP_DIR = REPO / "test-suite" / "n8n-backups"

env = (REPO / ".env").read_text(encoding="utf-8")
m = re.search(r"N8N_API\s*=\s*(\S+)", env)
if not m:
    sys.exit("N8N_API not found in .env")
KEY = m.group(1)

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, headers={
        "X-N8N-API-KEY": KEY, "Content-Type": "application/json"})
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(r, data=data) as resp:
        return json.loads(resp.read().decode())

wf = req("GET", BASE)

# --- backup live version first ---
stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
backup_path = BACKUP_DIR / f"technical-feedback-{WF_ID}-{stamp}.json"
backup_path.write_text(json.dumps(wf, indent=2), encoding="utf-8")
print("backed up ->", backup_path.name)

nodes = wf["nodes"]
model = next(n for n in nodes if n["name"] == "Message a model")
fmt = next(n for n in nodes if n["name"] == "Format prompt")

# --- fix 1: system prompt ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
GROUND_RULE_ADD = (
    "\n- The HINTS list is the complete and authoritative hint record. In the Independence "
    "dimension, set hints_used to EXACTLY the number of entries in HINTS. Do NOT count other "
    "interviewer remarks (test-failure disclosures, follow-up questions, wrap-up prompts) as hints."
    "\n- If TRANSCRIPT is \"Not available\", do not invent or quote candidate statements. Grade "
    "communication-related dimensions only from the available facts and say the evidence was limited."
)
anchor = "- Make next_steps concrete: specific patterns, problem types, habits."
if GROUND_RULE_ADD.strip().splitlines()[0][2:20] in sysmsg:
    print("system prompt: already patched, skipping")
else:
    assert anchor in sysmsg, "anchor line not found in system prompt"
    sysmsg = sysmsg.replace(anchor, anchor + GROUND_RULE_ADD)
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg
    print("system prompt: patched (+2 ground rules)")

# --- fix 2: Format prompt failure derivation ---
js = fmt["parameters"]["jsCode"]
OLD_BYCAT = "'By category: ' + JSON.stringify(r.by_category || r.byCategory || {}),"
OLD_FAIL = "'Failures: ' + JSON.stringify(r.failures || []),"
DERIVE = (
    "// Derive per-test failures + category summary from visibleTests.details\n"
    "// (the backend sends details[], not by_category/failures).\n"
    "const details = Array.isArray(r.visibleTests?.details) ? r.visibleTests.details : [];\n"
    "const derivedFailures = details.filter(d => d && d.passed === false).map(d => ({\n"
    "  name: d.name, tags: d.tags || [], expected: d.expected, actual: d.actual, error: d.error || null\n"
    "}));\n"
    "const catCounts = {};\n"
    "for (const d of details) {\n"
    "  for (const tag of (Array.isArray(d.tags) && d.tags.length ? d.tags : ['uncategorized'])) {\n"
    "    catCounts[tag] = catCounts[tag] || { pass: 0, fail: 0 };\n"
    "    catCounts[tag][d.passed ? 'pass' : 'fail']++;\n"
    "  }\n"
    "}\n"
    "const derivedByCategory = {};\n"
    "for (const [tag, c] of Object.entries(catCounts)) {\n"
    "  derivedByCategory[tag] = c.fail === 0 ? 'pass' : c.fail + ' fail';\n"
    "}\n"
)
if "derivedFailures" in js:
    print("format prompt: already patched, skipping")
else:
    assert OLD_BYCAT in js and OLD_FAIL in js, "expected lines not found in Format prompt jsCode"
    js = js.replace(
        OLD_BYCAT,
        "'By category: ' + JSON.stringify(r.by_category || r.byCategory || derivedByCategory),")
    js = js.replace(
        OLD_FAIL,
        "'Failures: ' + JSON.stringify(r.failures || derivedFailures),")
    js = js.replace("const lines = [", DERIVE + "const lines = [")
    fmt["parameters"]["jsCode"] = js
    print("format prompt: patched (failures derived from visibleTests.details)")

# --- fix 3: precompute combined test totals (LLM arithmetic is unreliable —
# harness caught 5/6 + 3/4 reported as 9/10). Model must copy, not add. ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
TEST_RULE = (
    "\n- In test_results, set passed and total to EXACTLY the numbers on the "
    "'TOTAL TESTS PASSED' line. Do not recompute or re-add them yourself."
)
if "TOTAL TESTS PASSED' line" in sysmsg:
    print("system prompt (test totals): already patched, skipping")
else:
    anchor2 = "- Test results are FACTS. Trust them. Do not re-read code to re-judge."
    assert anchor2 in sysmsg, "test-facts anchor not found"
    sysmsg = sysmsg.replace(anchor2, anchor2 + TEST_RULE)
    print("system prompt: patched (test totals copy rule)")

# --- fix 4: facts lines are authoritative; example JSON values are placeholders
# (harness caught reached_phase copied from the example when transcript was absent) ---
PHASE_RULE = (
    "\n- Set reached_phase to EXACTLY the number on the PHASE line, completed from the "
    "COMPLETED line, and time from the TIME line. The values in the JSON example below "
    "are placeholders — NEVER copy them into your answer."
)
if "NEVER copy them into your answer" in sysmsg:
    print("system prompt (phase/example rule): already patched, skipping")
else:
    anchor3 = "'TOTAL TESTS PASSED' line. Do not recompute or re-add them yourself."
    assert anchor3 in sysmsg, "test-totals rule not found (fix 3 must be applied first)"
    sysmsg = sysmsg.replace(anchor3, anchor3 + PHASE_RULE)
    print("system prompt: patched (phase/example placeholder rule)")
model["parameters"]["responses"]["values"][0]["content"] = sysmsg

js = fmt["parameters"]["jsCode"]
OLD_VIS = "'Visible: ' + (r.visibleTests?.passed||0) + '/' + (r.visibleTests?.total||0),"
TOTAL_LINE = (
    "'TOTAL TESTS PASSED: ' + ((r.visibleTests?.passed||0) + (r.hiddenTests?.passed||0)) + '/' + "
    "((r.visibleTests?.total||0) + (r.hiddenTests?.total||0)),\n  "
)
if "TOTAL TESTS PASSED" in js:
    print("format prompt (total line): already patched, skipping")
else:
    assert OLD_VIS in js, "visible-tests line not found in Format prompt jsCode"
    js = js.replace(OLD_VIS, TOTAL_LINE + OLD_VIS)
    fmt["parameters"]["jsCode"] = js
    print("format prompt: patched (TOTAL TESTS PASSED line)")

# --- fix 5: answer key fields are JSON objects/arrays — string concatenation
# rendered them as "[object Object]", so the LLM never saw the actual answer key. ---
js = fmt["parameters"]["jsCode"]
OLD_SOL = "'ANSWER KEY - Solutions: ' + (q.solutions || 'N/A'),"
OLD_MIS = "'ANSWER KEY - Mistakes: ' + (q.commonMistakes || q.common_mistakes || 'N/A'),"
OLD_FU = "'ANSWER KEY - Follow-ups: ' + (q.followUps || q.follow_ups || 'N/A'),"
NEW_SOL = "'ANSWER KEY - Solutions: ' + (q.solutions ? JSON.stringify(q.solutions, null, 1) : 'N/A'),"
NEW_MIS = "'ANSWER KEY - Mistakes: ' + ((q.commonMistakes || q.common_mistakes) ? JSON.stringify(q.commonMistakes || q.common_mistakes) : 'N/A'),"
NEW_FU = "'ANSWER KEY - Follow-ups: ' + ((q.followUps || q.follow_ups) ? JSON.stringify(q.followUps || q.follow_ups) : 'N/A'),"
if "JSON.stringify(q.solutions" in js:
    print("format prompt (answer key stringify): already patched, skipping")
else:
    assert OLD_SOL in js and OLD_MIS in js and OLD_FU in js, "answer key lines not found"
    js = js.replace(OLD_SOL, NEW_SOL).replace(OLD_MIS, NEW_MIS).replace(OLD_FU, NEW_FU)
    fmt["parameters"]["jsCode"] = js
    print("format prompt: patched (answer key JSON.stringify)")

# --- fix 6: actively use the canonical solution to name the candidate's gap ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
GAP_RULE = (
    "\n- In code_assessment, explicitly contrast the candidate's final code with the canonical "
    "optimal solution in the ANSWER KEY: name the pattern or technique they missed and what the "
    "optimal approach achieves that theirs does not (time/space, robustness). In next_steps, "
    "reference that canonical approach by name so they know exactly what to study."
)
if "contrast the candidate's final code with the canonical" in sysmsg:
    print("system prompt (canonical gap rule): already patched, skipping")
else:
    anchor4 = "- Grade complexity claims against the ANSWER KEY."
    assert anchor4 in sysmsg, "complexity anchor not found"
    sysmsg = sysmsg.replace(anchor4, anchor4 + GAP_RULE)
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg
    print("system prompt: patched (canonical solution gap rule)")

# --- fix 7: Independence measures progress-without-help, not mere absence of
# hints (stability run: silent do-nothing candidates scored Independence 7-9) ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
INDEP_RULE = (
    "\n- Independence means PROGRESS ACHIEVED WITHOUT HELP, not merely the absence of hints. "
    "A candidate who made little or no progress cannot score high on Independence even with "
    "zero hints: if the outcome is not_solved with minimal working code, Independence must be "
    "5.0 or below."
)
if "PROGRESS ACHIEVED WITHOUT HELP" in sysmsg:
    print("system prompt (independence rule): already patched, skipping")
else:
    anchor5 = "- Distinguish solving alone from solving with help."
    assert anchor5 in sysmsg, "independence anchor not found"
    sysmsg = sysmsg.replace(anchor5, anchor5 + INDEP_RULE)
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg
    print("system prompt: patched (independence = progress without help)")

# --- fix 8: coaching completeness + hard ban on attributed speech without transcript ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
COACH_RULE = (
    "\n- Every dimension's what_to_improve must contain one concrete, specific suggestion — "
    "even for a 9-10 score give a stretch goal. Never write \"None\", \"N/A\", or leave it empty."
    "\n- When TRANSCRIPT is \"Not available\", never write phrases like 'you said', 'you mentioned', "
    "'you stated', 'you explained', or attribute ANY specific statement or behavior to the candidate; "
    "describe only what the code and facts show."
)
if "even for a 9-10 score give a stretch goal" in sysmsg:
    print("system prompt (coaching/attribution rules): already patched, skipping")
else:
    anchor6 = "- Make next_steps concrete: specific patterns, problem types, habits."
    assert anchor6 in sysmsg, "next_steps anchor not found"
    sysmsg = sysmsg.replace(anchor6, anchor6 + COACH_RULE)
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg
    print("system prompt: patched (coaching completeness + attribution ban)")

# --- fix 9: primary_focus — a single highest-leverage takeaway surfaced prominently
# (users act on one thing; six equal dimension cards is a report, not coaching) ---
sysmsg = model["parameters"]["responses"]["values"][0]["content"]
FOCUS_RULE = (
    "\n- Add a field \"primary_focus\" to the output JSON: a single-sentence, concrete, "
    "actionable takeaway that identifies the ONE highest-leverage thing the candidate "
    "should work on next. It must be backed by the strongest signal in the session "
    "(worst dimension, most impactful missed pattern vs canonical solution, or clearest "
    "repeated mistake). The sentence must start with an imperative verb — e.g. \"Master "
    "the hash-map lookup pattern before your next interview\", not \"You could improve "
    "hash maps\"."
)
if "primary_focus" in sysmsg and "imperative verb" in sysmsg:
    print("system prompt (primary_focus): already patched, skipping")
else:
    # Insert before the output schema example
    anchor7 = "# Output (valid JSON only, no markdown, no preamble):"
    assert anchor7 in sysmsg, "output schema anchor not found"
    sysmsg = sysmsg.replace(anchor7, FOCUS_RULE + "\n" + anchor7)
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg
    print("system prompt: patched (primary_focus field)")

# Also patch the schema example to include primary_focus at the top — AND make it
# explicitly non-optional
OLD_SCHEMA = '\n{\n  "summary"'
if '"primary_focus"' in sysmsg and 'ALWAYS include' in sysmsg:
    print("system prompt (primary_focus in schema): already patched, skipping")
else:
    REPLACEMENT = '\n{\n  "primary_focus": "Master the hash-map lookup pattern before your next interview.",' + OLD_SCHEMA
    if '"primary_focus"' in sysmsg:
        # Already has the field in schema; add a stronger requirement
        REQUIREMENT = "\n- ALWAYS include primary_focus in the output. If the session evidence is limited (e.g. very short transcript), use the strongest available signal — even imperfect guidance is better than an empty field. The sentence must start with an imperative verb regardless."
        anchor_r = "- Make next_steps concrete: specific patterns, problem types, habits."
        sysmsg = sysmsg.replace(anchor_r, REQUIREMENT + "\n" + anchor_r)
        print("system prompt: patched (primary_focus always-required rule)")
    else:
        sysmsg = sysmsg.replace(OLD_SCHEMA, REPLACEMENT)
        print("system prompt: patched (primary_focus in schema example)")
    model["parameters"]["responses"]["values"][0]["content"] = sysmsg

# --- fix 10: Parse & wrap fallback: if the model omits primary_focus, inject a
# placeholder so the page always has a headline (the user shouldn't see a broken
# page because of an LLM formatting quirk). ---
js2 = fmt["parameters"]["jsCode"] # reuse variable name; Format prompt is fmt, Parse is find
parse_node = next(n for n in nodes if n["name"] == "Parse & wrap")
parse_js = parse_node["parameters"]["jsCode"]
FALLBACK = "if (!fb.primary_focus) fb.primary_focus = 'Review the skill breakdown below for your highest-leverage area to improve.';"
OLD_PARSE_RETURN = "return [{json: { ...fb, transcript: fp.transcript || [], audio: fp.audio || null, callDurationSecs: fp.callDurationSecs || null }}];"
FALLBACK_RETURN = FALLBACK + "\n" + OLD_PARSE_RETURN
if "!fb.primary_focus" in parse_js:
    print("parse & wrap (primary_focus fallback): already patched, skipping")
else:
    old_return = OLD_PARSE_RETURN
    assert old_return in parse_js, "parse node return not found"
    parse_js = parse_js.replace(old_return, FALLBACK_RETURN)
    parse_node["parameters"]["jsCode"] = parse_js
    print("parse & wrap: patched (primary_focus fallback)")

# --- PUT back (only fields the API accepts) ---
payload = {k: wf[k] for k in ("name", "nodes", "connections", "settings") if k in wf}
updated = req("PUT", BASE, payload)
print("PUT ok, workflow version updated at:", updated.get("updatedAt"))

# --- verify by re-fetch ---
check = req("GET", BASE)
sys2 = next(n for n in check["nodes"] if n["name"] == "Message a model")["parameters"]["responses"]["values"][0]["content"]
js2 = next(n for n in check["nodes"] if n["name"] == "Format prompt")["parameters"]["jsCode"]
ok1 = "EXACTLY the number of entries in HINTS" in sys2
ok2 = "derivedFailures" in js2
ok3 = "TOTAL TESTS PASSED' line" in sys2 and "TOTAL TESTS PASSED" in js2
ok4 = "NEVER copy them into your answer" in sys2
ok5 = "JSON.stringify(q.solutions" in js2
ok6 = "contrast the candidate's final code with the canonical" in sys2
ok7 = "PROGRESS ACHIEVED WITHOUT HELP" in sys2
ok8 = "even for a 9-10 score give a stretch goal" in sys2
ok9 = '"primary_focus"' in sys2
parse_node2 = next(n for n in check["nodes"] if n["name"] == "Parse & wrap")
parse_node2_js = parse_node2["parameters"]["jsCode"]
ok10 = '!fb.primary_focus' in parse_node2_js
print("verify system prompt:", "OK" if ok1 else "MISSING")
print("verify format prompt:", "OK" if ok2 else "MISSING")
print("verify test-totals fix:", "OK" if ok3 else "MISSING")
print("verify phase/example fix:", "OK" if ok4 else "MISSING")
print("verify answer-key stringify:", "OK" if ok5 else "MISSING")
print("verify canonical gap rule:", "OK" if ok6 else "MISSING")
print("verify independence rule:", "OK" if ok7 else "MISSING")
print("verify coaching/attribution rules:", "OK" if ok8 else "MISSING")
print("verify primary_focus:", "OK" if ok9 else "MISSING")
print("verify primary_focus fallback:", "OK" if ok10 else "MISSING")
sys.exit(0 if ok1 and ok2 and ok3 and ok4 and ok5 and ok6 and ok7 and ok8 and ok9 and ok10 else 1)
