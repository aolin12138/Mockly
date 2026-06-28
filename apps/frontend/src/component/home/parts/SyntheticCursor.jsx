import React from 'react';

/**
 * A small SVG cursor that animates to (x, y) positions via CSS transform.
 *
 * Hidden when `visible` is false. Uses transform-only animation per
 * taste-skill §6.A. Decorative (aria-hidden).
 *
 * Positions are in percentages of the demo frame (so layout-independent):
 *   x, y: 0 to 100
 *
 * @param {object} props
 * @param {number} props.x
 * @param {number} props.y
 * @param {boolean} [props.visible]
 * @param {boolean} [props.clicking] - briefly scales down to simulate click
 * @param {number} [props.transitionMs] - duration of move (default 500)
 */
export default function SyntheticCursor({
  x = 50,
  y = 50,
  visible = true,
  clicking = false,
  transitionMs = 500,
  className = '',
}) {
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className={`absolute pointer-events-none ${className}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: clicking ? 'translate(-2px, -2px) scale(0.9)' : 'translate(-2px, -2px) scale(1)',
        transition: 'transform 150ms ease-out, opacity 200ms',
        zIndex: 30,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 2L17 9.5L10 11L7 18L3 2Z"
          fill="white"
          stroke="#0F172A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
