import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Card from './Card';

export default function NextStepsList({ nextSteps }) {
  if (!nextSteps || nextSteps.length === 0) return null;

  return (
    <Card delay={0.35}>
      <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <ArrowRight className="w-5 h-5 text-emerald-700" />
        Next Steps
      </h2>

      <div className="space-y-3">
        {nextSteps.map((step, idx) => (
          <motion.div
            key={idx}
            className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-emerald-200 transition-colors duration-300"
            initial={{ opacity: 0, x: -15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 * idx, duration: 0.4 }}
          >
            {/* Step number */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <motion.span
                className="text-xs font-bold text-emerald-700"
                initial={{ scale: 0.5 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * idx + 0.2, type: 'spring', stiffness: 400 }}
              >
                {idx + 1}
              </motion.span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-slate-900 mb-1">{step.focus}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{step.action}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
