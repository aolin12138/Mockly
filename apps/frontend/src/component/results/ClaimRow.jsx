import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Lightbulb, PenLine } from 'lucide-react';

const assessmentStyles = {
  consistent: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Consistent' },
  understated: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', label: 'Understated' },
  overstated: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Overstated' },
  not_tested: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', label: 'Not Tested' },
};

export default function ClaimRow({ claim, index }) {
  const [expanded, setExpanded] = useState(false);
  const style = assessmentStyles[claim.assessment] || assessmentStyles.not_tested;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 * index }}
      className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/40"
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-base text-slate-900 dark:text-slate-100 truncate">{claim.cv_claim}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${style.bg} ${style.border} ${style.text}`}>
            {style.label}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60">
          {/* What you showed */}
          {claim.what_you_showed && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Interview evidence</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{claim.what_you_showed}</p>
            </div>
          )}

          {/* Gap */}
          {claim.gap && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Gap</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{claim.gap}</p>
            </div>
          )}

          {/* Coaching */}
          {claim.coaching && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
              {claim.coaching.how_to_answer && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-700 font-semibold mb-1">How to answer</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{claim.coaching.how_to_answer}</p>
                  </div>
                </div>
              )}
              {claim.coaching.cv_suggestion && (
                <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-lg p-3">
                  <PenLine className="w-3.5 h-3.5 text-sky-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-sky-700 font-semibold mb-1">CV suggestion</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{claim.coaching.cv_suggestion}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
