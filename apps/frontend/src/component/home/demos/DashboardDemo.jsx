import React, { useMemo } from 'react';
import MiniScoreArc from '../parts/MiniScoreArc';
import MiniSessionCard from '../parts/MiniSessionCard';
import MiniGoalPanel from '../parts/MiniGoalPanel';
import SyntheticCursor from '../parts/SyntheticCursor';

// Ease-out cubic; gentle deceleration toward target value.
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Derive demo state at `elapsed` ms by walking the script frames.
 * Pure function. No side effects. Restart is just elapsed=0.
 */
function dashboardStateAtTime(script, elapsed, reducedMotion) {
  const goal = script?.goal || { from: 0, to: 0, total: 5 };
  const state = {
    scoreCardVisible: false,
    scoreValue: 0,
    sessionRowVisible: false,
    sessionCardsRevealed: [false, false, false],
    cursor: { x: 100, y: 50, visible: false },
    hoveredCardIndex: null,
    starProgress: 0,
    goalCurrent: goal.from,
    goalPulse: false,
  };

  if (!script?.frames) return state;

  if (reducedMotion) {
    // Snap to end by simulating elapsed past all animation durations, then
    // hide cursor + pulse. This avoids hardcoding values per script.
    const snapped = dashboardStateAtTime(script, (script?.duration ?? 12000) + 2000, false);
    snapped.cursor.visible = false;
    snapped.goalPulse = false;
    return snapped;
  }

  for (const frame of script.frames) {
    if (frame.t > elapsed) break;
    const dt = elapsed - frame.t;

    switch (frame.type) {
      case 'materialize':
        if (frame.target === 'score-card') state.scoreCardVisible = true;
        if (frame.target === 'session-row') {
          state.sessionRowVisible = true;
          state.sessionCardsRevealed[0] = dt >= 0;
          state.sessionCardsRevealed[1] = dt >= 80;
          state.sessionCardsRevealed[2] = dt >= 160;
        }
        break;
      case 'score_arc': {
        const ratio = Math.min(1, dt / 1200);
        state.scoreValue = (frame.to ?? 0) * easeOutCubic(ratio);
        break;
      }
      case 'cursor_to':
        state.cursor.visible = true;
        state.cursor.x = frame.x ?? state.cursor.x;
        state.cursor.y = frame.y ?? state.cursor.y;
        break;
      case 'card_hover':
        state.hoveredCardIndex = frame.index ?? null;
        state.starProgress = Math.min(1, dt / 800);
        break;
      case 'goal_progress': {
        const ratio = Math.min(1, dt / 800);
        state.goalCurrent = goal.from + (goal.to - goal.from) * easeOutCubic(ratio);
        state.goalPulse = dt < 700;
        break;
      }
      default:
        break;
    }
  }

  return state;
}

export default function DashboardDemo({ script, elapsed = 0, reducedMotion = false }) {
  const view = useMemo(
    () => dashboardStateAtTime(script, elapsed, reducedMotion),
    [script, elapsed, reducedMotion],
  );

  const sessions = script?.sessions || [];
  const goal = script?.goal || { label: 'Goal', total: 5 };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-100 dark:bg-slate-950/50">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">M</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            Mockly
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">/ Dashboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 dark:text-slate-300">
            {script?.user?.name || 'You'}
          </span>
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
            {script?.user?.initial || '?'}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left rail */}
        <div className="w-10 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 py-3 flex flex-col items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-md ${
                i === 0
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : 'bg-slate-200 dark:bg-white/5'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 grid grid-cols-12 gap-3 relative overflow-hidden">
          {/* Score card */}
          <div
            className={`col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-3 flex items-center justify-center transition-opacity duration-300`}
            style={{ opacity: view.scoreCardVisible ? 1 : 0 }}
          >
            <MiniScoreArc value={view.scoreValue} size={96} strokeWidth={7} />
          </div>

          {/* Goal panel */}
          <div className="col-span-7 flex flex-col gap-3">
            <MiniGoalPanel
              label={goal.label}
              current={view.goalCurrent}
              total={goal.total}
              pulse={view.goalPulse}
            />
            {/* Sub-stats placeholder pill row */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sessions
                </p>
                <p
                  className="text-base font-bold text-slate-900 dark:text-white"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  12
                </p>
              </div>
              <div className="flex-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Streak
                </p>
                <p
                  className="text-base font-bold text-slate-900 dark:text-white"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  5d
                </p>
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="col-span-12">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Recent sessions
            </p>
            <div
              className="grid grid-cols-3 gap-2 transition-opacity duration-200"
              style={{ opacity: view.sessionRowVisible ? 1 : 0 }}
            >
              {sessions.map((s, i) => (
                <MiniSessionCard
                  key={i}
                  topic={s.topic}
                  score={s.score}
                  hovered={view.hoveredCardIndex === i}
                  starProgress={view.hoveredCardIndex === i ? view.starProgress : 0}
                  visible={view.sessionCardsRevealed[i]}
                />
              ))}
            </div>
          </div>

          {/* Synthetic cursor — hidden on mobile per spec §12 */}
          <SyntheticCursor
            x={view.cursor.x}
            y={view.cursor.y}
            visible={view.cursor.visible}
            className="hidden md:block"
          />
        </div>
      </div>
    </div>
  );
}
