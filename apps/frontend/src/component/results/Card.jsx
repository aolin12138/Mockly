import { motion } from 'framer-motion';

export default function Card({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_12px_34px_-24px_rgba(15,23,42,0.35)] dark:shadow-none overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/60 dark:from-white/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
      {children}
    </motion.div>
  );
}
