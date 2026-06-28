import React, { useEffect, useRef } from 'react';

/**
 * Lightweight canvas waveform driven by a pre-baked amplitude curve
 * (not a real mic stream). Much lighter than LiveWaveform for a scripted demo.
 *
 * When `active` is true and `level > 0`, the waveform shows an animated
 * fill based on `level` (0..1). The animation loop is a simple rAF
 * with requestAnimationFrame, running at ~30fps.
 *
 * Scaled down 30% on mobile as a prop from the parent; canvas dimensions
 * are the caller's responsibility.
 *
 * @param {object} props
 * @param {boolean} props.active   - whether waveform is animating
 * @param {number} [props.level]   - current amplitude 0..1
 * @param {number} [props.width]   - canvas width
 * @param {number} [props.height]  - canvas height (default 64)
 * @param {string} [props.barColor] - tailwind color (default emerald-500)
 * @param {string} [props.className]
 */
export default function ScriptedWaveform({
  active = false,
  level = 0.15,
  width = 320,
  height = 64,
  barColor = 'rgb(16, 185, 129)',
  className = '',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const barCount = 25;
    const barWidth = width / barCount;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (!active || level <= 0) {
        // Flat line
        ctx.fillStyle = barColor;
        ctx.globalAlpha = 0.25;
        const y = height / 2 - 1;
        ctx.fillRect(0, y, width, 2);
        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      phaseRef.current += 0.08;
      for (let i = 0; i < barCount; i++) {
        const freq = (i / barCount) * Math.PI * 3;
        const amp =
          level * 0.8 * (0.4 + 0.6 * Math.sin(freq + phaseRef.current * 2));
        const barH = Math.max(3, amp * height * 0.7);

        ctx.fillStyle = barColor;
        ctx.globalAlpha = 0.25 + amp * 1.2;

        const x = i * barWidth + 1;
        const y = (height - barH) / 2;
        const w = barWidth - 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, barH, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, level, width, height, barColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-hidden="true"
      className={`block ${className}`}
    />
  );
}
