import React from 'react';

/**
 * Goal panel: label, count "current / total", animated progress bar.
 * Optional checkmark slides in when current reaches a milestone.
 *
 * Pure presentation. Caller controls `current` over time for animation.
 */
export default function MiniGoalPanel({
  label = 'Practice goal',
  current = 0,
  total = 5,
  pulse = false,
  visible = true,
}) {
  if (!visible) return null;
  const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-3 transition-shadow duration-200 ${
        pulse ? 'shadow-[0_0_0_3px_rgba(16,185,129,0.18)]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
          {label}
        </p>
        <span
          className="text-[11px] font-semibold text-slate-600 dark:text-slate-400"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(current * 10) / 10} / {total}
        </span>
      </div>
      <div className="h-[5px] rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full"
          style={{
            width: `${ratio * 100}%`,
            transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}
