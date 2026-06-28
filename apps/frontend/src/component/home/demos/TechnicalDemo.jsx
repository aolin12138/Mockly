import React, { useMemo } from 'react';
import MiniProblemPanel from '../parts/MiniProblemPanel';
import MiniCodeEditor from '../parts/MiniCodeEditor';
import MiniTestPanel from '../parts/MiniTestPanel';

/**
 * Derive technical demo state at `elapsed` ms from script frames.
 * Pure function.
 *
 * Frame types:
 *   typewrite  — start typing into 'problem_title' | 'problem_body'
 *   code_line  — append one tokenized line to the editor
 *   run_tests  — trigger test run (shows test panel row-by-row)
 *   test_result — add a row to the test panel
 *   code_edit  — replace one line (diff animation)
 *   submit     — highlight submit button
 */
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
  };

  if (!script?.frames) return state;

  if (reducedMotion) {
    const snapped = technicalStateAtTime(script, (script.duration ?? 14000) + 2000, false);
    snapped.visibleLines = snapped.codeLines.length;
    snapped.testVisibleCount = snapped.testCases.length;
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
        }
        break;
      case 'code_line':
        if (frame.line) {
          state.codeLines.push(frame.line);
          state.visibleLines = state.codeLines.length;
          if (state.codeStartAt === null) state.codeStartAt = frame.t;
        }
        break;
      case 'run_tests': {
        // Reveal test cases one by one over 1500ms after this frame fires
        const dt = elapsed - frame.t;
        state.testVisibleCount = Math.min(
          (state.testCases.length || 0) + 1,
          Math.max(1, Math.floor(dt / 300) + 1),
        );
        break;
      }
      case 'test_result':
        if (frame.testCase) {
          state.testCases.push(frame.testCase);
        }
        break;
      case 'code_edit':
        if (frame.lineIndex !== undefined) {
          state.diffLineIndex = frame.lineIndex;
          state.diffLineReplacement = frame.replacement || null;
          // Apply the edit to codeLines so further edits stack correctly
          if (frame.replacement && frame.lineIndex < state.codeLines.length) {
            state.codeLines[frame.lineIndex] = frame.replacement;
          }
        }
        break;
      case 'submit':
        state.submitActive = true;
        break;
      default:
        break;
    }
  }

  // Cap test visible count at actual length
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

      {/* Bottom: Test panel + Run/Submit buttons */}
      <div>
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/10 bg-slate-800/50">
          <div
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors duration-300 ${
              view.submitActive
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-500'
            }`}
          >
            Run tests
          </div>
          <div
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors duration-300 ${
              view.submitActive
                ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                : 'bg-slate-700 text-slate-500'
            }`}
          >
            Submit
          </div>
        </div>
        <MiniTestPanel
          cases={view.testCases}
          visibleCount={view.testVisibleCount}
          visible={view.testCases.length > 0}
        />
      </div>
    </div>
  );
}
