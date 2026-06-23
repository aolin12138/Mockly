/**
 * HTML report generator — clean, centered, readable, with phase tracking.
 */
import { writeFileSync } from 'node:fs';

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTurn(turn, i, isHistory) {
  const role = turn.role || '?';
  const cls = role === 'user' ? 't-user' : role === 'agent' ? 't-agent' : 't-sys';
  const msg = turn.message || '';

  // Phase transition detection
  let phaseBadge = '';
  const nodeId = turn.agent_metadata?.workflow_node_id;
  if (nodeId) {
    const id = String(nodeId).length <= 8 ? String(nodeId) : String(nodeId).slice(-6);
    phaseBadge = `<span class="phase-badge" title="Workflow node: ${esc(nodeId)}">⚙ ${id}</span>`;
  }

  let toolHtml = '';
  if (turn.tool_calls?.length) {
    for (const tc of turn.tool_calls) {
      let params = '';
      try { params = JSON.stringify(JSON.parse(tc.params_as_json || '{}')).slice(0, 100); } catch {}
      toolHtml += `<div class="tool-call">→ <b>${esc(tc.tool_name)}</b>${params ? ` (${esc(params)})` : ''}</div>`;
    }
  }
  if (turn.tool_results?.length) {
    for (const tr of turn.tool_results) {
      let val = tr.result_value || '';
      try {
        // Unwrap MCP response format: { content: [{ type: "text", text: "..." }], isError }
        let parsed = JSON.parse(val);
        if (parsed.content?.[0]?.text) {
          const innerText = parsed.content[0].text;
          try { parsed = JSON.parse(innerText); } catch { val = esc(innerText.slice(0, 300)); continue; }
        }
        let p = parsed;
        // MCP get_current_code: show code snippet + metadata
        if (p.code !== undefined) {
          const preview = p.code.length > 200 ? p.code.slice(0, 200) + '...' : p.code;
          val = `<pre class="mock-code">${esc(preview)}</pre>` +
            `<span class="meta">${esc(p.language || '?')} · ${p.elapsed_seconds || 0}s elapsed · ${p.remaining_seconds || 0}s left · ${p.hint_count || 0} hints · phase: ${esc(p.phase_hint || '?')}</span>`;
        }
        // MCP run_code_against_tests: show pass/fail summary + details
        else if (p.passed !== undefined || p.total !== undefined) {
          const icon = p.all_passed ? '✅' : '❌';
          val = `<span class="test-badge ${p.all_passed ? 'tp' : 'tf'}">${icon} ${p.passed}/${p.total} passed</span>`;
          if (!p.all_passed && p.failure_category) val += ` <span class="meta">(${esc(p.failure_category)})</span>`;
          // Show visible/hidden breakdown if available
          if (p.visible) val += ` <span class="meta">visible: ${p.visible.passed}/${p.visible.total}</span>`;
          if (p.hidden) val += ` <span class="meta">hidden: ${p.hidden.passed}/${p.hidden.total}</span>`;
        }
        // Legacy format (simulate): passedTests
        else if (p.passedTests !== undefined) {
          val = `<span class="test-badge ${p.allPassed ? 'tp' : 'tf'}">${p.passedTests}/${p.totalTests} passed</span>`;
          if (!p.allPassed) val += ` <span class="meta">(${esc(p.failureCategory)})</span>`;
        }
      } catch { val = esc(val.length > 300 ? val.slice(0, 300) + '...' : val); }
      toolHtml += `<div class="tool-result">← <b>${esc(tr.tool_name)}</b>: ${val}</div>`;
    }
  }

  const historyTag = isHistory ? `<span class="history-tag">CONTEXT</span>` : '';

  return `<div class="turn ${cls}${isHistory ? ' t-hist' : ''}">
    <span class="t-role">${role.toUpperCase()}</span><span class="t-n">#${i + 1}</span>${historyTag}${phaseBadge}${toolHtml}${msg ? `<div class="t-msg">${esc(msg)}</div>` : ''}
  </div>`;
}

function renderCard(r) {
  const { scenarioId, description, targetPhase, targetPhaseLabel, result, criteria, transcript, tokens, durationMs, turnsUsed, turnLimit, transcriptSummary, historyCount, error, message } = r;
  const badge = result === 'pass' ? 'PASS' : result === 'fail' ? 'FAIL' : 'ERROR';
  const bc = `badge ${result}`;
  const isBad = result === 'fail' || result === 'error';
  const phaseColors = {1:'#58a6ff',2:'#bc8cff',3:'#eab308',4:'#22c55e'};
  const phaseColor = phaseColors[targetPhase] || 'var(--muted)';

  const sorted = [...criteria].sort((a, b) => (a.result === 'failure' ? -1 : 1) - (b.result === 'failure' ? -1 : 1));
  const rows = sorted.map(c => {
    const chip = c.result === 'success' ? '<span class="chip pass">✓</span>' : c.result === 'failure' ? '<span class="chip fail">✗</span>' : '<span class="chip unk">?</span>';
    return `<tr class="${c.result === 'failure' ? 'row-fail' : ''}"><td>${chip}</td><td class="cid">${esc(c.id)}</td><td>${esc(c.rationale)}</td></tr>`;
  }).join('');

  // Mark history turns vs generated turns
  const histCount = historyCount || 0;
  const transcriptHtml = (transcript || []).map((t, i) => {
    const isHist = i < histCount;
    return renderTurn(t, i, isHist);
  }).join('');

  return `<div class="card${isBad ? ' card-bad' : ''}">
    <div class="card-hd" onclick="this.parentElement.classList.toggle('folded')">
      <div class="card-hd-row">
        <span class="${bc}">${badge}</span>
        ${targetPhaseLabel ? `<span class="phase-tag" style="border-color:${phaseColor};color:${phaseColor}">${esc(targetPhaseLabel)}</span>` : ''}
        <span class="card-title">${esc(scenarioId)}</span>
        <span class="card-meta">${turnsUsed || 0}/${turnLimit || '?'} turns · ${(durationMs / 1000).toFixed(1)}s · ~${tokens.toLocaleString()} tok</span>
      </div>
      ${description ? `<div class="card-desc">${esc(description)}</div>` : ''}
    </div>
    <div class="card-bd">
      ${error ? `<div class="err-msg">${esc(error)}: ${esc(message || '')}</div>` : ''}
      ${transcriptSummary ? `<div class="ts-summary">${esc(transcriptSummary)}</div>` : ''}
      <h4>Criteria (${criteria.length})</h4>
      <table class="ct"><thead><tr><th></th><th>Criterion</th><th>Rationale</th></tr></thead><tbody>${rows}</tbody></table>
      <h4>Transcript ${histCount > 0 ? `<span class="hist-legend">— <span class="history-tag sm">CONTEXT</span> = seeded history, not agent-generated</span>` : ''}</h4>
      <div class="transcript">${transcriptHtml || '<div class="empty">No transcript</div>'}</div>
    </div>
  </div>`;
}

export function generateReport({ results, metadata }) {
  const { agentId, filter, totalAvailable, estimatedTokens, totalDurationMs, timestamp } = metadata;
  const pass = results.filter(r => r.result === 'pass');
  const fail = results.filter(r => r.result === 'fail');
  const errs = results.filter(r => r.result === 'error');
  const totalC = results.reduce((s, r) => s + r.criteria.length, 0);
  const passC = results.reduce((s, r) => s + r.criteria.filter(c => c.result === 'success').length, 0);
  const pct = totalC > 0 ? Math.round((passC / totalC) * 100) : 0;
  const barC = pct === 100 ? 'var(--g)' : pct >= 70 ? 'var(--y)' : 'var(--r)';

  const sorted = [...results].sort((a, b) => ({ fail: 0, error: 1, pass: 2 }[a.result] || 3) - ({ fail: 0, error: 1, pass: 2 }[b.result] || 3));
  const cards = sorted.map(r => renderCard(r)).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mockly Test Suite — ${esc(timestamp)}</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--g:#22c55e;--r:#ef4444;--y:#eab308;--b:#58a6ff;--p:#bc8cff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;font-size:17px}
.container{max-width:1000px;margin:0 auto;padding:32px 20px}

h1{font-size:22px;margin-bottom:2px;text-align:center}
.subtitle{text-align:center;color:var(--muted);font-size:14px;margin-bottom:28px}

/* Summary */
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px 16px;text-align:center}
.stat .val{font-size:32px;font-weight:700}
.stat .lbl{font-size:12px;color:var(--muted);text-transform:uppercase;margin-top:4px;letter-spacing:.5px}
.stat.pass .val{color:var(--g)}
.stat.fail .val{color:var(--r)}
.stat.err .val{color:var(--y)}
.bar-wrap{grid-column:1/-1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px 18px}
.bar-lbl{font-size:13px;color:var(--muted);margin-bottom:8px}
.bar{height:8px;border-radius:4px;background:#21262d;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .4s}

.filter{text-align:center;font-size:13px;color:var(--muted);margin-bottom:16px;padding:10px;background:var(--card);border:1px solid var(--border);border-radius:6px}
.filter b{color:var(--text)}

.controls{display:flex;justify-content:center;gap:24px;margin-bottom:20px;font-size:14px}
.controls label{cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:8px}
.controls input{accent-color:var(--b);width:16px;height:16px}

/* Cards */
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
.card-bad{border-left:3px solid var(--r)}
.card-hd{cursor:pointer;user-select:none;transition:background .1s}
.card-hd:hover{background:rgba(255,255,255,.02)}
.card-hd-row{display:flex;align-items:center;gap:12px;padding:14px 18px}
.badge{font-size:11px;font-weight:700;padding:4px 12px;border-radius:14px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
.badge.pass{background:rgba(34,197,94,.12);color:var(--g)}
.badge.fail{background:rgba(239,68,68,.12);color:var(--r)}
.badge.error{background:rgba(234,179,8,.12);color:var(--y)}
.card-title{font-weight:600;font-size:15px;flex:1;min-width:0}
.card-desc{font-size:13px;color:var(--muted);line-height:1.6;padding:8px 18px 10px;border-top:1px solid var(--border);margin-top:0}
.phase-tag{font-size:10px;font-weight:600;padding:3px 10px;border-radius:12px;border:1px solid;white-space:nowrap;letter-spacing:.3px;text-transform:uppercase}
.card-meta{font-size:12px;color:var(--muted);white-space:nowrap;text-align:right}
.card-bd{padding:0 18px 18px}
.card.folded .card-bd{display:none}

.err-msg{background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.2);padding:12px 16px;border-radius:6px;margin-bottom:14px;font-size:14px;color:var(--y)}
.ts-summary{font-size:13px;color:var(--muted);margin-bottom:14px;font-style:italic}
h4{font-size:12px;margin:18px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}

/* Criteria table */
.ct{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px}
.ct th{text-align:left;padding:8px 12px;color:var(--muted);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--border)}
.ct td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03);vertical-align:top}
.row-fail{background:rgba(239,68,68,.04)}
.cid{font-family:'SF Mono',Consolas,monospace;font-size:12px;color:var(--p);white-space:nowrap}
.chip{display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;font-size:12px;font-weight:700}
.chip.pass{background:rgba(34,197,94,.18);color:var(--g)}
.chip.fail{background:rgba(239,68,68,.18);color:var(--r)}
.chip.unk{background:rgba(188,140,255,.18);color:var(--p)}

/* Transcript */
.hist-legend{font-weight:400;text-transform:none;font-size:11px;color:var(--muted);letter-spacing:0}
.transcript{border:1px solid var(--border);border-radius:6px;overflow:hidden}
.turn{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.03);font-size:14px}
.turn:last-child{border-bottom:none}
.t-hist{opacity:.55;border-left:3px solid var(--border)}
.t-user{background:rgba(88,166,255,.03)}
.t-agent{background:rgba(188,140,255,.03)}
.t-role{font-size:10px;font-weight:700;text-transform:uppercase;margin-right:10px;padding:3px 7px;border-radius:4px}
.t-user .t-role{background:rgba(88,166,255,.2);color:var(--b)}
.t-agent .t-role{background:rgba(188,140,255,.2);color:var(--p)}
.t-n{font-size:10px;color:var(--muted);margin-right:8px}
.history-tag{font-size:9px;font-weight:600;padding:2px 6px;border-radius:3px;background:rgba(139,148,158,.15);color:var(--muted);margin-right:8px;text-transform:uppercase;letter-spacing:.3px}
.history-tag.sm{display:inline-block}
.phase-badge{font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(234,179,8,.15);color:var(--y);margin-right:8px;font-family:monospace}
.t-msg{margin-top:8px;color:var(--text);line-height:1.6}
.tool-call{font-size:13px;color:var(--y);padding:4px 0 4px 16px;border-left:2px solid rgba(234,179,8,.3);margin:4px 0 4px 8px}
.tool-result{font-size:13px;color:var(--g);padding:4px 0 4px 16px;border-left:2px solid rgba(34,197,94,.3);margin:4px 0 4px 8px}
.mock-code{background:rgba(255,255,255,.04);padding:8px 12px;border-radius:4px;font-family:'SF Mono',Consolas,monospace;font-size:12px;margin:4px 0;white-space:pre-wrap;line-height:1.5}
.meta{font-size:11px;color:var(--muted);margin-left:8px}
.test-badge{font-weight:600;font-size:13px}
.test-badge.tp{color:var(--g)}.test-badge.tf{color:var(--r)}
.empty{color:var(--muted);font-style:italic;padding:14px}

.footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}
</style></head><body>
<div class="container">
<h1>Mockly Test Suite Report</h1>
<div class="subtitle">Agent: ${esc(agentId)} · ${esc(timestamp)} · filter: ${esc(filter)}</div>

<div class="summary">
  <div class="stat pass"><div class="val">${pass.length}</div><div class="lbl">Passed</div></div>
  <div class="stat fail"><div class="val">${fail.length}</div><div class="lbl">Failed</div></div>
  <div class="stat err"><div class="val">${errs.length}</div><div class="lbl">Errors</div></div>
  <div class="stat"><div class="val">${results.length}</div><div class="lbl">Total</div></div>
  <div class="bar-wrap">
    <div class="bar-lbl">${passC}/${totalC} criteria passed (${pct}%) · est. ${estimatedTokens.toLocaleString()} tokens · ${(totalDurationMs/1000).toFixed(0)}s</div>
    <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${barC}"></div></div>
  </div>
</div>

<div class="filter">Ran <b>${results.length}</b> of <b>${totalAvailable}</b> scenarios${results.length < totalAvailable ? ' — <b>partial run</b>' : ''}</div>

<div class="controls">
  <label><input type="checkbox" id="fo" onchange="document.querySelectorAll('.card').forEach(c=>c.style.display=this.checked&&!c.classList.contains('card-bad')?'none':'')"> Show failures & errors only</label>
  <label><input type="checkbox" id="hideHist" onchange="document.querySelectorAll('.t-hist').forEach(t=>t.style.display=this.checked?'none':'')"> Hide context history</label>
</div>

${cards}

<div class="footer">Mockly Test Suite · ElevenLabs simulate-conversation API<br>Token counts are estimated (API does not return actual usage for simulations)</div>
</div>
</body></html>`;
}

export function writeReport(results, metadata, outputPath) {
  writeFileSync(outputPath, generateReport({ results, metadata }), 'utf-8');
  return outputPath;
}
