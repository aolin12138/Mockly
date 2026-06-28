import React from 'react';
import TypewriterText from './TypewriterText';

/**
 * Problem statement panel — left pane in the Technical demo.
 * Title and body type in over time via TypewriterText.
 *
 * @param {object} props
 * @param {string} props.title        - problem title
 * @param {string} props.body         - problem body text
 * @param {number} props.elapsed      - current timeline elapsed
 * @param {number} props.titleStartAt  - when title starts typing
 * @param {number} props.bodyStartAt   - when body starts typing
 * @param {boolean} props.reducedMotion
 * @param {boolean} props.visible
 */
export default function MiniProblemPanel({
  title = '',
  body = '',
  elapsed = 0,
  titleStartAt = 0,
  bodyStartAt = 0,
  reducedMotion = false,
  visible = true,
}) {
  if (!visible) return null;

  return (
    <div className="p-3 md:p-4 h-full flex flex-col">
      <h3 className="text-xs md:text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
        <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <TypewriterText
          text={title}
          elapsed={elapsed}
          startAt={titleStartAt}
          reducedMotion={reducedMotion}
          charsPerSec={35}
        />
      </h3>
      <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
        <TypewriterText
          text={body}
          elapsed={elapsed}
          startAt={bodyStartAt}
          reducedMotion={reducedMotion}
          charsPerSec={50}
        />
      </p>
    </div>
  );
}
