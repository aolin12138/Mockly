import React from 'react';

/**
 * Small session result card. When `hovered` is true, the card lifts and
 * STAR bars expand inside (driven by `starProgress` 0..1).
 *
 * Pure presentation. Tabular-num score.
 */
export default function MiniSessionCard({
  topic = 'Session',
  score = 0,
  hovered = false,
  starProgress = 0,
  visible = true,
  delayClass = '',
}) {
  if (!visible) return null;

  const starParts = ['Situation', 'Task', 'Action', 'Result'];
  // Target widths for each bar — slight variance keeps it from feeling robotic
  const targets = [0.95, 0.85, 0.7, 0.55];
  const widths = targets.map((t) => Math.max(0, Math.min(1, t * starProgress)));

  const scoreColor =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 70
        ? 'text-slate-700 dark:text-slate-300'
        : 'text-amber-600 dark:text-amber-400';

  return (
    <div
      className={`relative rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-3 text-left transition-transform duration-200 transition-shadow duration-200 ${delayClass}`}
      style={{
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 18px -10px rgba(15, 23, 42, 0.25)' : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
          {topic}
        </p>
        <span
          className={`text-sm font-bold ${scoreColor}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {score}
        </span>
      </div>
      {hovered && (
        <div className="mt-2 space-y-1">
          {starParts.map((part, i) => (
            <div key={part} className="flex items-center gap-2">
              <span className="w-[14px] text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {part[0]}
              </span>
              <div className="flex-1 h-[3px] rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${widths[i] * 100}%`,
                    transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
