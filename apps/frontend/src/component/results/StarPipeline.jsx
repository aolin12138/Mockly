import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const STAR_STEPS = [
  { key: 'situation', label: 'S' },
  { key: 'task', label: 'T' },
  { key: 'action', label: 'A' },
  { key: 'result', label: 'R' },
];

export default function StarPipeline({ star, animated = true }) {
  return (
    <div className="flex items-center gap-0">
      {STAR_STEPS.map((step, idx) => {
        const passed = star?.[step.key];
        const prevPassed = idx > 0 ? star?.[STAR_STEPS[idx - 1].key] : true;

        return (
          <div key={step.key} className="flex items-center">
            {/* Connector line (before each circle except first) */}
            {idx > 0 && (
              <motion.div
                className={`h-0.5 rounded-full ${
                  passed && prevPassed
                    ? 'bg-emerald-300 dark:bg-emerald-400/50'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ width: '16px' }}
                initial={animated ? { scaleX: 0 } : false}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.15 * idx, duration: 0.2 }}
              />
            )}

            {/* Circle */}
            <motion.div
              className={`relative flex items-center justify-center rounded-full ${
                passed
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-white dark:bg-slate-900/60 border-2 border-dashed border-slate-300 dark:border-white/10'
              }`}
              style={{ width: '32px', height: '32px' }}
              initial={animated ? { scale: 0.5, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.15 * idx + 0.1,
                duration: 0.3,
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
            >
              {passed ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <X className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              )}

              {/* Label below */}
              <span
                className={`absolute -bottom-4 text-[9px] font-bold tracking-wider ${
                  passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
