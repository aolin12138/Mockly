import { motion } from 'framer-motion';

const STEPS = [
  { key: 'needs_work', label: 'Needs Work' },
  { key: 'nearly_ready', label: 'Nearly Ready' },
  { key: 'ready', label: 'Ready' },
];

export default function ReadinessStepper({ readiness }) {
  const activeIndex = STEPS.findIndex((s) => s.key === readiness);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, idx) => {
        const isActive = idx <= activeIndex;
        const isCurrent = idx === activeIndex;

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* Step dot */}
            <motion.div
              className="relative flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 + idx * 0.15 }}
            >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                    isActive
                      ? isCurrent
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                        : 'bg-emerald-400/70'
                      : 'bg-slate-300'
                  }`}
                />
            </motion.div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`w-4 h-0.5 rounded-full transition-all duration-500 ${
                  idx < activeIndex ? 'bg-emerald-300' : 'bg-slate-300'
                }`}
              />
            )}
          </div>
        );
      })}

      {/* Label */}
      <motion.span
        className="ml-2 text-sm font-medium text-slate-600"
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0 }}
      >
        {STEPS[activeIndex]?.label || readiness}
      </motion.span>
    </div>
  );
}
