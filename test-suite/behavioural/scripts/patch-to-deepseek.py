#!/usr/bin/env python3
"""
Patch the Prompt workflow (q3GjRn4cS3GmCwpLEtNP):
replace the two OpenAI LLM nodes with HTTP Request nodes that call DeepSeek's API directly.
Backs up before patching.
Usage: python patch-to-deepseek.py
"""
import json, re, sys, urllib.request, urllib.error, datetime, pathlib

HERE = pathlib.Path(__file__).resolve()
REPO = HERE.parents[3]
WF_ID = "q3GjRn4-cS3GmCwpLEtNP"
BASE = f"http://localhost:5678/api/v1/workflows/{WF_ID}"
BACKUP_DIR = HERE.parent.parent / "n8n-backups"

env = (REPO / ".env").read_text(encoding="utf-8")
m = re.search(r"N8N_API\s*=\s*(\S+)", env)
m2 = re.search(r"DEEPSEEK_API_KEY\s*=\s*(\S+)", env)
if not m or not m2:
    sys.exit("N8N_API or DEEPSEEK_API_KEY not found")
KEY = m.group(1)
DS_KEY = m2.group(1)

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, headers={
        "X-N8N-API-KEY": KEY, "Content-Type": "application/json"})
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data=data) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode() if e.fp else ''
        print(f"HTTP {e.code}: {body_err[:500]}")
        raise

wf = req("GET", BASE)

# Backup
stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
backup_path = BACKUP_DIR / f"prompt-{WF_ID}-ds-{stamp}.json"
backup_path.write_text(json.dumps(wf, indent=2), encoding="utf-8")
print("Backed up ->", backup_path.name)

# Build HTTP Request node that calls DeepSeek
def make_deepseek_node(name, system_msg_template, user_msg_template, position):
    return {
        "parameters": {
            "method": "POST",
            "url": "https://api.deepseek.com/v1/chat/completions",
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "Authorization", "value": f"Bearer {DS_KEY}"},
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": json.dumps({
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_msg_template},
                    {"role": "user", "content": user_msg_template}
                ],
                "temperature": 0.3,
                "max_tokens": 8192
            }),
            "options": {}
        },
        "id": f"ds-{name.lower().replace(' ','-')}-{stamp}",
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": position
    }

# Find existing nodes to replace
old_models = [n for n in wf["nodes"] if "openAi" in n["type"]]
if not old_models:
    print("No OpenAI nodes found — already patched?")
    sys.exit(0)

# Replace Interview prompt builder
intv = old_models[0]
intv_resp = intv["parameters"]["responses"]["values"]
sys_msg = intv_resp[0].get("content", "")
user_msg = intv_resp[1].get("content", "") if len(intv_resp) > 1 else ""

new_intv = make_deepseek_node("Interview prompt builder (DS)", sys_msg, user_msg, intv["position"])
new_fb = None

if len(old_models) > 1:
    fb = old_models[1]
    fb_resp = fb["parameters"]["responses"]["values"]
    fb_sys = fb_resp[0].get("content", "")
    fb_user = fb_resp[1].get("content", "") if len(fb_resp) > 1 else ""
    new_fb = make_deepseek_node("Feedback prompt builder (DS)", fb_sys, fb_user, fb["position"])

# Replace nodes in array
idx_intv = wf["nodes"].index(intv)
wf["nodes"][idx_intv] = new_intv
if new_fb:
    idx_fb = wf["nodes"].index(fb)
    wf["nodes"][idx_fb] = new_fb

# Replace in connections
old_ids = {n["id"] for n in old_models}
new_id_map = {intv["id"]: new_intv["id"]}
if new_fb:
    new_id_map[fb["id"]] = new_fb["id"]

for src, outs in wf["connections"].items():
    if src in old_ids:
        new_src = new_id_map.get(src)
        if new_src:
            wf["connections"][new_src] = wf["connections"].pop(src)
    for branch in outs.get("main", []):
        for t in branch:
            if t["node"] in old_ids:
                t["node"] = new_id_map.get(t["node"], t["node"])

print(f"Replaced OpenAI nodes. New IDs: {list(new_id_map.values())}")

# PUT back
writable = {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": {"executionOrder": wf.get("settings", {}).get("executionOrder", "v1"),
                  "callerPolicy": wf.get("settings", {}).get("callerPolicy", "workflowsFromSameOwner")},
    "staticData": wf.get("staticData", None),
}
req("PUT", BASE, writable)
print("Workflow updated. Activating...")
req("POST", f"{BASE}/activate", {"active": True})
print("Activated.")
