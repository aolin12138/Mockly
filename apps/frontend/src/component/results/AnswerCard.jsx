import { motion } from 'framer-motion';
import { FileText, Edit3, AlertTriangle } from 'lucide-react';
import StarPipeline from './StarPipeline';
import { formatDimensionName } from './helpers';

const qualityStyles = {
  strong: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
  adequate: { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
  weak: { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', text: 'text-red-700 dark:text-red-300' },
};

/**
 * Infer which STAR elements the ORIGINAL answer was missing from the 'why' text.
 * DeepSeek explains "lacks a clear Situation" → S is ✗, etc.
 */
function inferOriginalStar(why, worthRewriting) {
  if (!worthRewriting) return { situation: true, task: true, action: true, result: true };
  const w = (why || '').toLowerCase();
  const missing = {
    situation: !/lacks?\s+.*?\b(situation|context|setting|background|scene|setup)\b/i.test(w),
    task:      !/lacks?\s+.*?\b(task|role|responsibility|framing|goal|objective)\b/i.test(w),
    action:    !/lacks?\s+.*?\b(action|approach|how|method|process|step|solution)\b/i.test(w),
    result:    !/lacks?\s+.*?\b(result|impact|outcome|metric|quantif|measure|roi|benefit)\b/i.test(w),
  };
  // If none were flagged as missing, assume all were missing (safe default)
  const anyFlagged = Object.values(missing).some(v => !v);
  return anyFlagged ? missing : { situation: false, task: false, action: false, result: false };
}

export default function AnswerCard({ answer, index }) {
  const style = qualityStyles[answer.quality] || qualityStyles.adequate;

  const hasRewrite = answer.star &&
    (answer.star.situation || answer.star.task || answer.star.action || answer.star.result);

  // Diagnose what the ORIGINAL was missing
  const originalStar = inferOriginalStar(answer.observation, answer.quality === 'weak');
  const originalPresent = Object.values(originalStar).filter(Boolean).length;

  // Format the rewritten STAR as readable text
  const starText = hasRewrite ? [
    answer.star.situation && { label: 'Situation', text: answer.star.situation },
    answer.star.task && { label: 'Task', text: answer.star.task },
    answer.star.action && { label: 'Action', text: answer.star.action },
    answer.star.result && { label: 'Result', text: answer.star.result },
  ].filter(Boolean) : [];

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
      <p className="text-base font-medium text-slate-900 dark:text-slate-100 mb-3 leading-relaxed">{answer.question}</p>

      {/* ── STAR Diagnostic Pipeline (orig answer quality, below question) ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="pt-2 pb-3">
          <StarPipeline star={originalStar} />
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          {originalPresent === 4 ? 'All elements present' :
           originalPresent === 0 ? 'All elements need work' :
           `${4 - originalPresent} of 4 elements missing`}
        </span>
      </div>

      {/* ── Original answer ── */}
      {answer.originalAnswer && (
        <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your answer</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
            &ldquo;{answer.originalAnswer}&rdquo;
          </p>
        </div>
      )}

      {/* ── Restructured version (full text, not just pipeline) ── */}
      {hasRewrite && (
        <div className="mb-4 p-4 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/5">
          <div className="flex items-center gap-1.5 mb-3">
            <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Restructured version</span>
          </div>
          <div className="space-y-3">
            {starText.map((section) => (
              <div key={section.label}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {section.label}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">
                  {section.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quality badge + feedback ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <motion.span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${style.bg} ${style.border} ${style.text}`}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 * index + 0.5, type: 'spring', stiffness: 400 }}
        >
          {answer.quality === 'weak' ? 'Needs restructuring' :
           answer.quality === 'strong' ? 'Well structured' : 'Adequate'}
        </motion.span>
      </div>

      {answer.observation && (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3 pl-3 border-l-2 border-amber-300 dark:border-amber-500/30">
          {answer.observation}
        </p>
      )}

      {!hasRewrite && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3 leading-relaxed">
          Your answer was already well-structured. No rewrite needed.
        </p>
      )}
    </motion.div>
  );
}
