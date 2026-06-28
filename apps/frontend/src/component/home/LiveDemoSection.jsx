import React, { useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import DemoTabStrip from './parts/DemoTabStrip';
import DemoFrame from './parts/DemoFrame';
import DemoCaptionStrip from './parts/DemoCaptionStrip';

import DashboardDemo from './demos/DashboardDemo';
import BehaviouralDemo from './demos/BehaviouralDemo';
import TechnicalDemo from './demos/TechnicalDemo';

import dashboardScripts from './demos/scripts/dashboard';
import behaviouralScripts from './demos/scripts/behavioural';
import technicalScripts from './demos/scripts/technical';

import { useAutoCycle } from './hooks/useAutoCycle';
import { useDemoTimeline } from './hooks/useDemoTimeline';
import { useScriptPicker } from './hooks/useScriptPicker';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', demoKey: 'dashboard', Component: DashboardDemo },
  { id: 'behavioural', label: 'Behavioural', demoKey: 'behavioural', Component: BehaviouralDemo },
  { id: 'technical', label: 'Technical', demoKey: 'technical', Component: TechnicalDemo },
];

export default function LiveDemoSection() {
  const sectionRef = useRef(null);
  const reduce = useReducedMotion() || false;

  const picked = useScriptPicker({
    dashboard: dashboardScripts,
    behavioural: behaviouralScripts,
    technical: technicalScripts,
  });

  const { activeIndex, restartNonce, paused, advance, jumpTo, panelHandlers } = useAutoCycle({
    tabCount: TABS.length,
    reducedMotion: reduce,
    sectionRef,
  });

  const activeTab = TABS[activeIndex];
  const activeScript = picked[activeTab.demoKey];

  const handleFrame = useCallback(() => {
    // M1: no frame handlers wired. Hooks will be added per demo in M2/M3/M4.
  }, []);

  const { currentCaption, progress, elapsed } = useDemoTimeline({
    script: activeScript,
    active: true,
    paused,
    reducedMotion: reduce,
    restartKey: restartNonce,
    onFrame: handleFrame,
    onComplete: advance,
  });

  return (
    <section
      ref={sectionRef}
      id="see-it-live"
      className="relative py-16 px-4 sm:py-20 sm:px-8 lg:py-24 lg:px-12"
      aria-labelledby="live-demo-heading"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-12 lg:mb-14">
          <span className="inline-block text-xs md:text-sm font-semibold tracking-[0.18em] uppercase text-emerald-600 dark:text-emerald-400 mb-3">
            Live Product Tour
          </span>
          <motion.h2
            id="live-demo-heading"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            See how Mockly trains you
          </motion.h2>
          <p className="mt-3 md:mt-4 text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Three practice modes, one focused loop: voice, code, and the dashboard that ties them together.
          </p>
        </div>

        {/* Tab strip */}
        <div className="mb-6 md:mb-8">
          <DemoTabStrip
            tabs={TABS}
            activeIndex={activeIndex}
            progress={progress}
            onSelect={jumpTo}
          />
        </div>

        {/* Demo panel */}
        <div
          {...panelHandlers}
          className="relative"
        >
          <DemoFrame ariaLabel={`${activeTab.label} demo`} paused={paused}>
            {TABS.map((tab, i) => {
              const isActive = i === activeIndex;
              const Component = tab.Component;
              return (
                <div
                  key={tab.id}
                  role="tabpanel"
                  id={`demo-panel-${tab.id}`}
                  aria-labelledby={`demo-tab-${tab.id}`}
                  hidden={!isActive}
                  className="absolute inset-0"
                >
                  {isActive ? (
                    <Component
                      script={activeScript}
                      elapsed={elapsed}
                      reducedMotion={reduce}
                    />
                  ) : null}
                </div>
              );
            })}
          </DemoFrame>
        </div>

        {/* Caption strip */}
        <div className="mt-5 md:mt-6">
          <DemoCaptionStrip caption={currentCaption} reducedMotion={reduce} />
        </div>
      </div>
    </section>
  );
}
