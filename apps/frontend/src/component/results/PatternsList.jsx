import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import Card from './Card';

const impactSizes = {
  high: 'w-2.5 h-2.5',
  medium: 'w-2 h-2',
  low: 'w-1.5 h-1.5',
};

const impactBadgeStyles = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function PatternsList({ patterns }) {
  if (!patterns || patterns.length === 0) return null;

  const strengths = patterns.filter((p) => p.type === 'strength');
  const gaps = patterns.filter((p) => p.type === 'gap');

  return (
    <Card delay={0.3}>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Performance Patterns</h2>
      <p className="text-sm text-slate-600 mb-4">Repeated behaviors observed across your answers.</p>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Strengths column */}
        {strengths.length > 0 && (
          <div>
              <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-700">Strengths</span>
            </div>
            <div className="space-y-2">
              {strengths.map((pattern, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * idx }}
                  className="flex items-start gap-2.5 text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3"
                >
                  <div className={`${impactSizes[pattern.impact] || impactSizes.medium} rounded-full bg-emerald-500 mt-1.5 flex-shrink-0`} />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{pattern.description}</p>
                    <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${impactBadgeStyles[pattern.impact] || impactBadgeStyles.medium}`}>
                      {pattern.impact} impact
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Gaps column */}
        {gaps.length > 0 && (
          <div>
              <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-semibold text-amber-700">Gaps</span>
            </div>
            <div className="space-y-2">
              {gaps.map((pattern, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * idx }}
                  className="flex items-start gap-2.5 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3"
                >
                  <div className={`${impactSizes[pattern.impact] || impactSizes.medium} rounded-full bg-amber-500 mt-1.5 flex-shrink-0`} />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{pattern.description}</p>
                    <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${impactBadgeStyles[pattern.impact] || impactBadgeStyles.medium}`}>
                      {pattern.impact} impact
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
