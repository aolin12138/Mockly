#!/usr/bin/env python3
"""Replace Prompt workflow OpenAI nodes with Code nodes calling DeepSeek."""
import json, urllib.request, re, pathlib, http.server, threading, time

env = pathlib.Path('.env').read_text(encoding='utf-8')
key = re.search(r'N8N_API\s*=\s*(\S+)', env).group(1)
ds_key = re.search(r'DEEPSEEK_API_KEY\s*=\s*(\S+)', env).group(1)
WF_ID = 'q3GjRn4-cS3GmCwpLEtNP'
BASE = f'http://localhost:5678/api/v1/workflows/{WF_ID}'

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json'})
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(r, data=data) as resp:
        return json.loads(resp.read().decode())

# Read system messages
sys_intv = pathlib.Path('test-suite/behavioural/n8n-backups/Interview_prompt_builder_sys.txt').read_text(encoding='utf-8')
sys_fb = pathlib.Path('test-suite/behavioural/n8n-backups/Feedback_prompt_builder_sys.txt').read_text(encoding='utf-8')

# JavaScript code templates (use %s for system message and %s for API key)
JS_TEMPLATE = '''// DeepSeek LLM Call
const systemMsg = %s;
const promptSpec = $input.first().json.prompt_spec || $input.first().json;

const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer %s', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: JSON.stringify({ prompt_spec: promptSpec }) }
    ],
    temperature: 0.3,
    max_tokens: 8192,
    response_format: { type: 'json_object' }
  })
});
const data = await resp.json();
const content = data.choices[0].message.content;
return [{ json: { output: [{ content: [{ text: content }] }] } }];
'''

code_intv = JS_TEMPLATE % (json.dumps(sys_intv), ds_key)
code_fb = JS_TEMPLATE % (json.dumps(sys_fb), ds_key)

# Restore clean workflow
backup = json.loads(pathlib.Path('test-suite/behavioural/n8n-backups/prompt-q3GjRn4-cS3GmCwpLEtNP-2026-07-07T16-03-44.json').read_text(encoding='utf-8'))

# Callback URL patch
cb = next(n for n in backup['nodes'] if n['name'] == 'Callback to backend')
cb['parameters']['url'] = "={{ $('Webhook').first().json.body.callback_url || 'http://host.docker.internal:3000/api/interview/session/' + $('Webhook').first().json.body.session_id + '/callback' }}"

# Replace OpenAI nodes with Code nodes
oi = next(n for n in backup['nodes'] if n['name'] == 'Interview prompt builder')
fb = next(n for n in backup['nodes'] if n['name'] == 'Feedback prompt builder')

for old, code, label in [(oi, code_intv, 'Interview'), (fb, code_fb, 'Feedback')]:
    new_node = {
        'parameters': {'jsCode': code},
        'id': old['id'],
        'name': f'{label} prompt builder (DeepSeek)',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': old['position']
    }
    idx = backup['nodes'].index(old)
    backup['nodes'][idx] = new_node
    print(f'Replaced: {old["name"]} -> Code node ({len(code)} chars)')

writable = {
    'name': backup['name'], 'nodes': backup['nodes'], 'connections': backup['connections'],
    'settings': {
        'executionOrder': backup.get('settings', {}).get('executionOrder', 'v1'),
        'callerPolicy': backup.get('settings', {}).get('callerPolicy', 'workflowsFromSameOwner')
    },
    'staticData': backup.get('staticData', None),
}

try:
    req('PUT', BASE, writable)
    req('POST', f'{BASE}/activate', {'active': True})
    print('PUT OK! Testing...')
    
    received = []
    class H(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            l = int(self.headers.get('Content-Length', 0))
            received.append(json.loads(self.rfile.read(l)))
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
        def log_message(self, *a): pass
    
    s = http.server.HTTPServer(('0.0.0.0', 9880), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    
    cp = json.load(open('Mockly/presets.company_profile.json', 'rb'))
    rr = json.load(open('Mockly/presets.role_rubric.json', 'rb'))
    
    payload = {
        'session_id': 'ds-final', 'callback_url': 'http://host.docker.internal:9880/cb',
        'session': {'mode': 'practice', 'duration_min': 30},
        'candidate': {'cv_raw_text': 'Test CV', 'cv_available': True, 'cv_structured': None},
        'role': {'title': 'SWE', 'seniority': 'mid', 'stage': 'behavioral', 'company_preset': 'faang', 'context': 'Test'},
        'interview': {'mode': 'behavioral'},
        'company_profile': cp['faang'], 'role_rubric': rr['behavioral_mid'],
    }
    
    r = urllib.request.Request('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7',
        method='POST', headers={'Content-Type': 'application/json'}, data=json.dumps(payload).encode())
    try:
        urllib.request.urlopen(r)
    except Exception as e:
        print(f'Webhook: {e}')
    
    for i in range(40):
        time.sleep(1)
        if received:
            cb_data = received[0]
            print(f'\n✅ CALLBACK after {i+1}s!')
            print(f'   Interview prompt: {len(cb_data.get("interview_prompt",""))} chars')
            print(f'   First message: "{cb_data.get("first_message","")[:100]}..."')
            break
        if i % 5 == 4:
            print(f'  {i+1}s...')
    
    s.shutdown()
    if not received:
        print('No callback after 40s')
        
except urllib.error.HTTPError as e:
    print(f'PUT failed ({e.code}): {e.read().decode()[:500]}')
