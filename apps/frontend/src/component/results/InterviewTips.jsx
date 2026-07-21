import { motion } from 'framer-motion';
import { MessageSquare, Layout, FileText, Target } from 'lucide-react';
import Card from './Card';
import ResourceLinks from './ResourceLinks';

const CATEGORY_META = {
  delivery: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20', label: 'Delivery' },
  structure: { icon: Layout, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20', label: 'Structure' },
  content: { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20', label: 'Content' },
  positioning: { icon: Target, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20', label: 'Positioning' },
};

const DEFAULT_META = { icon: MessageSquare, color: 'text-slate-600', bg: 'bg-white dark:bg-slate-800/20 border-slate-200 dark:border-white/10', label: 'Tip' };

export default function InterviewTips({ tips, resources }) {
  if (!Array.isArray(tips) || tips.length === 0) return null;

  return (
    <Card delay={0.36}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        Interview Tips
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Based on specific moments from your transcript. Actionable changes for your next interview.
      </p>

      <div className="space-y-3.5">
        {tips.map((tip, idx) => {
          const meta = CATEGORY_META[tip.category] || DEFAULT_META;
          const Icon = meta.icon;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * idx }}
              className={`border rounded-xl p-4 ${meta.bg}`}
            >
              {/* Category badge */}
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${meta.color}`} />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg.replace('/40', '')} ${meta.color}`.replace('dark:bg-', 'dark:bg-') + ' border-' + meta.bg.match(/border-(\w+-\d+)/)?.[1] || 'border-slate-200'}>
                  {meta.label}
                </span>
              </div>

              <div className="space-y-2">
                {/* Observation */}
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">You did: </span>
                  {tip.observation}
                </div>

                {/* Suggestion */}
                <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/5 rounded-lg p-3 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide">Try instead: </span>
                  {tip.suggestion}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* STAR / behavioral prep resources */}
      {resources && resources.length > 0 && (
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-white/10">
          <ResourceLinks resources={resources} label="Practice & prep" />
        </div>
      )}
    </Card>
  );
}
