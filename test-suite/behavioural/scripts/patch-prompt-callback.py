#!/usr/bin/env python3
"""
Patch the n8n 'Prompt' workflow (q3GjRn4-cS3GmCwpLEtNP):
make the 'Callback to backend' node accept an optional callback_url
from the incoming webhook payload — absent = production default, present = test override.

Backs up the current live workflow to ../n8n-backups/ before patching.
Usage: python patch-prompt-callback.py
"""
import json, re, sys, urllib.request, urllib.error, datetime, pathlib

HERE = pathlib.Path(__file__).resolve()
REPO = HERE.parents[3]
WF_ID = "q3GjRn4-cS3GmCwpLEtNP"
BASE = f"http://localhost:5678/api/v1/workflows/{WF_ID}"
BACKUP_DIR = HERE.parent.parent / "n8n-backups"

env = (REPO / ".env").read_text(encoding="utf-8")
m = re.search(r"N8N_API\s*=\s*(\S+)", env)
if not m:
    sys.exit("N8N_API not found in .env")
KEY = m.group(1)

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

# --- backup ---
stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
backup_path = BACKUP_DIR / f"prompt-{WF_ID}-{stamp}.json"
backup_path.write_text(json.dumps(wf, indent=2), encoding="utf-8")
print("backed up ->", backup_path.name)

# --- patch the Callback to backend node ---
cb = next(n for n in wf["nodes"] if n["name"] == "Callback to backend")
old_url = cb["parameters"]["url"]

NEW_URL = "={{ $('Webhook').first().json.body.callback_url || 'http://host.docker.internal:3000/api/interview/session/' + $('Webhook').first().json.body.session_id + '/callback' }}"

if "callback_url" in old_url:
    print("Callback already patched, skipping")
else:
    cb["parameters"]["url"] = NEW_URL
    print("Callback URL patched:")
    print(f"  old: {old_url}")
    print(f"  new: {NEW_URL}")

# --- PUT back (only writable fields) ---
writable = {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": {
        "executionOrder": wf.get("settings", {}).get("executionOrder", "v1"),
        "callerPolicy": wf.get("settings", {}).get("callerPolicy", "workflowsFromSameOwner"),
    },
    "staticData": wf.get("staticData", None),
}
req("PUT", BASE, writable)
print("Workflow updated. Activating...")

# re-activate
req("POST", f"{BASE}/activate", {"active": True})
print("Activated.")
