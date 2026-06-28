import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-cycle controller for the demo tab strip.
 *
 * State machine: holds `activeIndex` (which tab is current).
 * When `signalComplete()` is called by the timeline engine (because the
 * active demo finished its duration), advance to the next tab.
 *
 * External pause sources (any one pauses the cycle):
 *   - hover over the demo panel (caller wires via onPanelMouseEnter/Leave)
 *   - section out of viewport (IntersectionObserver, internal)
 *   - document.hidden (visibilitychange, internal)
 *   - reduced motion (external prop)
 *
 * @param {object} opts
 * @param {number} opts.tabCount         - how many tabs to cycle through
 * @param {boolean} opts.reducedMotion   - if true, never advances automatically
 * @param {React.RefObject<HTMLElement>} opts.sectionRef - the section root for IntersectionObserver
 */
export function useAutoCycle({ tabCount, reducedMotion, sectionRef }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [docVisible, setDocVisible] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  );
  const completionLockRef = useRef(false);
  // restartNonce increments on every jumpTo call, even when the target tab
  // matches the current activeIndex. Consumers can include this in their
  // effect deps to force a reset when the user re-clicks the active tab.
  const [restartNonce, setRestartNonce] = useState(0);

  // IntersectionObserver for in-view
  useEffect(() => {
    const el = sectionRef?.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting && entry.intersectionRatio > 0.15);
        }
      },
      { threshold: [0, 0.15, 0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [sectionRef]);

  // document.hidden listener
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handler = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const paused = reducedMotion || hoverPaused || !inView || !docVisible;

  const advance = useCallback(() => {
    if (completionLockRef.current) return;
    completionLockRef.current = true;
    setActiveIndex((prev) => (prev + 1) % tabCount);
    setRestartNonce((n) => n + 1);
    // Release the lock on next tick so completion events from rAF can't double-fire
    setTimeout(() => {
      completionLockRef.current = false;
    }, 50);
  }, [tabCount]);

  const jumpTo = useCallback(
    (index) => {
      if (index < 0 || index >= tabCount) return;
      setActiveIndex(index);
      // Always bump nonce so re-clicking the active tab resets progress.
      setRestartNonce((n) => n + 1);
    },
    [tabCount],
  );

  const panelHandlers = {
    onMouseEnter: () => setHoverPaused(true),
    onMouseLeave: () => setHoverPaused(false),
    onFocus: () => setHoverPaused(true),
    onBlur: () => setHoverPaused(false),
  };

  return {
    activeIndex,
    restartNonce,
    paused,
    advance,
    jumpTo,
    panelHandlers,
  };
}
