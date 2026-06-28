import { useEffect, useRef, useState } from 'react';

/**
 * Timeline engine. Consumes a script and dispatches its frames + captions
 * over time. Designed so M1 can run with empty frames[] and only captions.
 *
 * Returns:
 *   currentCaption - the caption text active at the current elapsed time
 *   elapsed        - ms since the demo started (resets when key changes)
 *   progress       - 0..1 ratio of elapsed / script.duration
 *
 * Frame dispatch: when the engine crosses frame.t for an unfired frame,
 * it calls onFrame(frame). Frame handlers live in the demo components
 * themselves; the engine just walks the schedule.
 *
 * Pause behavior: when `paused` is true, elapsed time stops advancing.
 * When unpaused, it resumes from where it stopped.
 *
 * Reduced motion: when `reducedMotion` is true, the engine "snaps" to the
 * end state on mount (fires every frame once, shows last caption).
 *
 * @param {object} opts
 * @param {object} opts.script          - the script object ({ id, duration, frames, captions })
 * @param {boolean} opts.active         - whether this demo is currently the active tab
 * @param {boolean} opts.paused         - external pause signal (hover, out-of-viewport, hidden tab)
 * @param {boolean} opts.reducedMotion  - skip animation, snap to end
 * @param {number} [opts.restartKey]    - increments to force a reset (re-clicking active tab)
 * @param {(frame: object) => void} [opts.onFrame] - called when a frame fires
 * @param {() => void} [opts.onComplete] - called when elapsed reaches duration
 */
export function useDemoTimeline({
  script,
  active,
  paused,
  reducedMotion,
  restartKey,
  onFrame,
  onComplete,
}) {
  const [elapsed, setElapsed] = useState(0);
  const lastTickRef = useRef(null);
  const firedFramesRef = useRef(new Set());
  const rafRef = useRef(null);
  const completedRef = useRef(false);

  // Reset when script changes, tab becomes active fresh, or restartKey bumps
  useEffect(() => {
    setElapsed(0);
    firedFramesRef.current = new Set();
    lastTickRef.current = null;
    completedRef.current = false;
  }, [script?.id, active, restartKey]);

  // Reduced motion: snap to end immediately. Also re-snaps when restartKey
  // bumps so re-clicking the active tab with reduced motion stays at end state.
  useEffect(() => {
    if (!active || !script || !reducedMotion) return;
    setElapsed(script.duration);
    // Fire every frame once so demos can show end state
    if (onFrame) {
      for (const frame of script.frames || []) {
        if (!firedFramesRef.current.has(frame)) {
          firedFramesRef.current.add(frame);
          onFrame(frame);
        }
      }
    }
  }, [active, script, reducedMotion, restartKey, onFrame]);

  // rAF loop
  useEffect(() => {
    if (!active || !script || reducedMotion || paused) {
      lastTickRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return undefined;
    }

    const tick = (now) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setElapsed((prev) => {
        const next = Math.min(prev + delta, script.duration);

        // Fire any frames whose t has been crossed
        if (onFrame && script.frames) {
          for (const frame of script.frames) {
            if (frame.t <= next && !firedFramesRef.current.has(frame)) {
              firedFramesRef.current.add(frame);
              onFrame(frame);
            }
          }
        }

        if (next >= script.duration && !completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
    };
  }, [active, script, reducedMotion, paused, onFrame, onComplete]);

  // Resolve current caption: the latest caption whose t <= elapsed
  let currentCaption = null;
  if (script?.captions?.length) {
    let best = script.captions[0];
    for (const cap of script.captions) {
      if (cap.t <= elapsed && cap.t >= best.t) {
        best = cap;
      }
    }
    currentCaption = best?.text || null;
  }

  const progress = script?.duration ? Math.min(elapsed / script.duration, 1) : 0;

  return { currentCaption, elapsed, progress };
}
