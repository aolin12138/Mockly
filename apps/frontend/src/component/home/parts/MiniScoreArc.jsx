import React from 'react';

/**
 * Circular score arc, value 0-100. Pure presentation — `value` is what's
 * shown right now; caller is responsible for interpolating value over time.
 *
 * Uses SVG stroke-dashoffset for the fill, no width/height animation.
 * Score number tabular-nums for stable layout.
 */
export default function MiniScoreArc({ value = 0, size = 120, strokeWidth = 8 }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Value */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(16, 185, 129)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 60ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {clamped}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Score
        </span>
      </div>
    </div>
  );
}
