import React from 'react';
import { motion } from 'framer-motion';

export function LoadingPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden relative px-4'>
      {/* Ambient gradient blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Loading content */}
      <motion.div
        className='flex flex-col items-center gap-6 relative z-10'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Animated spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className='relative h-16 w-16'
        >
          <div className='absolute inset-0 rounded-full border-2 border-slate-700 border-opacity-30' />
          <div className='absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-cyan-400' />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className='absolute inset-1 rounded-full border-2 border-transparent border-b-purple-400 border-l-emerald-400'
          />
        </motion.div>

        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className='text-center'
        >
          <p className='text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400'>
            Processing Your Feedback
          </p>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className='text-sm text-slate-400 mt-2'
          >
            Analyzing your interview performance…
          </motion.p>
        </motion.div>

        {/* Progress indicator dots */}
        <motion.div className='flex gap-2 mt-4'>
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.2,
              }}
              className='h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400'
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default LoadingPage;
