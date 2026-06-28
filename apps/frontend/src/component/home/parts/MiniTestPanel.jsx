import React from 'react';

/**
 * Test results panel. Each entry in `cases` shows:
 *   - pass/fail icon (not color-alone — includes text)
 *   - input string
 *   - expected output
 *   - actual output (only for failed entries)
 *
 * Entries reveal one at a time via `visibleCount`.
 *
 * @param {object} props
 * @param {{ pass: boolean, input: string, expected: string, actual?: string }[]} props.cases
 * @param {number} [props.visibleCount]
 * @param {boolean} [props.visible]
 */
export default function MiniTestPanel({
  cases = [],
  visibleCount = cases.length,
  visible = true,
}) {
  if (!visible) return null;

  const shown = cases.slice(0, visibleCount);

  return (
    <div className="border-t border-white/10 bg-slate-900 dark:bg-slate-900 p-2 md:p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        Test Results
      </p>
      <div className="space-y-1">
        {shown.map((tc, i) => {
          const isLast = i === shown.length - 1;
          const isFailing = tc.pass === false;

          return (
            <div
              key={i}
              className={`flex items-center gap-1.5 text-[9px] md:text-[10px] font-mono ${
                isFailing
                  ? 'bg-red-900/20 border border-red-800/40 rounded-md px-1.5 py-0.5'
                  : ''
              }`}
              style={isFailing && isLast ? { borderRadius: '6px', border: '1px solid rgba(239,68,68,0.4)' } : {}}
            >
              {/* Icon + text for pass/fail (not color-alone) */}
              <span className="flex-shrink-0">
                {isFailing ? (
                  <span className="text-red-500 font-bold" aria-label="Failed">
                    ✗
                  </span>
                ) : (
                  <span className="text-emerald-500 font-bold" aria-label="Passed">
                    ✓
                  </span>
                )}
              </span>
              <span className="text-slate-300 truncate">{tc.input}</span>
              <span className="text-slate-500 mx-1">→</span>
              <span className={isFailing ? 'text-red-400' : 'text-slate-300'}>
                {isFailing ? tc.actual : tc.expected}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
