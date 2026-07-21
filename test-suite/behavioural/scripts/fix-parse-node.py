#!/usr/bin/env python3
"""Fix the Parse json into final prompt node to handle chainLlm v1.9 output format."""

import json, urllib.request, pathlib, re, http.server, threading, time

env = pathlib.Path('.env').read_text(encoding='utf-8')
key = re.search(r'N8N_API\s*=\s*(\S+)', env).group(1)
WF_ID = 'q3GjRn4-cS3GmCwpLEtNP'
BASE = f'http://localhost:5678/api/v1/workflows/{WF_ID}'

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json'})
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(r, data=data) as resp:
        return json.loads(resp.read().decode())

wf = req('GET', BASE)

for n in wf['nodes']:
    if n['name'] == 'Parse json into final prompt':
        old_code = n['parameters']['jsCode']

        # Fix pickPromptText
        old_pick = (
            'function pickPromptText(item) {\n'
            '  // Fallback pattern you used earlier: item.json.output[0].content[0].text\n'
            '  return item?.json?.output?.[0]?.content?.[0]?.text ?? null;\n'
            '}'
        )
        new_pick = (
            'function pickPromptText(item) {\n'
            '  // chainLlm v1.9 define mode: { text: "response" }\n'
            "  if (typeof item?.json?.text === 'string') return item.json.text;\n"
            '  // chainLlm v1.9 with StringOutputParser: output is a string\n'
            "  if (typeof item?.json?.output === 'string') return item.json.output;\n"
            '  // Old format: item.json.output[0].content[0].text\n'
            '  return item?.json?.output?.[0]?.content?.[0]?.text ?? null;\n'
            '}'
        )
        new_code = old_code.replace(old_pick, new_pick)

        # Fix extraction logic
        old_extract = (
            'const firstItem = $input.first();\n'
            'const lastItem  = $input.last();\n'
            '\n'
            'let interviewPrompt = "";\n'
            'let feedbackPromptRaw = "";\n'
            'let firstMessage = "";\n'
            '\n'
            '// 1) Try direct shape: item.json.content.interview_system_prompt / feedback_system_prompt\n'
            'const directContent = firstItem?.json?.content ?? firstItem?.json ?? {};\n'
            'if (directContent.interview_system_prompt || directContent.feedback_system_prompt) {\n'
            '  interviewPrompt = directContent.interview_system_prompt ?? "";\n'
            '  feedbackPromptRaw = directContent.feedback_system_prompt ?? "";\n'
            '  firstMessage = directContent.first_message ?? "";\n'
            '} else {\n'
            '  // 2) Fallback to your previous extraction from model output items\n'
            '  const firstText = pickPromptText(firstItem);\n'
            '  if (firstText) {\n'
            '    const parsed = safeParseJSON(firstText) ?? {};\n'
            "    interviewPrompt = parsed.interview_system_prompt ?? '';\n"
            "    feedbackPromptRaw = parsed.feedback_system_prompt ?? '';\n"
            "    firstMessage = parsed.first_message ?? '';\n"
            '  }\n'
            '  const lastText = pickPromptText(lastItem);\n'
            '  if (lastText) {\n'
            '    const parsed = safeParseJSON(lastText) ?? {};\n'
            "    if (!feedbackPromptRaw) feedbackPromptRaw = parsed.feedback_system_prompt ?? '';\n"
            "    if (!firstMessage) firstMessage = parsed.first_message ?? '';\n"
            "    if (!interviewPrompt) interviewPrompt = parsed.interview_system_prompt ?? '';\n"
            '  }\n'
            '}'
        )

        new_extract = (
            'const firstItem = $input.first();\n'
            'const lastItem  = $input.last();\n'
            '\n'
            'let interviewPrompt = "";\n'
            'let feedbackPromptRaw = "";\n'
            'let firstMessage = "";\n'
            '\n'
            '// Helper: try to parse text as JSON (may have markdown fences)\n'
            'function tryExtract(text) {\n'
            '  if (!text) return {};\n'
            '  const parsed = safeParseJSON(text);\n'
            '  if (parsed) return parsed;\n'
            '  return {};\n'
            '}\n'
            '\n'
            '// Extract text from both items (chainLlm v1.9 format: {text: "..."})\n'
            'const firstText = pickPromptText(firstItem);\n'
            'const lastText = pickPromptText(lastItem);\n'
            '\n'
            '// Try both items - one is interview prompt, other is feedback prompt\n'
            'const firstParsed = tryExtract(firstText);\n'
            'const lastParsed = tryExtract(lastText);\n'
            '\n'
            '// Detect which is which: feedback prompt contains evaluation language\n'
            'if (firstParsed.system_prompt && lastParsed.system_prompt) {\n'
            '  // Both have system_prompt - detect by content\n'
            '  const firstLooksFeedback = /evaluat|scor|rubric|dimension|assessment/i.test(\n'
            '    (firstParsed.system_prompt ?? "").substring(0, 300)\n'
            '  );\n'
            '  if (firstLooksFeedback) {\n'
            '    feedbackPromptRaw = firstParsed.system_prompt;\n'
            '    interviewPrompt = lastParsed.system_prompt ?? "";\n'
            '    firstMessage = lastParsed.first_message ?? "";\n'
            '  } else {\n'
            '    interviewPrompt = firstParsed.system_prompt;\n'
            '    feedbackPromptRaw = lastParsed.system_prompt ?? "";\n'
            '    firstMessage = firstParsed.first_message ?? "";\n'
            '  }\n'
            '} else if (firstParsed.system_prompt) {\n'
            '  // Only first has system_prompt - check if it looks like feedback\n'
            '  const looksFeedback = /evaluat|scor|rubric|dimension|assessment/i.test(\n'
            '    (firstParsed.system_prompt ?? "").substring(0, 300)\n'
            '  );\n'
            '  if (looksFeedback) {\n'
            '    feedbackPromptRaw = firstParsed.system_prompt;\n'
            '  } else {\n'
            '    interviewPrompt = firstParsed.system_prompt;\n'
            '    firstMessage = firstParsed.first_message ?? "";\n'
            '  }\n'
            '} else if (lastParsed.system_prompt) {\n'
            '  interviewPrompt = lastParsed.system_prompt;\n'
            '  firstMessage = lastParsed.first_message ?? "";\n'
            '}\n'
            '\n'
            '// Fallback: direct content shape (old format)\n'
            'if (!interviewPrompt) {\n'
            '  const dc = firstItem?.json?.content ?? firstItem?.json ?? {};\n'
            '  interviewPrompt = dc.interview_system_prompt ?? "";\n'
            '  feedbackPromptRaw = feedbackPromptRaw || (dc.feedback_system_prompt ?? "");\n'
            '  firstMessage = firstMessage || (dc.first_message ?? "");\n'
            '}'
        )

        new_code = new_code.replace(old_extract, new_extract)
        n['parameters']['jsCode'] = new_code
        print(f'Parse node updated ({len(old_code)} -> {len(new_code)} chars)')
        break

writable = {
    'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1'),
                  'callerPolicy': wf.get('settings', {}).get('callerPolicy', 'workflowsFromSameOwner')},
    'staticData': wf.get('staticData', None),
}

req('PUT', BASE, writable)
req('POST', f'{BASE}/activate', {'active': True})
print('PUT OK! Testing...')

received = []
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        l = int(self.headers.get('Content-Length',0))
        received.append(json.loads(self.rfile.read(l)))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self,*a): pass

s = http.server.HTTPServer(('0.0.0.0', 9896), H)
threading.Thread(target=s.serve_forever, daemon=True).start()

cp = json.load(open('Mockly/presets.company_profile.json','rb'))
rr = json.load(open('Mockly/presets.role_rubric.json','rb'))
payload = {
    'session_id': 'ds-fix2', 'callback_url': 'http://host.docker.internal:9896/cb',
    'session': {'mode':'practice','duration_min':30},
    'candidate': {'cv_raw_text': 'Test CV', 'cv_available': True, 'cv_structured': None},
    'role': {'title':'SWE','seniority':'mid','stage':'behavioral','company_preset':'faang','context':'Test'},
    'interview': {'mode':'behavioral'},
    'company_profile': cp['faang'], 'role_rubric': rr['behavioral_mid'],
}

r = urllib.request.Request('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7',
    method='POST', headers={'Content-Type':'application/json'}, data=json.dumps(payload).encode())
try:
    urllib.request.urlopen(r)
    print('Webhook: 200')
except urllib.error.HTTPError as e:
    print(f'Webhook: {e.code}')

for i in range(65):
    time.sleep(1)
    if received:
        cb = received[0]
        print(f'\nCALLBACK after {i+1}s! Prompt: {len(cb.get("interview_prompt",""))} chars')
        break
    if i % 10 == 9:
        print(f'  {i+1}s...')

s.shutdown()
if not received:
    print('No callback')
