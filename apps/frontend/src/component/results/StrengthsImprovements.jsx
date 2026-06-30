import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import Card from './Card';

export default function StrengthsImprovements({ strengths, areasForImprovement }) {
  if ((!strengths || strengths.length === 0) && (!areasForImprovement || areasForImprovement.length === 0)) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <Card delay={0.28}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            Strengths
          </h2>
          <ul className="space-y-3">
            {strengths.map((strength, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 rounded-lg p-3.5"
              >
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    {strength.dimension && (
                      <span className="text-emerald-700 font-semibold text-sm">{strength.dimension}: </span>
                    )}
                    <span>{strength.description || strength}</span>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      {/* Areas for Improvement */}
      {areasForImprovement && areasForImprovement.length > 0 && (
        <Card delay={0.32}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            Areas for Improvement
          </h2>
          <ul className="space-y-4">
            {areasForImprovement.map((area, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-500/5 border border-red-200 rounded-lg p-3.5"
              >
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {area.dimension && (
                        <span className="text-red-700 font-semibold text-sm">{area.dimension}: </span>
                      )}
                      {area.priority && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          area.priority === 'high'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {area.priority === 'high' ? 'High priority' : 'Medium priority'}
                        </span>
                      )}
                    </div>
                    <span className="block mt-1">{area.suggestion || area}</span>
                  </div>
                </div>

                {/* Coach's note - example better response */}
                {area.example_better_response && (
                  <div className="ml-3.5 mt-1 flex items-start gap-2 bg-emerald-50 border-l-2 border-emerald-300 rounded p-2.5">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-700 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-emerald-700 font-semibold mb-1">Better approach</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{area.example_better_response}</p>
                    </div>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
