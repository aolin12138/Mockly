import React from 'react';

/**
 * Hand-styled code display — NOT a real editor. Shows syntax-highlighted
 * code in a pre-formatted block with line numbers. Lines reveal one at a time
 * via `visibleLines`.
 *
 * Tokens are pre-colored by the script (each line is an array of { text, className }).
 * This keeps the component purely presentational and the bundle tiny.
 *
 * Diff mode: when `diffLineIndex` is set, that line gets a red removed
 * background and `diffLineReplacement` is shown as a green added line
 * immediately after.
 *
 * @param {object} props
 * @param {{ text: string, className: string }[][]} props.lines - tokenized lines
 * @param {number} [props.visibleLines] - how many lines to show
 * @param {number} [props.diffLineIndex] - line to show as removed (0-indexed)
 * @param {{ text: string, className: string }[]} [props.diffLineReplacement] - replacement tokens
 * @param {string} [props.language] - label for the gutter (e.g. "JS")
 * @param {boolean} [props.visible]
 */
export default function MiniCodeEditor({
  lines = [],
  visibleLines = lines.length,
  diffLineIndex = null,
  diffLineReplacement = null,
  language = 'JS',
  visible = true,
}) {
  if (!visible) return null;

  const shownLines = lines.slice(0, visibleLines);

  return (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-900 rounded-xl overflow-hidden border border-white/10">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-slate-800/50">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
          {language}
        </span>
        <div className="flex gap-1 ml-auto">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-hidden p-2 md:p-3 font-mono text-[9px] md:text-[11px] leading-relaxed">
        <pre className="whitespace-pre-wrap break-all m-0">
          {shownLines.map((tokens, lineIdx) => {
            const isRemovedLine = diffLineIndex !== null && lineIdx === diffLineIndex;
            return (
              <div
                key={lineIdx}
                className={`flex ${
                  isRemovedLine
                    ? 'bg-red-900/30 -mx-2 px-2'
                    : ''
                }`}
              >
                <span className="text-slate-600 select-none w-6 flex-shrink-0 text-right mr-2">
                  {lineIdx + 1}
                </span>
                <span>
                  {tokens.map((tok, j) => (
                    <span key={j} className={tok.className || 'text-slate-300'}>
                      {tok.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
          {diffLineReplacement && (
            <div className="flex bg-emerald-900/30 -mx-2 px-2">
              <span className="text-slate-600 select-none w-6 flex-shrink-0 text-right mr-2">
                {diffLineIndex + 1}
              </span>
              <span>
                {diffLineReplacement.map((tok, j) => (
                  <span key={j} className={tok.className || 'text-emerald-300'}>
                    {tok.text}
                  </span>
                ))}
              </span>
            </div>
          )}
        </pre>
      </div>
    </div>
  );
}
