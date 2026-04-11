import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import ClaimRow from './ClaimRow';

const overallStyles = {
  consistent: { bg: 'bg-emerald-500', label: 'Consistent' },
  understated: { bg: 'bg-sky-500', label: 'Understated' },
  overstated: { bg: 'bg-amber-500', label: 'Overstated' },
  mixed: { bg: 'bg-slate-500', label: 'Mixed' },
};

const SEGMENTS = ['consistent', 'understated', 'overstated', 'mixed'];

export default function CvAlignmentSection({ cvAlignment }) {
  if (!cvAlignment?.available) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_34px_-24px_rgba(15,23,42,0.35)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-full bg-emerald-50 border border-emerald-200">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">CV-Interview Alignment</h2>
              <p className="text-sm text-slate-600">How your interview evidence supports your CV claims.</p>
            </div>
          </div>

          {/* Overall assessment bar */}
          <div className="mb-5">
            <div className="flex rounded-lg overflow-hidden h-2 bg-slate-100">
              {SEGMENTS.map((seg) => {
                const isActive = cvAlignment.overall === seg;
                return (
                  <motion.div
                    key={seg}
                    className={`flex-1 ${isActive ? overallStyles[seg].bg : 'bg-slate-200'} transition-colors duration-500`}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: SEGMENTS.indexOf(seg) * 0.1, duration: 0.3 }}
                    style={{ transformOrigin: 'left' }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {SEGMENTS.map((seg) => {
                const isActive = cvAlignment.overall === seg;
                return (
                  <span
                    key={seg}
                    className={`text-[11px] ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}
                  >
                    {overallStyles[seg].label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {cvAlignment.summary && (
            <p className="text-base text-slate-700 leading-relaxed mb-5 border-l-2 border-slate-300 pl-3">
              {cvAlignment.summary}
            </p>
          )}

          {/* Claims list */}
          {cvAlignment.claims && cvAlignment.claims.length > 0 && (
            <div className="space-y-2">
              {cvAlignment.claims.map((claim, idx) => (
                <ClaimRow key={idx} claim={claim} index={idx} />
              ))}
            </div>
          )}
      </div>
    </motion.div>
  );
}
