import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import StarPipeline from './StarPipeline';
import { formatDimensionName } from './helpers';

const qualityStyles = {
  strong: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  adequate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  weak: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
};

export default function AnswerCard({ answer, index }) {
  const [expanded, setExpanded] = useState(false);
  const style = qualityStyles[answer.quality] || qualityStyles.adequate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-white/10 transition-colors duration-300"
    >
      {/* Domain tag */}
      {answer.domain && (
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">
          Domain: {formatDimensionName(answer.domain)}
        </span>
      )}

      {/* Question */}
      <p className="text-base font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">{answer.question}</p>

      {/* STAR Pipeline + Quality badge row */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div className="pt-2 pb-3">
          <StarPipeline star={answer.star} />
        </div>

        <motion.span
          className={`text-sm font-semibold px-3 py-1 rounded-full border ${style.bg} ${style.border} ${style.text}`}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 * index + 0.5, type: 'spring', stiffness: 400 }}
        >
          {answer.quality?.[0]?.toUpperCase() + answer.quality?.slice(1)}
        </motion.span>
      </div>

      {/* Expandable observation */}
      {answer.observation && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer mt-1"
          >
            <MessageSquare className="w-3 h-3" />
            {expanded ? 'Hide feedback' : 'See feedback'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <motion.div
            initial={false}
            animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-3 pl-3 border-l-2 border-slate-300 dark:border-white/10">
              {answer.observation}
            </p>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
