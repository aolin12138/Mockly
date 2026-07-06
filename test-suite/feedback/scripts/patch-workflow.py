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
print("verify system prompt:", "OK" if ok1 else "MISSING")
print("verify format prompt:", "OK" if ok2 else "MISSING")
print("verify test-totals fix:", "OK" if ok3 else "MISSING")
print("verify phase/example fix:", "OK" if ok4 else "MISSING")
sys.exit(0 if ok1 and ok2 and ok3 and ok4 else 1)
