#!/usr/bin/env python3
"""
Import all recovered workflows into the new n8n instance.
Usage: Set N8N_API_KEY env var or paste key below, then run:
  python recover-workflows.py
"""
import json, urllib.request, pathlib, sys

N8N_URL = "http://localhost:5678"
API_KEY = ""  # <-- PASTE YOUR NEW API KEY HERE

recovered_dir = pathlib.Path("C:/Users/User/AppData/Local/Temp/recovered-workflows")

for fpath in sorted(recovered_dir.glob("*.json")):
    wf = json.loads(fpath.read_text(encoding='utf-8'))
    wf_name = wf['name']
    
    # Build create payload
    body = {
        'name': wf_name,
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
        'active': False,  # Don't auto-activate
    }
    
    r = urllib.request.Request(f'{N8N_URL}/api/v1/workflows',
        method='POST',
        headers={'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'},
        data=json.dumps(body).encode())
    
    try:
        resp = urllib.request.urlopen(r)
        result = json.loads(resp.read())
        new_id = result.get('id', '?')
        print(f'✓ Imported: {wf_name} ({new_id})')
        
        # Activate if was active before
        if wf.get('active'):
            urllib.request.urlopen(
                urllib.request.Request(f'{N8N_URL}/api/v1/workflows/{new_id}/activate',
                    method='POST',
                    headers={'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'},
                    data=json.dumps({}).encode())
            )
            print(f'  Activated')
    except urllib.error.HTTPError as e:
        print(f'✗ {wf_name}: {e.code} - {e.read().decode()[:200]}')

print("\nDone! Now create DeepSeek credential in n8n UI (Credentials → Add → DeepSeek)")
