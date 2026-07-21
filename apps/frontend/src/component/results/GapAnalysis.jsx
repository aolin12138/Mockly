import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, TrendingUp, Zap } from 'lucide-react';
import Card from './Card';
import ResourceLinks from './ResourceLinks';

export default function GapAnalysis({ gapAnalysis }) {
  if (!gapAnalysis) return null;

  const {
    summary,
    missing_skills: missingSkills,
    under_communicated_strengths: underCommunicated,
    market_context: marketContext,
    resources,
  } = gapAnalysis;

  const hasMissing = Array.isArray(missingSkills) && missingSkills.length > 0;
  const hasUnder = Array.isArray(underCommunicated) && underCommunicated.length > 0;

  if (!summary && !hasMissing && !hasUnder && !marketContext) return null;

  return (
    <Card delay={0.24}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        Gap Analysis
      </h2>

      {/* Summary */}
      {summary && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-slate-700 dark:text-slate-300 mb-5 leading-relaxed"
        >
          {summary}
        </motion.p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Missing Skills */}
        {hasMissing && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Missing Skills
            </h3>
            <ul className="space-y-2">
              {missingSkills.map((skill, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span>{skill}</span>
                </li>
              ))}
            </ul>

            {/* Tutorials / repos to close these skill gaps */}
            <ResourceLinks resources={resources} label="Learn these" compact />
          </motion.div>
        )}

        {/* Under-communicated Strengths */}
        {hasUnder && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              Under-communicated Strengths
            </h3>
            <ul className="space-y-2">
              {underCommunicated.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      {/* Market Context */}
      {marketContext && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-white/10 rounded-xl p-4"
        >
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Market Context
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{marketContext}</p>
        </motion.div>
      )}
    </Card>
  );
}
