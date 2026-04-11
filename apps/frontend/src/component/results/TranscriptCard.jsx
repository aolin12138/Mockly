import Card from './Card';
import { formatTime } from './helpers';

export default function TranscriptCard({ transcript, audioRef, delay = 0.4 }) {
  const handleTimestampClick = (timestart) => {
    if (audioRef?.current && timestart != null) {
      audioRef.current.currentTime = timestart;
      audioRef.current.play().catch(err => console.error('Failed to play', err));
    }
  };

  return (
    <Card delay={delay}>
      <h2 className="text-base font-semibold text-slate-900 mb-1">Chat history</h2>
      <p className="text-sm text-slate-500 mb-4">Click timestamp to jump to that moment in the audio.</p>

      <div className="max-h-72 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {transcript && transcript.length > 0 ? (
          transcript.map((m) => (
            <div
              key={m.id}
              className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ' +
                  (m.role === 'user'
                    ? 'bg-emerald-50 text-slate-900 border border-emerald-200'
                    : 'bg-slate-100 text-slate-800 border border-slate-200')
                }
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {m.role === 'user' ? (
                      <span className="text-emerald-700">You</span>
                    ) : (
                      <span className="text-sky-700">Interviewer</span>
                    )}
                  </span>
                  {m.timestart != null && (
                    <button
                      type="button"
                      onClick={() => handleTimestampClick(m.timestart)}
                      className={
                        'text-[11px] font-medium px-2 py-0.5 rounded-full transition hover:scale-105 cursor-pointer ' +
                        (m.role === 'user'
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                      }
                    >
                      {formatTime(m.timestart)}
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-slate-500 py-8">
            No transcript available for this interview.
          </p>
        )}
      </div>
    </Card>
  );
}
