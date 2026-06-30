import { motion } from 'framer-motion';

export default function ScoreArc({ score, maxScore = 100, size = 140, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(score / maxScore, 0), 1);
  const arcLength = circumference * 0.75; // 270-degree arc
  const filledLength = arcLength * percentage;
  const gapLength = arcLength - filledLength;

  // Rotation to start from bottom-left (135 degrees)
  const rotation = 135;

  // Color based on score percentage
  let gradientId = 'scoreGradient';
  let color1 = '#10b981'; // emerald
  let color2 = '#06b6d4'; // cyan
  if (percentage < 0.5) {
    color1 = '#ef4444';
    color2 = '#f97316';
  } else if (percentage < 0.7) {
    color1 = '#f59e0b';
    color2 = '#f97316';
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color1} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
          <filter id="arcGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
        />

        {/* Filled arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          filter="url(#arcGlow)"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filledLength} ${circumference - filledLength}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score}
        </motion.span>
        <motion.span
          className="text-xs text-slate-500 dark:text-slate-400 -mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          / {maxScore}
        </motion.span>
      </div>
    </div>
  );
}
