#!/usr/bin/env python3
"""Replace all OpenAI nodes with DeepSeek (Basic LLM Chain + Chat DeepSeek Model) across all workflows."""
import re, pathlib, json, urllib.request, uuid

env = pathlib.Path('.env').read_text(encoding='utf-8')
key = re.search(r'N8N_API\s*=\s*(\S+)', env).group(1)
headers = {'X-N8N-API-KEY': key, 'Content-Type': 'application/json'}
N8N = 'http://localhost:5678'

# Get current DeepSeek credential ID
r = urllib.request.Request(f'{N8N}/api/v1/workflows/BVR6c7N1sYoPiTrp', headers=headers)
prompt_wf = json.loads(urllib.request.urlopen(r).read())
ds_cred = None
for n in prompt_wf['nodes']:
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatDeepSeek':
        ds_cred = dict(n['credentials'])
        break
if not ds_cred:
    print('ERROR: No DeepSeek model found in Prompt workflow')
    exit(1)
print(f'DeepSeek credential: {json.dumps(ds_cred)}')

def extract_openai_messages(node):
    """Extract system message and user message from an OpenAI node's responses"""
    responses = node.get('parameters', {}).get('responses', {}).get('values', [])
    system_msg = ''
    user_msg = ''
    for rv in responses:
        role = rv.get('role', 'user')
        content = rv.get('content', '')
        if role == 'system' or (not system_msg and content and len(content) > 200):
            system_msg = content
        elif role != 'system':
            if user_msg:
                user_msg = content  # last non-system wins
            else:
                user_msg = content
    if not user_msg:
        # No explicit user message, use a default
        user_msg = '={{ $json.chatInput }}'
    return system_msg, user_msg

# Process all workflows
r = urllib.request.Request(f'{N8N}/api/v1/workflows', headers=headers)
data = json.loads(urllib.request.urlopen(r).read())
wfs = data if isinstance(data, list) else data.get('data', [])

for wf_summary in wfs:
    wf_id = wf_summary['id']
    r2 = urllib.request.Request(f'{N8N}/api/v1/workflows/{wf_id}', headers=headers)
    wf = json.loads(urllib.request.urlopen(r2).read())
    
    openai_nodes = [(i, n) for i, n in enumerate(wf['nodes']) if n['type'] == '@n8n/n8n-nodes-langchain.openAi']
    if not openai_nodes:
        continue
    
    print(f'\n=== {wf_summary["name"]} ({wf_id}) ===')
    
    modified = False
    for idx, node in openai_nodes:
        node_name = node['name']
        system_msg, user_msg = extract_openai_messages(node)
        
        print(f'  {node_name}: sys={len(system_msg)} chars, user=\"{user_msg[:60]}\"')
        
        # Create chain node
        new_chain = {
            'parameters': {
                'promptType': 'define',
                'text': user_msg,
                'messages': {
                    'messageValues': [{
                        'type': 'SystemMessagePromptTemplate',
                        'message': system_msg
                    }]
                },
                'options': {}
            },
            'id': node['id'],
            'name': node_name + ' (DeepSeek)',
            'type': '@n8n/n8n-nodes-langchain.chainLlm',
            'typeVersion': 1.9,
            'position': node['position']
        }
        
        # Create model node
        model_id = str(uuid.uuid4())
        new_model = {
            'parameters': {
                'model': 'deepseek-chat',
                'options': {}
            },
            'id': model_id,
            'name': f'DeepSeek Chat ({node_name})',
            'type': '@n8n/n8n-nodes-langchain.lmChatDeepSeek',
            'typeVersion': 1,
            'position': [node['position'][0] + 40, node['position'][1] + 80],
            'credentials': dict(ds_cred)
        }
        
        # Replace node in list
        wf['nodes'][idx] = new_chain
        wf['nodes'].append(new_model)
        
        # Update connections: model -> chain via ai_languageModel
        wf['connections'][new_model['name']] = {
            'ai_languageModel': [[
                {'node': new_chain['name'], 'type': 'ai_languageModel', 'index': 0}
            ]]
        }
        
        modified = True
    
    if modified:
        writable = {
            'name': wf['name'],
            'nodes': wf['nodes'],
            'connections': wf['connections'],
            'settings': {
                'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1'),
                'callerPolicy': wf.get('settings', {}).get('callerPolicy', 'workflowsFromSameOwner')
            },
            'staticData': wf.get('staticData', None),
        }
        
        r3 = urllib.request.Request(f'{N8N}/api/v1/workflows/{wf_id}',
            method='PUT', headers=headers, data=json.dumps(writable).encode())
        try:
            urllib.request.urlopen(r3)
            # Activate
            try:
                urllib.request.urlopen(urllib.request.Request(f'{N8N}/api/v1/workflows/{wf_id}/activate',
                    method='POST', headers=headers, data=json.dumps({}).encode()))
            except: pass
            print(f'  -> Saved + activated')
        except urllib.error.HTTPError as e:
            print(f'  -> FAILED ({e.code}): {e.read().decode()[:300]}')

print('\nDone!')
