import React from 'react';

/**
 * Pure typewriter: shows the substring of `text` that should be visible
 * at the given `elapsed` time, assuming typing started at `startAt`.
 *
 * No internal state — purely derived from elapsed. Works seamlessly with
 * pause / restart because elapsed is owned upstream.
 *
 * @param {object} props
 * @param {string} props.text          - full text to type out
 * @param {number} props.elapsed       - current timeline elapsed (ms)
 * @param {number} props.startAt       - ms at which typing should begin
 * @param {number} [props.charsPerSec] - typing speed (default 40 = ~25ms/char)
 * @param {boolean} [props.reducedMotion] - if true, show full text instantly when startAt reached
 * @param {boolean} [props.showCursor]    - show a blinking caret while typing
 * @param {string} [props.className]
 */
export default function TypewriterText({
  text,
  elapsed,
  startAt = 0,
  charsPerSec = 40,
  reducedMotion = false,
  showCursor = false,
  className = '',
}) {
  if (!text) return null;
  if (elapsed < startAt) return <span className={className} aria-hidden="true" />;

  const elapsedSinceStart = elapsed - startAt;
  let visibleCount;
  if (reducedMotion) {
    visibleCount = text.length;
  } else {
    visibleCount = Math.min(
      text.length,
      Math.floor((elapsedSinceStart / 1000) * charsPerSec),
    );
  }
  const visible = text.slice(0, visibleCount);
  const isTyping = visibleCount < text.length && !reducedMotion;

  return (
    <span className={className}>
      {visible}
      {showCursor && isTyping && (
        <span
          className="inline-block w-[2px] h-[1em] bg-current align-[-0.15em] ml-[1px] animate-pulse"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
