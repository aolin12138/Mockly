import { motion } from 'framer-motion';
import { Sparkles, TrendingUp } from 'lucide-react';
import Card from './Card';

export default function HighlightsCard({ highlights }) {
  if (!highlights) return null;

  const { bestMoment, growthMoment } = highlights;
  if (!bestMoment && !growthMoment) return null;

  return (
    <Card delay={0.15}>
      <div className="grid gap-5 md:grid-cols-2">
        {/* Best Moment */}
        {bestMoment && (
          <motion.div
            className="border-l-4 border-emerald-300 pl-4 py-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-700">Best Moment</span>
            </div>
            {bestMoment.context && (
              <p className="text-sm text-slate-500 mb-1.5">{bestMoment.context}</p>
            )}
            <p className="text-base text-slate-700 leading-relaxed">{bestMoment.observation}</p>
          </motion.div>
        )}

        {/* Growth Moment */}
        {growthMoment && (
          <motion.div
            className="border-l-4 border-amber-300 pl-4 py-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-semibold text-amber-700">Growth Opportunity</span>
            </div>
            {growthMoment.context && (
              <p className="text-sm text-slate-500 mb-1.5">{growthMoment.context}</p>
            )}
            <p className="text-base text-slate-700 leading-relaxed">{growthMoment.observation}</p>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
