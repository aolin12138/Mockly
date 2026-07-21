import { motion } from 'framer-motion';
import { Clock, Calendar, Target } from 'lucide-react';
import Card from './Card';

export default function Roadmap({ roadmap }) {
  if (!roadmap) return null;

  const phases = [
    {
      key: 'immediate',
      label: 'This Week',
      icon: Clock,
      items: roadmap.immediate,
      color: 'border-amber-400 dark:border-amber-500',
      bg: 'bg-amber-50/40 dark:bg-amber-500/5',
      text: 'text-amber-800 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    {
      key: 'short_term',
      label: 'This Month',
      icon: Calendar,
      items: roadmap.short_term,
      color: 'border-blue-400 dark:border-blue-500',
      bg: 'bg-blue-50/40 dark:bg-blue-500/5',
      text: 'text-blue-800 dark:text-blue-300',
      dot: 'bg-blue-500',
    },
    {
      key: 'medium_term',
      label: '3 Months',
      icon: Target,
      items: roadmap.medium_term,
      color: 'border-violet-400 dark:border-violet-500',
      bg: 'bg-violet-50/40 dark:bg-violet-500/5',
      text: 'text-violet-800 dark:text-violet-300',
      dot: 'bg-violet-500',
    },
  ];

  const hasAny = phases.some(p => Array.isArray(p.items) && p.items.length > 0);
  if (!hasAny) return null;

  return (
    <Card delay={0.32}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
        <Target className="w-5 h-5 text-violet-600" />
        Roadmap
      </h2>

      <div className="grid gap-3 md:grid-cols-3">
        {phases.map((phase, pi) => {
          const PhaseIcon = phase.icon;
          const items = Array.isArray(phase.items) ? phase.items : [];

          return (
            <motion.div
              key={phase.key}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 * pi }}
              className={`border-l-2 ${phase.color} ${phase.bg} rounded-r-lg p-4`}
            >
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-1.5 ${phase.text}`}>
                <PhaseIcon className="w-4 h-4" />
                {phase.label}
              </h3>
              {items.length > 0 ? (
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${phase.dot} mt-1.5 flex-shrink-0`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nothing planned</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
