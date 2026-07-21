/**
 * Behavioural eval runner — two-stage:
 *   Stage 1: generate interviewer prompt via prompt-builder + checks
 *   Stage 2: PATCH ElevenLabs test agent, run live WS conversation, judge
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from './_env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const env = loadEnv();

// ── Config ──────────────────────────────────────────────────────────
const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const PROMPT_BUILDER_MD = join(REPO, 'Mockly', 'prompts', 'interview_prompt_builder.md');
const PRESETS_DIR = join(REPO, 'Mockly', 'presets');
const CV_DIR = join(HERE, 'fixtures', 'cvs');
const CASES_DIR = join(HERE, 'fixtures', 'cases');
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY;
const TEST_AGENT_ID = 'agent_7401kxffy3hmf2drqtptznj9j9cq';
const TEST_AGENT_API = `https://api.elevenlabs.io/v1/convai/agents/${TEST_AGENT_ID}`;

// ── Helpers ─────────────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

async function callLLM(systemMsg, userMsg, opts = {}) {
  const body = {
    model: opts.model || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens || 8192,
    response_format: opts.json ? { type: 'json_object' } : undefined,
  };
  const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).choices[0].message.content;
}

async function PATCH(agentId, body) {
  const resp = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`ElevenLabs PATCH ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ── N8N Prompt Generation ───────────────────────────────────────────
import http from 'node:http';

const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7';

function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        try {
          const parsed = JSON.parse(body);
          server._result = {
            interview_prompt: parsed.interview_prompt || '',
            feedback_prompt: parsed.feedback_prompt || '',
            first_message: parsed.first_message || '',
          };
        } catch (e) {
          server._error = e;
        }
      });
    });
    server.on('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const port = server.address().port;
      server._url = `http://host.docker.internal:${port}/cb`;
      resolve(server);
    });
  });
}

async function generatePromptViaN8N(promptSpec, sessionLabel) {
  const server = await startCallbackServer();
  try {
    const payload = {
      session_id: `test-${sessionLabel}-${Date.now()}`,
      callback_url: server._url,
      session: promptSpec.session,
      candidate: {
        cv_raw_text: promptSpec.candidate.cv_text,
        cv_available: promptSpec.candidate.cv_available,
        cv_structured: promptSpec.candidate.cv_structured,
        practice_context: promptSpec.candidate.practice_context,
      },
      role: promptSpec.role,
      interview: promptSpec.interview,
      company_profile: promptSpec.company_profile,
      role_rubric: promptSpec.role_rubric,
    };

    console.log(`  POSTing to n8n Prompt workflow (callback on port ${server.address().port})...`);
    const startTime = Date.now();

    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Wait for callback (GPT-5.2 takes 5-30s)
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`n8n callback timeout after 60s`));
      }, 60000);
      const poll = setInterval(() => {
        if (server._result) {
          clearTimeout(timeout);
          clearInterval(poll);
          resolve(server._result);
        }
        if (server._error) {
          clearTimeout(timeout);
          clearInterval(poll);
          reject(server._error);
        }
      }, 200);
    });

    console.log(`  n8n callback received in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    return result;
  } finally {
    server.close();
  }
}

// ── Stage 1: Generate prompt ────────────────────────────────────────
function buildPromptSpec(caseDef, cvText) {
  const cpFile = join(REPO, 'Mockly', 'presets.company_profile.json');
  const rrFile = join(REPO, 'Mockly', 'presets.role_rubric.json');
  const cpAll = JSON.parse(readFileSync(cpFile, 'utf-8'));
  const rrAll = JSON.parse(readFileSync(rrFile, 'utf-8'));
  const preset = caseDef.config.company_preset;
  const rubricKey = `behavioral_${caseDef.config.seniority}`;

  return {
    session: { mode: caseDef.config.session_mode, duration_min: caseDef.config.duration_min },
    candidate: {
      cv_available: true,
      cv_text: cvText,
      cv_structured: null,
      practice_context: {
        focus_areas: [],
        prior_interview_experience: "some"
      }
    },
    role: {
      title: caseDef.config.role_title,
      context: caseDef.config.role_context || '',
      seniority: caseDef.config.seniority,
      stage: caseDef.config.stage,
      company_preset: preset,
    },
    interview: {
      mode: caseDef.config.mode,
      probe_domains: [],
      depth_preference: "balanced",
    },
    company_profile: cpAll[preset] || cpAll.general_tech,
    role_rubric: rrAll[rubricKey] || rrAll.behavioral_junior,
  };
}

function runStage1Checks(generatedText, checks) {
  const results = [];
  // Identity guard
  const hasIdentity = checks.identity_must_contain_any.some(phrase =>
    generatedText.toLowerCase().includes(phrase.toLowerCase()));
  results.push({ check: 'identity_present', pass: hasIdentity, detail: `found any of: ${checks.identity_must_contain_any.join(', ')}` });

  const noEval = !checks.identity_must_not_contain.some(phrase =>
    generatedText.toLowerCase().includes(phrase.toLowerCase()));
  results.push({ check: 'not_evaluator', pass: noEval, detail: 'no evaluator instructions leaked' });

  // Entity grounding
  const matchedEntities = checks.must_reference_entities.filter(e =>
    generatedText.toLowerCase().includes(e.toLowerCase()));
  const groundingPass = matchedEntities.length >= checks.min_entity_references;
  results.push({ check: 'cv_grounding', pass: groundingPass, detail: `${matchedEntities.length}/${checks.must_reference_entities.length} entities matched (need ≥${checks.min_entity_references}): ${matchedEntities.join(', ')}` });

  // Fabrication canaries — use case-insensitive word-boundary match to avoid false
  // positives on common English words (e.g., "React" the verb, not the framework)
  const hallucinated = checks.must_not_mention.filter(e => {
    const pattern = new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return pattern.test(generatedText);
  });
  results.push({ check: 'no_fabrication', pass: hallucinated.length === 0, detail: hallucinated.length ? `HALLUCINATED: ${hallucinated.join(', ')}` : 'clean' });

  // Style rules
  const styleResults = checks.style_rules_must_contain_any.map(group => ({
    group: group.join(' | '),
    found: group.some(phrase => generatedText.toLowerCase().includes(phrase.toLowerCase()))
  }));
  results.push({ check: 'style_rules', pass: styleResults.every(s => s.found), detail: styleResults.map(s => `${s.group}: ${s.found ? '✓' : '✗'}`).join('; ') });

  return results;
}

// ── Stage 2: Live conversation ──────────────────────────────────────
async function patchAgent(prompt, firstMessage) {
  console.log('  PATCH agent with prompt (', prompt.length, 'chars)...');
  await PATCH(TEST_AGENT_ID, {
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: { prompt: prompt, built_in_tools: { end_call: { name: 'end_call', params: { system_tool_type: 'end_call' } } } },
        disable_first_message_interruptions: true,
      },
      conversation: { max_duration_seconds: 3600 },
    }
  });
}

function buildSimUserPrompt(caseDef) {
  const p = caseDef.persona;
  let prompt = `IMPORTANT: You are SPEAKING aloud in a voice interview. Keep spoken responses short (1-3 sentences). Stay in character as ${p.name}. This is a BEHAVIOURAL interview — no coding, no technical demonstration.

YOUR REALITY (what you actually know — the interviewer does NOT know this):
`;
  for (const pk of p.project_knowledge || []) {
    prompt += `- ${pk.cv_item}: depth=${pk.actual_depth}. You CAN explain: ${pk.can_explain?.join('; ') || 'basics'}\n`;
  }
  if (p.gems?.length) {
    prompt += `\nHIDDEN GEMS (real, not on CV — only reveal when directly probed on the topic or asked about initiative/impact):\n`;
    for (const g of p.gems) prompt += `- ${g.id}: ${g.hidden_fact}. Reveal when: ${g.reveal_when}\n`;
  }
  if (p.hollow_claims?.length) {
    prompt += `\nCLAIMS YOU CANNOT BACK (on CV but you don't really know):\n`;
    for (const c of p.hollow_claims) prompt += `- "${c.cv_claim}": Reality: ${c.reality}. Under probing: ${c.under_probing}. Deflect with: ${c.deflection_style}\n`;
  }
  prompt += `\nANSWERING STYLE: ${p.answering_style}\n`;
  prompt += `\nEND CONDITION: ${caseDef.sim_user?.end_instruction || 'After the interviewer wraps up, thank them and call [END_CALL].'}`;
  prompt += `\n\nYou can call [END_CALL] when the interview is over.`;
  return prompt;
}

async function runLiveConversation(caseDef) {
  let transcript = [];
  let client;
  try {
  const simUserPrompt = buildSimUserPrompt(caseDef);
  const simUserSystem = `You are ${caseDef.persona.name}, a candidate in a behavioural interview. ${simUserPrompt}`;

  console.log('  Sim-user persona built (', simUserPrompt.length, 'chars)');

  const { LiveConversationClient } = await import(pathToFileURL(join(HERE, '..', 'live', 'ws-client.mjs')).href);

  client = new LiveConversationClient({
    apiKey: ELEVENLABS_KEY,
    agentId: TEST_AGENT_ID,
    textOnly: true,
    title: caseDef.id,
  });

  console.log('  Starting ElevenLabs conversation...');
  await client.start();
  console.log('  Session started');
  const sessionStart = Date.now();
  // For text-only conversations, estimate real-time wrap-up:
  // ~5s per turn × 10 turns = 50s, so wrap-up cue at 40s
  const totalDurationMs = (caseDef.config.duration_min || 30) * 60 * 1000;
  const wrapUpAtMs = Math.min(
    totalDurationMs - 3 * 60 * 1000,
    45000  // cap at 45s for text-only test conversations
  );
  let wrapUpInjected = false;

  transcript = [];
  const maxTurns = caseDef.sim_user?.new_turns_limit || 26;
  let currentTurn = 0;
  let endCallDetected = false;

  // Get agent's opening message
  try {
    const opening = await client.awaitAgentReply({ timeoutMs: 30000 });
    if (opening.message) {
      transcript.push({ speaker: 'INTERVIEWER', text: opening.message, turn: 0 });
      console.log(`  [opening] INTERVIEWER: ${opening.message.slice(0, 150)}...`);
    }
  } catch (e) {
    console.log('  No opening message received:', e.message);
  }

  // Turn loop
  for (let turn = 0; turn < maxTurns && !endCallDetected; turn++) {
    currentTurn = turn + 1;

    // Build conversation history for sim-user
    const history = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');

    const reply = await callLLM(simUserSystem,
      `${history}\n\nWhat do you say next as ${caseDef.persona.name}? Respond conversationally (1-3 sentences).`,
      { temperature: 0.7, max_tokens: 256 });

    // Check for END_CALL signal
    if (reply.includes('[END_CALL]')) { endCallDetected = true; }

    console.log(`  [turn ${currentTurn}] CANDIDATE: ${reply.slice(0, 120)}...`);
    transcript.push({ speaker: 'CANDIDATE', text: reply.replace('[END_CALL]',''), turn: currentTurn });

    // Wait for agent response
    try {
      // Send to agent
      client.sendUser(reply);
      // Let agent finish any internal thinking before processing our message
      await new Promise(r => setTimeout(r, 500));
      const agentReply = await client.awaitAgentReply({ timeoutMs: 30000 });
      if (agentReply.skipTurn) {
        console.log(`  [turn ${currentTurn}] AGENT: (skip turn / silent)`);
        continue;
      }
      if (agentReply.message) {
        // Strip ElevenLabs internal thinking
        let msg = agentReply.message;
        const thinkMarkers = [
          /The candidate has (explained|described|provided|shared|chosen)/,
          /This (is|wraps up|aligns with)/,
          /I('ve| have) (asked|covered|now)/,
          /I (should|need to|will) (now |next |)pivot/,
        ];
        for (const marker of thinkMarkers) {
          const idx = msg.search(marker);
          if (idx > 20) { msg = msg.slice(0, idx).trim(); break; }
        }
        transcript.push({ speaker: 'INTERVIEWER', text: msg, turn: currentTurn });
        console.log(`  [turn ${currentTurn}] INTERVIEWER: ${msg.slice(0, 150)}...`);

        // Real-time wrap-up: send contextual_update to the agent (like the real backend would)
        const elapsed = Date.now() - sessionStart;
        if (!wrapUpInjected && elapsed >= wrapUpAtMs) {
          wrapUpInjected = true;
          const remainingMin = Math.round((totalDurationMs - elapsed) / 60000);
          client.sendContextualUpdate(
            `[SYSTEM] The interview has been running for approximately ${Math.round(elapsed/60000)} minutes. ` +
            `You have about ${remainingMin} minutes remaining. Begin your closing sequence naturally ` +
            `with the next candidate response — wrap up the current thread, ask if they have questions, ` +
            `then deliver your closing statement and end the call.`
          );
          console.log(`  ⏰ Contextual update sent at ${Math.round(elapsed/1000)}s (~${remainingMin} min remaining)`);
        }
      }
    } catch (e) {
      console.log(`  Agent response timeout/WS close: ${e.message}`);
      // ElevenLabs closes WS after end_call — this is normal, not an error
      break;
    }
  }

  console.log(`  Ending after ${transcript.length} entries`);
  try { await client.endSession(); } catch { /* WS already closed */ }
  return transcript;
  } catch (e) {
    console.log(`  runLiveConversation error (transcript has ${transcript.length} entries):`, e.message);
    try { await client.endSession(); } catch {}
    return transcript;
  }
}

// ── Judge ────────────────────────────────────────────────────────────
async function judgeTranscript(transcript, criteria) {
  const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
  const criteriaText = criteria.map((c, i) =>
    `${i+1}. [${c.id}] ${c.name}: ${c.conversation_goal_prompt}`).join('\n');

  const systemPrompt = `You are an impartial evaluator judging a behavioural interview transcript against specific criteria.
For each criterion, respond PASS or FAIL and give a one-sentence reason.
Return a JSON object with "results" as an array of {id, verdict, reason}.`;

  const userMsg = `TRANSCRIPT:\n${transcriptText}\n\nCRITERIA:\n${criteriaText}\n\nJudge each criterion.`;

  const raw = await callLLM(systemPrompt, userMsg, { temperature: 0, max_tokens: 2048 });
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw).results || [];
  } catch {
    return criteria.map(c => ({ id: c.id, verdict: 'ERROR', reason: 'Judge parse failure' }));
  }
}

// ── Report ───────────────────────────────────────────────────────────
function escJSON(s) { return esc(s).replace(/\n/g,'<br>'); }

// Simple markdown → HTML renderer (handles headers, bullets, bold, code, paragraphs)
function md2html(text) {
  if (!text) return '';
  let lines = text.split('\n');
  let html = '';
  let inList = false;
  let inCodeBlock = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = esc(lines[i]);

    // Code blocks
    if (line.match(/^```/)) {
      if (inCodeBlock) { html += '</code></pre>\n'; inCodeBlock = false; }
      else { html += '<pre><code>'; inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { html += line + '\n'; continue; }

    // Table separators
    if (line.match(/^\|[-|\s]+\|$/)) { inTable = true; continue; }
    if (inTable && !line.startsWith('|')) { inTable = false; html += '</table>\n'; }

    // Headers
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    if (h2) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h3>${inlineMd(h2[1])}</h3>`; continue; }
    if (h3) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h4>${inlineMd(h3[1])}</h4>`; continue; }

    // Bullet lists
    const bullet = line.match(/^[-*] (.+)/);
    if (bullet) {
      if (!inList) { html += '<ul>\n'; inList = true; }
      html += `<li>${inlineMd(bullet[1])}</li>\n`;
      continue;
    } else if (inList) { html += '</ul>\n'; inList = false; }

    // Numbered lists
    const num = line.match(/^\d+\.\s+(.+)/);
    if (num) {
      html += `<li class="num">${inlineMd(num[1])}</li>\n`;
      continue;
    }

    // Bold text before colon (like **Term:**)
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/`(.+?)`/g, '<code>$1</code>');

    // Empty line → paragraph break
    if (!line.trim()) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += '<br>';
      continue;
    }

    html += `<p>${line}</p>\n`;
  }
  if (inList) html += '</ul>\n';
  if (inCodeBlock) html += '</code></pre>\n';
  return html;
}

function inlineMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
}

function generateReport(allResults) {
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  const passCount = allResults.filter(r => r.stage1?.every(c => c.pass)).length;
  const failCount = allResults.length - passCount;

  const caseBlocks = allResults.map(r => {
    const s1Pass = r.stage1?.filter(c => c.pass).length || 0;
    const s1Total = r.stage1?.length || 0;

    return `
<div class="case" id="${r.id}">
  <div class="case-header">
    <h2>${r.id}</h2>
    <div class="badges">
      <span class="badge persona-${r.personaType}">${r.personaType}</span>
      <span class="badge role">${esc(r.role)}</span>
    </div>
    <p class="desc">${esc(r.description)}</p>
    <div class="stats">
      Stage 1: <b>${s1Pass}/${s1Total}</b> checks &nbsp;|&nbsp;
      Generated prompt: <b>${r.promptLen}</b> chars &nbsp;|&nbsp;
      Live transcript: <b>${r.transcriptLen}</b> entries
      ${r.transcriptLen > 0 ? `&nbsp;|&nbsp;<a href="http://localhost:5173/results/test?sample=${r.id}" target="_blank" style="color:#7c3aed;font-weight:600">📋 View Coaching Feedback →</a>` : ''}
    </div>
  </div>

  <details class="section">
    <summary>📋 Role &amp; Configuration</summary>
    <div class="section-body">
      <pre>${esc(r.role)}</pre>
      <p>${esc(r.description)}</p>
    </div>
  </details>

  ${r.researchPack?.background_knowledge ? `
  <details class="section">
    <summary>🔬 Research Pack (${r.researchPack.background_knowledge.length} chars)</summary>
    <div class="section-body markdown">
      ${md2html(r.researchPack.background_knowledge)}
    </div>
  </details>` : ''}

  <details class="section">
    <summary>📝 CV</summary>
    <div class="section-body markdown">
      ${md2html(r.cvText || '')}
    </div>
  </details>

  <details class="section">
    <summary>🎯 Interviewer System Prompt (${r.interviewPrompt?.length || 0} chars)</summary>
    <div class="section-body markdown">
      ${md2html(r.interviewPrompt || '')}
    </div>
  </details>

  <details class="section">
    <summary>💬 First Message</summary>
    <div class="section-body">
      <blockquote>${esc(r.firstMessage || '')}</blockquote>
    </div>
  </details>

  <details class="section">
    <summary>🎭 Sim-User Persona Prompt (${r.simUserPrompt?.length || 0} chars)</summary>
    <div class="section-body markdown">
      ${md2html(r.simUserPrompt || '')}
    </div>
  </details>

  <details class="section" open>
    <summary>✅ Stage 1 — Prompt Checks (${s1Pass}/${s1Total})</summary>
    <div class="section-body">
      <table>${(r.stage1||[]).map(c => `<tr><td class="${c.pass?'pass':'fail'}">${c.pass?'✓':'✗'}</td><td>${c.check}</td><td>${c.detail}</td></tr>`).join('')}</table>
    </div>
  </details>

  ${r.stage2 ? `
  <details class="section" open>
    <summary>🎤 Stage 2 — Live Behaviour (${r.stage2.filter(c => c.verdict==='PASS').length}/${r.stage2.length})</summary>
    <div class="section-body">
      <table>${r.stage2.map(c => `<tr><td class="${c.verdict==='PASS'?'pass':'fail'}">${c.verdict}</td><td>${c.id}</td><td>${c.reason||''}</td></tr>`).join('')}</table>
    </div>
  </details>` : '<p class="meta">No Stage 2 data</p>'}

  ${r.transcript?.length > 0 ? `
  <details class="section" open>
    <summary>📜 Full Transcript (${r.transcript.length} entries)</summary>
    <div class="section-body">
      <div class="transcript">${r.transcript.map(t => {
        let text = t.text;
        const thinkMarkers = [
          /The candidate has (explained|described|provided|shared)/,
          /This is a (good|great|clear|specific|strong)/,
          /I('ve| have) (asked|covered|now)/,
          /I should (now |next |)pivot/,
          /This aligns with/,
          /A good question would be/,
        ];
        for (const marker of thinkMarkers) {
          const idx = text.search(marker);
          if (idx > 20) { text = text.slice(0, idx).trim(); break; }
        }
        return '<div class="turn ' + (t.speaker === 'INTERVIEWER' ? 'interviewer' : 'candidate') + '">' +
          '<span class="speaker">' + (t.speaker === 'INTERVIEWER' ? '🎙 INTERVIEWER' : '👤 CANDIDATE') + '</span>' +
          '<span class="turn-num">turn ' + (t.turn || 0) + '</span>' +
          '<p>' + esc(text) + '</p>' +
        '</div>';
      }).join('')}</div>
    </div>
  </details>` : ''}
</div>`}).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Behavioural Eval — Run Report</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{font:14px/1.5 -apple-system,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#1a1e26;background:#f7f8fa}
h1{font-size:22px;margin-bottom:4px}
.summary{margin:0 0 24px;color:#5b6472;font-size:13px}
.pass{color:#1d7a34;font-weight:700}.fail{color:#b83a24;font-weight:700}.error{color:#b8700d;font-weight:700}
.case{border:1px solid #e3e7ee;border-radius:12px;margin:24px 0;background:#fff;overflow:hidden}
.case-header{padding:20px 24px;border-bottom:1px solid #e3e7ee}
.case-header h2{margin:0 0 8px;font-size:18px}
.badges{display:flex;gap:8px;margin-bottom:8px}
.badge{padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600}
.badge.persona-aligned{background:#d4edda;color:#1d7a34}
.badge.persona-undersold{background:#fff3cd;color:#856404}
.badge.persona-oversold{background:#f8d7da;color:#721c24}
.badge.role{background:#e2e8f0;color:#4a5568}
.desc{color:#5b6472;font-size:13px;margin:4px 0 0}
.stats{color:#5b6472;font-size:12.5px;margin-top:8px}
.meta{color:#5b6472;font-size:12.5px}
.section{border-bottom:1px solid #f0f1f5}
.section summary{cursor:pointer;padding:14px 24px;font-size:14px;font-weight:600;background:#fafbfc;user-select:none}
.section summary:hover{background:#f0f1f5}
.section[open] summary{background:#eef0f6}
.section-body{padding:16px 24px;max-height:600px;overflow-y:auto}
.section-body pre{font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit}
.section-body blockquote{font-size:13px;font-style:italic;color:#4a5568;border-left:3px solid #cbd5e0;margin:0;padding:4px 16px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:0}
th,td{text-align:left;padding:6px 10px;border:1px solid #e3e7ee;vertical-align:top}
th{background:#f4f6fa;font-weight:600;white-space:nowrap}
.transcript .turn{padding:8px 0;border-bottom:1px solid #f0f1f5}
.transcript .turn:last-child{border-bottom:none}
.transcript .interviewer{background:#f7f8fd}
.transcript .candidate{background:#fdfcf7}
.speaker{font-weight:700;font-size:12.5px}
.turn-num{float:right;color:#a0aec0;font-size:11px}
.transcript p{margin:4px 0 0;font-size:13px;line-height:1.6}
.markdown h3{font-size:16px;margin:16px 0 8px;color:#2d3748}
.markdown h4{font-size:14px;margin:12px 0 6px;color:#4a5568}
.markdown p{margin:4px 0;font-size:13px;line-height:1.6}
.markdown ul{margin:4px 0;padding-left:20px}
.markdown li{margin:2px 0;font-size:13px;line-height:1.5}
.markdown li.num{margin:2px 0;font-size:13px;line-height:1.5;list-style:decimal}
.markdown code{background:#edf2f7;padding:1px 5px;border-radius:3px;font-size:12px}
.markdown pre{background:#f7f8fa;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;line-height:1.5}
.markdown pre code{background:none;padding:0}
.markdown strong{color:#2d3748}
.markdown br{display:block;content:'';margin:8px 0}
</style></head>
<body>
<h1>🎤 Behavioural Eval — Run Report</h1>
<p class="summary">${now} · ${allResults.length} cases · ${passCount} clean Stage 1</p>
${caseBlocks}
</body></html>`;
}

// ── Direct prompt builder call (bypasses n8n) ───────────────────────
const RESEARCH_DIR = join(HERE, 'fixtures', 'research');

function loadResearchPack(caseId) {
  // Try multiple filename patterns: case-id (underscores → hyphens), or exact match
  const candidates = [caseId, caseId.replace(/_/g, '-')];
  for (const c of candidates) {
    try {
      const packPath = join(RESEARCH_DIR, `${c}.json`);
      const pack = JSON.parse(readFileSync(packPath, 'utf-8'));
      if (pack.background_knowledge) return pack.background_knowledge;
    } catch { /* try next */ }
  }
  return null;
}

async function generatePromptDirect(promptSpec, backgroundKnowledge) {
  const promptBuilderMd = readFileSync(PROMPT_BUILDER_MD, 'utf-8');
  const specWithBg = { ...promptSpec, background_knowledge: backgroundKnowledge || '' };
  const raw = await callLLM(promptBuilderMd, JSON.stringify(specWithBg, null, 2),
    { temperature: 0.3, max_tokens: 8192 });
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const result = JSON.parse(m ? m[0] : raw);
    return {
      interview_prompt: result.system_prompt || '',
      first_message: result.first_message || '',
    };
  } catch (e) {
    throw new Error(`Parse failed: ${e.message}. Raw: ${raw.slice(0, 200)}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const caseFiles = (await import('node:fs')).readdirSync(CASES_DIR).filter(f => f.endsWith('.json')).sort();
  const useDirect = process.argv.includes('--direct');
  const useResearch = process.argv.includes('--research');

  console.log(`Behavioural Eval Runner — ${caseFiles.length} cases`);
  console.log(`  Mode: ${useDirect ? 'direct prompt builder' : 'n8n Prompt workflow'}`);
  console.log(`  Research: ${useResearch ? 'enriched (cached packs)' : 'CV-only (baseline)'}\n`);

  const allResults = [];

  for (const file of caseFiles) {
    const casePath = join(CASES_DIR, file);
    const caseDef = JSON.parse(readFileSync(casePath, 'utf-8'));
    const cvPath = join(CASES_DIR, caseDef.cv_file);
    const cvText = readFileSync(cvPath, 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`CASE: ${caseDef.id}  [${caseDef.persona.type}]`);
    console.log(`  ${caseDef.description.slice(0, 120)}`);

    // Load research pack if enabled
    let backgroundKnowledge = null;
    if (useResearch) {
      backgroundKnowledge = loadResearchPack(caseDef.id);
      if (backgroundKnowledge) {
        console.log(`  Research: ${backgroundKnowledge.length} chars background knowledge`);
      } else {
        console.log(`  Research: none cached for this case`);
      }
    }

    // ── Stage 1 ────────────────────────────────────────
    console.log('\n  ── STAGE 1: Generate prompt ──');
    const promptSpec = buildPromptSpec(caseDef, cvText);

    let interviewPrompt, firstMessage, s1;
    try {
      if (useDirect) {
        // Direct DeepSeek call with prompt builder template
        const result = await generatePromptDirect(promptSpec, backgroundKnowledge);
        interviewPrompt = result.interview_prompt;
        firstMessage = result.first_message;
      } else {
        // n8n Prompt workflow
        const n8nResult = await generatePromptViaN8N(promptSpec, caseDef.id);
        const content = n8nResult?.content ?? n8nResult ?? {};
        interviewPrompt = content.interview_system_prompt || n8nResult.interview_prompt || '';
        firstMessage = content.first_message || n8nResult.first_message || '';
      }
      console.log(`  Generated: prompt=${interviewPrompt.length} chars, first_message="${(firstMessage || '').slice(0, 80)}..."`);
    } catch (e) {
      console.log('  Prompt generation FAILED:', e.message);
      continue;
    }

    // Stage 1 checks
    console.log('  Stage 1 checks:');
    s1 = runStage1Checks(interviewPrompt, caseDef.stage1_checks);
    for (const r of s1) console.log(`    ${r.pass ? '✓' : '✗'} ${r.check}: ${r.detail}`);

    // Build sim-user prompt for the report
    const simUserPrompt = buildSimUserPrompt(caseDef);

    // Load full research pack for the report
    let researchPack = null;
    if (useResearch && backgroundKnowledge) {
      researchPack = { background_knowledge: backgroundKnowledge };
    }

    // ── Stage 2: Live conversation ─────────────────────
    if (process.argv.includes('--stage1-only')) {
      console.log('  ⏭ Stage 2 skipped (--stage1-only)');
      allResults.push({
        id: caseDef.id,
        personaType: caseDef.persona.type,
        description: caseDef.description,
        role: `${caseDef.config.role_title} @ ${caseDef.config.company_preset} (${caseDef.config.seniority_label})`,
        promptLen: interviewPrompt.length,
        transcriptLen: 0,
        stage1: s1,
        stage2: null,
        transcript: [],
        interviewPrompt,
        firstMessage,
        simUserPrompt,
        researchPack,
        cvText,
      });
      continue;
    }

    console.log('\n  ── STAGE 2: Live conversation ──');
    try {
      await patchAgent(interviewPrompt, firstMessage);
      const transcript = await runLiveConversation(caseDef);
      console.log(`  Transcript: ${transcript.length} entries`);

      // Judge
      console.log('  Judging transcript...');
      const stage2Results = await judgeTranscript(transcript, caseDef.stage2_criteria);
      for (const r of stage2Results) console.log(`    ${r.verdict === 'PASS' ? '✓' : '✗'} ${r.id}: ${r.reason?.slice(0,100) || ''}`);

      allResults.push({
        id: caseDef.id,
        personaType: caseDef.persona.type,
        description: caseDef.description,
        role: `${caseDef.config.role_title} @ ${caseDef.config.company_preset} (${caseDef.config.seniority_label})`,
        promptLen: interviewPrompt.length,
        transcriptLen: transcript.length,
        stage1: s1,
        stage2: stage2Results,
        transcript: transcript,
        interviewPrompt,
        firstMessage,
        simUserPrompt,
        researchPack,
        cvText,
      });

    } catch (e) {
      console.log('  Stage 2 FAILED:', e.message);
      allResults.push({
        id: caseDef.id,
        personaType: caseDef.persona.type,
        description: caseDef.description,
        role: `${caseDef.config.role_title} @ ${caseDef.config.company_preset} (${caseDef.config.seniority_label})`,
        promptLen: interviewPrompt.length,
        transcriptLen: 0,
        stage1: s1,
        stage2: null,
        transcript: [],
        interviewPrompt,
        firstMessage,
        simUserPrompt,
        researchPack,
        cvText,
      });
    }
  }

  // Generate report
  writeFileSync(join(HERE, 'run-report.html'), generateReport(allResults));
  console.log(`\nReport written: run-report.html (${allResults.length} cases)`);

  // Save individual results + transcripts (per-case, inside loop to avoid overwrites)
  const runsDir = join(HERE, 'runs', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  mkdirSync(runsDir, { recursive: true });
  for (const r of allResults) {
    if (r.id) writeFileSync(join(runsDir, `${r.id}.json`), JSON.stringify(r, null, 2));
  }
  writeFileSync(join(runsDir, '_summary.json'), JSON.stringify({ ranAt: new Date().toISOString(), mode: 'direct', research: true, caseCount: allResults.length, caseIds: allResults.map(r => r.id) }, null, 2));
  console.log(`Results saved: ${runsDir} (${allResults.filter(r => r.id).length} files)`);
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
