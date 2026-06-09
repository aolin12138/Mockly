import json
import subprocess

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTY2ZWNmNy1iOTE4LTQ1OTMtYjdjNS1jNDdkN2MyMzRjM2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzgwODk1NTk4LCJleHAiOjE3ODM0ODMyMDB9.OCJqmslal5Sl0sV0lAegwM4oB7iNWHIp3SVhSQsMJA4"

FEEDBACK_SYSTEM_PROMPT = """You are a senior technical interviewer evaluating a coding interview. Analyze the candidate's performance and produce a structured JSON evaluation.

## What you'll receive:
1. Question info (title, difficulty, problem statement)
2. The candidate's final code and language
3. Test results (visible and hidden pass/fail counts)
4. Full interview transcript (alternating interviewer/candidate turns)

## Evaluation Dimensions (score each 1-10):
1. **problem_understanding**: Did they grasp the problem, constraints, and edge cases?
2. **solution_approach**: Was their approach sound and well-reasoned? Did they consider tradeoffs?
3. **code_quality**: Is the code clean, readable, well-structured? Proper naming, no dead code?
4. **testing_mindset**: Did they consider edge cases? Did they walk through examples?
5. **communication**: Did they explain their thinking clearly? Respond well to questions?
6. **efficiency_awareness**: Did they discuss or optimize for time/space complexity?

**overall_score** = round((sum of all 6 scores / 60) * 100)

## Code Review:
- Analyze correctness (does it solve the problem?)
- Analyze efficiency (time/space complexity)
- Code style observations
- Specific improvement suggestions

## Output Schema (valid JSON only, no markdown):
{
  "meta": {
    "question_title": "...",
    "difficulty": "...",
    "language": "...",
    "test_summary": "X/Y visible passed, A/B hidden passed"
  },
  "overall": {
    "score": 75,
    "summary": "2-3 sentence overall assessment",
    "verdict": "strong_pass|pass|borderline|needs_work"
  },
  "dimensions": [
    {"name": "problem_understanding", "score": 7, "comment": "..."},
    ...
  ],
  "strengths": ["2-4 specific strengths with quotes/evidence from transcript"],
  "improvements": ["2-4 specific areas with actionable advice"],
  "code_review": {
    "correctness": "...",
    "efficiency": "...",
    "style": "...",
    "suggestions": ["..."]
  },
  "transcript_highlights": {
    "best_moment": "quote or description from transcript",
    "key_question": "the most revealing question asked"
  }
}

Be specific. Reference actual moments from the transcript. If the transcript is unavailable, base analysis on code and test results alone. Output ONLY the JSON."""

# Build the workflow
workflow = {
    "name": "Technical feedback",
    "nodes": [
        # 1. Webhook
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "technical-feedback",
                "responseMode": "responseNode",
                "options": {}
            },
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2.1,
            "position": [-1200, 0],
            "id": "tf-webhook",
            "name": "Webhook",
            "webhookId": "technical-feedback"
        },
        # 2. Fetch conversation transcript from ElevenLabs
        {
            "parameters": {
                "method": "GET",
                "url": "=https://api.elevenlabs.io/v1/convai/conversations/{{ $json.body.conversation_id || $json.body.conversationId }}",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "xi-api-key",
                            "value": "={{ $json.body.elevenlabs_api_key || $json.body.elevenLabsApiKey }}"
                        }
                    ]
                },
                "options": {"timeout": 30000},
                "continueOnFail": True
            },
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.3,
            "position": [-960, 0],
            "id": "tf-fetch-conv",
            "name": "Fetch conversation"
        },
        # 3. Format the prompt with all data
        {
            "parameters": {
                "jsCode": """// Build the user message for the LLM
const webhook = $('Webhook').first().json.body;
const convData = $input.first().json;

// Extract transcript
const transcript = convData.transcript || [];
const transcriptText = Array.isArray(transcript)
  ? transcript.map(t => `${t.role || 'unknown'}: ${t.message || t.content || ''}`).join('\\n')
  : 'Transcript not available';

// Extract execution summary
const summary = webhook.execution_summary || webhook.executionSummary || {};
const results = summary.results || {};

const userMessage = `## Question
Title: ${summary.questionTitle || 'Unknown'}
Difficulty: ${summary.difficulty || 'Unknown'}

## Candidate's Code (${summary.language || 'unknown'})
\\`\\`\\`
${summary.code || 'No code submitted'}
\\`\\`\\`

## Test Results
Visible tests: ${results.visibleTests?.passed || 0}/${results.visibleTests?.total || 0} passed
Hidden tests: ${results.hiddenTests?.passed || 0}/${results.hiddenTests?.total || 0} passed

## Interview Transcript
${transcriptText}`;

return [{
  json: {
    userMessage,
    executionSummary: summary
  }
}];
"""
            },
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [-720, 0],
            "id": "tf-format",
            "name": "Format feedback prompt"
        },
        # 4. OpenAI node - generate feedback
        {
            "parameters": {
                "resource": "chat",
                "model": "gpt-4o-mini",
                "options": {
                    "temperature": 0.3,
                    "maxTokens": 3000
                },
                "messages": {
                    "values": [
                        {
                            "role": "system",
                            "content": FEEDBACK_SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": "={{ $json.userMessage }}"
                        }
                    ]
                }
            },
            "type": "@n8n/n8n-nodes-langchain.openAi",
            "typeVersion": 1.6,
            "position": [-480, 0],
            "id": "tf-openai",
            "name": "Generate feedback",
            "credentials": {
                "openAiApi": {
                    "id": "8HOYmotXQKJmEGAV",
                    "name": "OpenAi account 2"
                }
            }
        },
        # 5. Parse and return
        {
            "parameters": {
                "respondWith": "json",
                "responseBody": "={{ $json.message?.content || $json }}",
                "options": {}
            },
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.5,
            "position": [-240, 0],
            "id": "tf-respond",
            "name": "Respond to Webhook"
        }
    ],
    "connections": {
        "Webhook": {
            "main": [[{"node": "Fetch conversation", "type": "main", "index": 0}]]
        },
        "Fetch conversation": {
            "main": [[{"node": "Format feedback prompt", "type": "main", "index": 0}]]
        },
        "Format feedback prompt": {
            "main": [[{"node": "Generate feedback", "type": "main", "index": 0}]]
        },
        "Generate feedback": {
            "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
        }
    },
    "settings": {
        "executionOrder": "v1",
        "availableInMCP": False
    }
}

# Save and deploy
with open('tech_feedback_workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print("Deploying to n8n...")
result = subprocess.run([
    'curl', '-s', '-X', 'PUT',
    'http://localhost:5678/api/v1/workflows/Ch73GgutkAude4Y7',
    '-H', f'X-N8N-API-KEY: {N8N_KEY}',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps(workflow)
], capture_output=True, text=True)

resp = json.loads(result.stdout)
if 'id' in resp:
    print(f'Updated: {resp["id"]}')
elif 'message' in resp:
    print(f'Error: {resp["message"]}')
    # Try creating new
    result2 = subprocess.run([
        'curl', '-s', '-X', 'POST',
        'http://localhost:5678/api/v1/workflows',
        '-H', f'X-N8N-API-KEY: {N8N_KEY}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(workflow)
    ], capture_output=True, text=True)
    resp2 = json.loads(result2.stdout)
    if 'id' in resp2:
        print(f'Created new: {resp2["id"]}')
    else:
        print(f'Create error: {result2.stdout[:300]}')
else:
    print(f'Raw: {result.stdout[:300]}')
