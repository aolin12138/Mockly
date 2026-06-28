import React, { useMemo } from 'react';
import ParticleOrb from '../../ui/particle-orb';
import TypewriterText from '../parts/TypewriterText';
import ScriptedWaveform from '../parts/ScriptedWaveform';

/**
 * Derive behavioural demo state at `elapsed` ms from script frames.
 * Pure function. No side effects.
 *
 * Frame types used:
 *   orb_state   — sets orb to 'idle' | 'listening' | 'speaking' | 'thinking'
 *   typewrite   — starts typing into target ('ai_question' or 'ai_followup')
 *   waveform    — sets the waveform amplitude level
 */
function behaviouralStateAtTime(script, elapsed, reducedMotion) {
  const state = {
    orbState: 'idle',
    aiQuestion: '',
    aiFollowup: '',
    waveformActive: false,
    waveformLevel: 0.15,
    questionStartAt: null,
    followupStartAt: null,
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
        }
        break;
      case 'waveform':
        state.waveformActive = true;
        // amplitude_curve is a named pattern; for now we use a fixed level
        // from the frame (default 0.65 for "speaking" energy)
        state.waveformLevel = frame.level ?? 0.65;
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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/50">
      {/* Transcript area */}
      <div className="absolute top-3 left-0 right-0 px-4 text-center space-y-2">
        {view.aiQuestion && (
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500 mr-1.5">
              Interviewer
            </span>
            <TypewriterText
              text={view.aiQuestion}
              elapsed={elapsed}
              startAt={view.questionStartAt ?? 0}
              reducedMotion={reducedMotion}
              charsPerSec={40}
            />
          </p>
        )}
        {view.aiFollowup && (
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500 mr-1.5">
              Interviewer
            </span>
            <TypewriterText
              text={view.aiFollowup}
              elapsed={elapsed}
              startAt={view.followupStartAt ?? 0}
              reducedMotion={reducedMotion}
              charsPerSec={40}
            />
          </p>
        )}
      </div>

      {/* Orb — centered */}
      <div className="flex-shrink-0 scale-[0.65] md:scale-90">
        <ParticleOrb state={view.orbState} />
      </div>

      {/* Waveform — bottom */}
      <div className="absolute bottom-4 md:bottom-6 left-0 right-0 flex justify-center">
        <ScriptedWaveform
          active={view.waveformActive}
          level={view.waveformLevel}
          width={280}
          height={52}
          className="max-w-[280px] w-full"
        />
      </div>
    </div>
  );
}
