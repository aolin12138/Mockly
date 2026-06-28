import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MiniProblemPanel from '../parts/MiniProblemPanel';
import MiniCodeEditor from '../parts/MiniCodeEditor';
import MiniTestPanel from '../parts/MiniTestPanel';
import CalloutOverlay from '../parts/CalloutOverlay';

function technicalStateAtTime(script, elapsed, reducedMotion) {
  const state = {
    problemTitle: '',
    problemBody: '',
    titleStartAt: null,
    bodyStartAt: null,
    codeLines: [],
    visibleLines: 0,
    codeStartAt: null,
    testCases: [],
    testVisibleCount: 0,
    diffLineIndex: null,
    diffLineReplacement: null,
    submitActive: false,
    agentOrbVisible: false,
    agentOrbState: 'idle',
    agentHint: '',
    agentHintStartAt: null,
    callouts: [],
    calloutHistory: new Set(),
  };

  if (!script?.frames) return state;

  if (reducedMotion) {
    const snapped = technicalStateAtTime(script, (script.duration ?? 14000) + 2000, false);
    snapped.visibleLines = snapped.codeLines.length;
    snapped.testVisibleCount = snapped.testCases.length;
    snapped.agentOrbVisible = false;
    return snapped;
  }

  for (const frame of script.frames) {
    if (frame.t > elapsed) break;

    switch (frame.type) {
      case 'typewrite':
        if (frame.target === 'problem_title') {
          state.problemTitle = frame.text || '';
          state.titleStartAt = frame.t;
        } else if (frame.target === 'problem_body') {
          state.problemBody = frame.text || '';
          state.bodyStartAt = frame.t;
        } else if (frame.target === 'agent_hint') {
          state.agentHint = frame.text || '';
          state.agentHintStartAt = frame.t;
        }
        break;
      case 'code_line':
        if (frame.line) {
          state.codeLines.push(frame.line);
          state.visibleLines = state.codeLines.length;
          if (state.codeStartAt === null) state.codeStartAt = frame.t;
        }
        break;
      case 'agent_orb':
        state.agentOrbVisible = true;
        state.agentOrbState = frame.state || 'speaking';
        break;
      case 'run_tests': {
        const dt = elapsed - frame.t;
        state.testVisibleCount = Math.min(
          (state.testCases.length || 0) + 1,
          Math.max(1, Math.floor(dt / 300) + 1),
        );
        break;
      }
      case 'test_result':
        if (frame.testCase) state.testCases.push(frame.testCase);
        break;
      case 'code_edit':
        if (frame.lineIndex !== undefined) {
          state.diffLineIndex = frame.lineIndex;
          state.diffLineReplacement = frame.replacement || null;
          if (frame.replacement && frame.lineIndex < state.codeLines.length) {
            state.codeLines[frame.lineIndex] = frame.replacement;
          }
        }
        break;
      case 'submit':
        state.submitActive = true;
        break;
      case 'callout':
        if (!state.calloutHistory.has(frame.id)) {
          state.calloutHistory.add(frame.id);
          state.callouts.push({
            id: frame.id,
            x: frame.x || 50,
            y: frame.y || 50,
            text: frame.text || '',
            align: frame.align || 'left',
          });
        }
        break;
      default:
        break;
    }
  }

  state.testVisibleCount = Math.min(state.testVisibleCount, state.testCases.length);
  state.visibleLines = Math.min(state.visibleLines, state.codeLines.length);

  return state;
}

export default function TechnicalDemo({ script, elapsed = 0, reducedMotion = false }) {
  const view = useMemo(
    () => technicalStateAtTime(script, elapsed, reducedMotion),
    [script, elapsed, reducedMotion],
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-900 overflow-hidden">
      {/* Main area: problem left, code right */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Problem panel */}
        <div className="w-full md:w-2/5 border-r border-white/10 bg-slate-950/50 overflow-y-auto">
          <MiniProblemPanel
            title={view.problemTitle}
            body={view.problemBody}
            elapsed={elapsed}
            titleStartAt={view.titleStartAt ?? 0}
            bodyStartAt={view.bodyStartAt ?? 0}
            reducedMotion={reducedMotion}
            visible
          />
        </div>

        {/* Code panel */}
        <div className="w-full md:w-3/5 flex flex-col min-h-0 border-t md:border-t-0 border-white/10">
          <MiniCodeEditor
            lines={view.codeLines}
            visibleLines={view.visibleLines}
            diffLineIndex={view.diffLineIndex}
            diffLineReplacement={view.diffLineReplacement}
            language="JS"
            visible
          />
        </div>
      </div>

      {/* Bottom: Test panel + Run/Submit */}
      <div>
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/10 bg-slate-800/50">
          <motion.div
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
              view.submitActive
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-500'
            }`}
            animate={view.submitActive ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 0.4, repeat: view.submitActive ? 2 : 0 }}
          >
            Run tests
          </motion.div>
          <motion.div
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
              view.submitActive
                ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-slate-700 text-slate-500'
            }`}
            animate={view.submitActive ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: view.submitActive ? 2 : 0 }}
          >
            Submit
          </motion.div>

          {/* Agent orb — mini, top-right corner of button bar */}
          <AnimatePresence>
            {view.agentOrbVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="ml-auto flex items-center gap-2 pr-1"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                      view.agentOrbState === 'speaking'
                        ? 'bg-emerald-400 animate-pulse'
                        : view.agentOrbState === 'thinking'
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                    }`}
                  />
                </div>
                <span className="text-[9px] text-slate-400 max-w-[160px] truncate">
                  {view.agentHint ? (
                    <span className="text-emerald-400">Hint: {view.agentHint}</span>
                  ) : (
                    'Agent listening'
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <MiniTestPanel
          cases={view.testCases}
          visibleCount={view.testVisibleCount}
          visible={view.testCases.length > 0}
        />
      </div>

      {/* Callout overlays */}
      <CalloutOverlay callouts={view.callouts} reducedMotion={reducedMotion} />
    </div>
  );
}
