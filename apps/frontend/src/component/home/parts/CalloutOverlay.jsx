import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Floating callout — PPT-style explanatory text that anchors to a target
 * position and flies in/out with a pointer arrow.
 *
 * Multiple callouts can be active simultaneously; each has a unique id
 * so AnimatePresence can animate entrance/exit independently.
 *
 * @param {object} props
 * @param {{ id: string, x: number, y: number, text: string, align: 'left'|'right'|'center' }[]} props.callouts
 * @param {boolean} [props.reducedMotion]
 */
export default function CalloutOverlay({ callouts = [], reducedMotion = false }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden="true">
      <AnimatePresence>
        {callouts.map((c) => {
          const isRight = c.align === 'right';
          const isCenter = c.align === 'center';

          return (
            <motion.div
              key={c.id}
              initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute max-w-[180px] md:max-w-[220px] ${
                isCenter ? 'left-1/2 -translate-x-1/2' : ''
              }`}
              style={{
                left: isCenter ? undefined : isRight ? undefined : `${c.x}%`,
                right: isRight ? `${100 - c.x}%` : undefined,
                top: `${c.y}%`,
              }}
            >
              {/* Arrow pointer */}
              <div
                className={`absolute w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-l border-t border-slate-200 dark:border-white/10 ${
                  isRight ? '-left-1.5' : 'left-4 -top-1.5'
                }`}
              />

              {/* Content bubble */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-3 py-2 shadow-lg dark:shadow-none">
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {c.text}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
