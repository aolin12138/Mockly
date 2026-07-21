import Card from './Card';
import { formatTime } from './helpers';

export default function TranscriptCard({ transcript, audio, audioRef, delay = 0.4 }) {
  const source = audio?.base64 ? `data:${audio.mimeType || 'audio/mpeg'};base64,${audio.base64}` : null;

  const playFromLine = (line) => {
    if (!source || !audioRef?.current || line?.timestart == null) return;
    audioRef.current.currentTime = line.timestart;
    audioRef.current.play().catch((err) => console.error('Failed to play', err));
  };

  const toggleMainPlayback = () => {
    if (!source || !audioRef?.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch((err) => console.error('Failed to play', err));
      return;
    }
    audioRef.current.pause();
  };

  return (
    <Card delay={delay}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Transcript Replay</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Play from any sentence to review specific answers quickly.</p>
        </div>
        <button
          type="button"
          onClick={toggleMainPlayback}
          disabled={!source}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 hover:-translate-y-0.5 hover:shadow-sm dark:hover:shadow-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
        >
          {source ? 'Play / Pause Audio' : 'Audio unavailable'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/40 p-3 max-h-[30rem] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {transcript && transcript.length > 0 ? (
          transcript.map((m, index) => (
            <div
              key={m.id}
              className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={
                  'max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm dark:shadow-none transition-all duration-200 hover:shadow-md dark:hover:shadow-none hover:-translate-y-0.5 ' +
                  (m.role === 'user'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-slate-900 dark:text-slate-100 border border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-white dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10')
                }
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {m.role === 'user' ? (
                      <span className="text-emerald-700 dark:text-emerald-400">You</span>
                    ) : (
                      <span className="text-sky-700 dark:text-sky-400">Interviewer</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => playFromLine(m)}
                      disabled={!source || m.timestart == null}
                      className={
                        'group inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-200 ' +
                        (source && m.timestart != null
                          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 hover:scale-105 hover:-translate-y-0.5 cursor-pointer'
                          : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed')
                      }
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="h-3 w-3 transition-transform duration-200 group-hover:scale-110">
                        <path d="M5.5 4.5A1.5 1.5 0 007 5.99v8.02a1.5 1.5 0 002.25 1.299l6.96-4.01a1.5 1.5 0 000-2.598l-6.96-4.01A1.5 1.5 0 005.5 4.5z" />
                      </svg>
                      {m.timestart != null ? formatTime(m.timestart) : 'No timestamp'}
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
            No transcript available for this interview.
          </p>
        )}
      </div>

      <audio ref={audioRef} src={source || undefined} preload="metadata" className="hidden" />
    </Card>
  );
}
