import React from 'react';

/**
 * Rounded panel wrapper used by every demo. Just visual chrome —
 * the demo content lives inside via children.
 *
 * Uses DESIGN.md tokens only:
 *   light: bg-slate-50, border-slate-200
 *   dark:  bg-slate-900/40, border-white/10
 *
 * Aspect: 4:3 on mobile, 16:10 on tablet, 16:9 on desktop, max-height 560px.
 * Aspect is reserved via padding-bottom trick so CLS = 0.
 */
export default function DemoFrame({ children, ariaLabel }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 aspect-[4/3] md:aspect-[16/10] lg:aspect-[16/9] lg:max-h-[560px] min-h-[320px]"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
