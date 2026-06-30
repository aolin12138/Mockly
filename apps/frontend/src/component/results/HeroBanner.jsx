import { motion } from 'framer-motion';
import ScoreArc from './ScoreArc';
import ReadinessStepper from './ReadinessStepper';
import { getRecommendationColor } from './helpers';

export default function HeroBanner({ summary, meta }) {
  const recommendationStyle = summary?.recommendation
    ? getRecommendationColor(summary.recommendation)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {/* Session mode badge */}
      {meta?.session_mode && (
        <motion.div
          className="absolute top-0 right-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            meta.session_mode === 'real'
              ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300'
              : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
          }`}>
            {meta.session_mode === 'real' ? 'Real Interview' : 'Practice'}
          </span>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Score Arc */}
        {summary?.overallScore != null && (
          <div className="flex-shrink-0 flex items-center gap-4">
            <ScoreArc score={summary.overallScore} />

            {/* Confidence pill */}
            {meta?.confidence_level && (
              <motion.span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                  meta.confidence_level === 'high'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : meta.confidence_level === 'medium'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                {meta.confidence_level} confidence
              </motion.span>
            )}
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <motion.h1
            className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Interview Summary
          </motion.h1>

          {/* One-liner */}
          {summary?.oneLiner && (
            <motion.p
              className="mt-3 text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {summary.oneLiner}
            </motion.p>
          )}

          {/* Badges row */}
          <motion.div
            className="mt-3 flex items-center gap-3 flex-wrap"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {/* Recommendation badge */}
            {recommendationStyle && (
              <div className={`px-3.5 py-1.5 rounded-full ${recommendationStyle.bg} border ${recommendationStyle.border}`}>
                <span className={`text-sm font-semibold ${recommendationStyle.text}`}>
                  {recommendationStyle.label}
                </span>
              </div>
            )}

            {/* Readiness stepper */}
            {summary?.readiness && (
              <ReadinessStepper readiness={summary.readiness} />
            )}

            {/* Questions asked */}
            {meta?.questions_asked > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {meta.questions_asked} question{meta.questions_asked !== 1 ? 's' : ''} asked
              </span>
            )}
          </motion.div>

          {/* Domains covered */}
          {meta?.domains_covered && meta.domains_covered.length > 0 && (
            <motion.div
              className="mt-2.5 flex items-center gap-1.5 flex-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {meta.domains_covered.map((domain) => (
                <span
                  key={domain}
                  className="text-sm font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                >
                  {domain.replace(/_/g, ' ')}
                </span>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
