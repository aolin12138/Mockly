import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Caption strip that crossfades when the caption text changes.
 *
 * Uses aria-live="polite" so screen readers announce changes without
 * interrupting other content.
 */
export default function DemoCaptionStrip({ caption, reducedMotion }) {
  return (
    <div
      className="min-h-[44px] md:min-h-[48px] flex items-center justify-center text-center px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait" initial={false}>
        {caption ? (
          <motion.p
            key={caption}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300 max-w-2xl"
          >
            {caption}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
