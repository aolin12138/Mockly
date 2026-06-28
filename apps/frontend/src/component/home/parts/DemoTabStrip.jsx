import React, { useRef } from 'react';

/**
 * Three-pill tab strip with a progress bar under the active pill.
 *
 * Props:
 *   tabs: [{ id, label }]
 *   activeIndex: number
 *   progress: 0..1   how filled the active tab's progress bar is
 *   onSelect(index)
 */
export default function DemoTabStrip({ tabs, activeIndex, progress, onSelect }) {
  const tabRefs = useRef([]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (activeIndex + 1) % tabs.length;
      onSelect(next);
      tabRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (activeIndex - 1 + tabs.length) % tabs.length;
      onSelect(next);
      tabRefs.current[next]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelect(0);
      tabRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelect(tabs.length - 1);
      tabRefs.current[tabs.length - 1]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Live demo tabs"
      onKeyDown={handleKeyDown}
      className="mx-auto flex w-full max-w-md gap-2 sm:gap-3"
    >
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`demo-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`demo-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(i)}
            className={
              'relative flex-1 overflow-hidden rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 cursor-pointer ' +
              (isActive
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white')
            }
          >
            <span className="relative z-10">{tab.label}</span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-[2px] bg-emerald-500"
                style={{
                  width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                  transition: 'width 80ms linear',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
