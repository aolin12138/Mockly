import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleOrb from '../../ui/particle-orb';
import TypewriterText from '../parts/TypewriterText';
import ScriptedWaveform from '../parts/ScriptedWaveform';
import CalloutOverlay from '../parts/CalloutOverlay';

function behaviouralStateAtTime(script, elapsed, reducedMotion) {
  const state = {
    orbState: 'idle',
    aiQuestion: '',
    aiFollowup: '',
    candidateResponse: '',
    waveformActive: false,
    waveformLevel: 0.15,
    questionStartAt: null,
    followupStartAt: null,
    candidateStartAt: null,
    callouts: [],
    calloutHistory: new Set(),
  };

  if (!script?.frames) return state;

  if (reducedMotion) {
    const snapped = behaviouralStateAtTime(script, (script.duration ?? 12000) + 2000, false);
    snapped.orbState = 'idle';
    snapped.waveformActive = false;
    return snapped;
  }

  for (const frame of script.frames) {
    if (frame.t > elapsed) break;

    switch (frame.type) {
      case 'orb_state':
        state.orbState = frame.state || 'idle';
        break;
      case 'typewrite':
        if (frame.target === 'ai_question') {
          state.aiQuestion = frame.text || '';
          state.questionStartAt = frame.t;
        } else if (frame.target === 'ai_followup') {
          state.aiFollowup = frame.text || '';
          state.followupStartAt = frame.t;
        } else if (frame.target === 'candidate_response') {
          state.candidateResponse = frame.text || '';
          state.candidateStartAt = frame.t;
        }
        break;
      case 'waveform':
        state.waveformActive = true;
        state.waveformLevel = frame.level ?? 0.65;
        break;
      case 'callout':
        if (!state.calloutHistory.has(frame.id)) {
          state.calloutHistory.add(frame.id);
          state.callouts.push({
            id: frame.id,
            x: frame.x || 50,
            y: frame.y || 50,
            text: frame.text || '',
            align: frame.align || 'right',
          });
        }
        break;
      default:
        break;
    }
  }

  return state;
}

export default function BehaviouralDemo({ script, elapsed = 0, reducedMotion = false }) {
  const view = useMemo(
    () => behaviouralStateAtTime(script, elapsed, reducedMotion),
    [script, elapsed, reducedMotion],
  );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/50 overflow-hidden">
      {/* Conversation bubbles */}
      <div className="absolute top-3 left-0 right-0 px-4 flex flex-col items-center gap-2 z-20">
        <AnimatePresence>
          {view.aiQuestion && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-white/10 px-4 py-2.5 max-w-[85%] self-start ml-2 shadow-sm"
            >
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                Interviewer
              </p>
              <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                <TypewriterText
                  text={view.aiQuestion}
                  elapsed={elapsed}
                  startAt={view.questionStartAt ?? 0}
                  reducedMotion={reducedMotion}
                  charsPerSec={35}
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view.candidateResponse && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-900/20 backdrop-blur border border-emerald-200 dark:border-emerald-800/40 px-4 py-2.5 max-w-[85%] self-end mr-2 shadow-sm"
            >
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                You
              </p>
              <p className="text-xs md:text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                <TypewriterText
                  text={view.candidateResponse}
                  elapsed={elapsed}
                  startAt={view.candidateStartAt ?? 0}
                  reducedMotion={reducedMotion}
                  charsPerSec={40}
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view.aiFollowup && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-white/10 px-4 py-2.5 max-w-[85%] self-start ml-2 shadow-sm"
            >
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                Interviewer
              </p>
              <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                <TypewriterText
                  text={view.aiFollowup}
                  elapsed={elapsed}
                  startAt={view.followupStartAt ?? 0}
                  reducedMotion={reducedMotion}
                  charsPerSec={35}
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Orb — centered */}
      <motion.div
        className="flex-shrink-0 scale-[0.65] md:scale-90 z-10"
        animate={{ scale: reducedMotion ? 0.65 : undefined }}
        transition={{ duration: 0.3 }}
      >
        <ParticleOrb state={view.orbState} />
      </motion.div>

      {/* Waveform — bottom */}
      <div className="absolute bottom-4 md:bottom-6 left-0 right-0 flex justify-center z-10">
        <ScriptedWaveform
          active={view.waveformActive}
          level={view.waveformLevel}
          width={280}
          height={52}
          className="max-w-[280px] w-full"
        />
      </div>

      {/* Callout overlays */}
      <CalloutOverlay callouts={view.callouts} reducedMotion={reducedMotion} />
    </div>
  );
}
