import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import { LayoutDashboard, MessageSquare, Code2 } from 'lucide-react';

const DEMOS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    src: '/dashboard-demo.mp4',
    description: 'Track sessions, scores, goals, and feedback all in one place.',
  },
  {
    id: 'behavioural',
    label: 'Behavioural',
    icon: MessageSquare,
    src: '/behavioural-demo.mp4',
    description: 'Voice interview with live AI agent, instant feedback after every session.',
  },
  {
    id: 'technical',
    label: 'Technical',
    icon: Code2,
    src: '/technical-demo.mp4',
    description: 'Real coding problems, test runner, live agent hints, and code review.',
  },
];

const CYCLE_INTERVAL_MS = 8000;

export default function DemoSection() {
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef(null);
  const videoRefs = useRef([]);

  const advance = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % DEMOS.length);
  }, []);

  /* Auto-cycle */
  useEffect(() => {
    if (prefersReducedMotion) return;
    intervalRef.current = setInterval(() => {
      if (!isHovered) advance();
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isHovered, advance, prefersReducedMotion]);

  /* Play/pause videos based on active tab */
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (idx === activeIdx) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [activeIdx]);

  const active = DEMOS[activeIdx];
  const Icon = active.icon;

  return (
    <section
      className="relative py-16 px-4 sm:py-20 sm:px-8 lg:py-24 lg:px-12"
      aria-labelledby="live-demo-heading"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-10">
          <span className="inline-block text-xs md:text-sm font-semibold tracking-[0.18em] uppercase text-emerald-600 dark:text-emerald-400 mb-3">
            Live Product Tour
          </span>
          <h2
            id="live-demo-heading"
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            See how Mockly trains you
          </h2>
          <p className="mt-3 md:mt-4 text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Three practice modes, one focused loop: voice, code, and the dashboard that ties them together.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 md:gap-3 mb-6">
          {DEMOS.map((demo, idx) => {
            const DemoIcon = demo.icon;
            const isActive = idx === activeIdx;
            return (
              <button
                key={demo.id}
                onClick={() => setActiveIdx(idx)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-xl text-sm font-semibold
                  transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50
                  ${isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.12)]'
                    : 'bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }
                `}
                aria-selected={isActive}
                role="tab"
              >
                <DemoIcon size={18} className={isActive ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} />
                <span className="hidden sm:inline">{demo.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab description */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4 md:mb-6">
          {active.description}
        </p>

        {/* Video container */}
        <div
          className="relative rounded-xl md:rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900 shadow-lg dark:shadow-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {DEMOS.map((demo, idx) => (
            <video
              key={demo.id}
              ref={(el) => (videoRefs.current[idx] = el)}
              src={demo.src}
              muted
              loop
              playsInline
              preload="auto"
              className={`w-full h-auto block transition-opacity duration-500 ${idx === activeIdx ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0'}`}
              aria-label={`Mockly ${demo.label} demo`}
              aria-hidden={idx !== activeIdx}
            />
          ))}
        </div>

        {/* Progress dots + Try anchor */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex gap-2" role="tablist" aria-label="Demo slides">
            {DEMOS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === activeIdx
                    ? 'bg-emerald-500 w-5'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
                aria-label={`Show ${DEMOS[idx].label} demo`}
              />
            ))}
          </div>
          <a
            href="#question-lab"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            Try a sample question yourself
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
