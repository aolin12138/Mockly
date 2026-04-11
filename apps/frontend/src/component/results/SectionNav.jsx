import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function SectionNav({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id || '');
  const observerRef = useRef(null);

  useEffect(() => {
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    observerRef.current = observer;

    // Small delay to ensure DOM elements exist
    const timer = setTimeout(() => {
      sections.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [sections]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (sections.length < 2) return null;

  return (
    <>
      {/* Desktop: sticky side rail */}
      <nav className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-3">
        {sections.map((section, idx) => {
          const isActive = activeId === section.id;
          return (
            <motion.button
              key={section.id}
              type="button"
              onClick={() => scrollTo(section.id)}
              className="group relative flex items-center cursor-pointer"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + idx * 0.05 }}
            >
              {/* Dot */}
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)] scale-125'
                    : 'bg-slate-300 group-hover:bg-slate-500'
                }`}
              />

              {/* Label (shown on hover) */}
              <span
                className={`absolute left-5 whitespace-nowrap text-xs font-medium px-2 py-1 rounded-md transition-all duration-200 pointer-events-none ${
                  isActive
                    ? 'opacity-100 bg-white text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'opacity-0 group-hover:opacity-100 bg-white text-slate-600 border border-slate-200 shadow-sm'
                }`}
              >
                {section.label}
              </span>
            </motion.button>
          );
        })}
      </nav>

      {/* Mobile: horizontal pill bar */}
      <nav className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200 -mx-4 px-4 py-2 mb-4 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 flex-shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-100'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
