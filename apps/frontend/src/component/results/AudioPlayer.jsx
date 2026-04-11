import { useEffect, useMemo, useState } from 'react';
import { Waveform } from '../ui/waveform';
import Card from './Card';

export default function AudioPlayer({ audio, audioRef, delay = 0.3 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverProgress, setHoverProgress] = useState(null);

  const source = audio?.base64 ? `data:${audio.mimeType || 'audio/mpeg'};base64,${audio.base64}` : null;

  const generateWaveformSamples = (base64String, bars = 64) => {
    if (!base64String) return Array(bars).fill(0.25);
    const step = Math.max(1, Math.floor(base64String.length / (bars * 6)));
    const samples = [];
    let cursor = 0;
    for (let i = 0; i < bars; i += 1) {
      cursor = Math.min(cursor, base64String.length - 1);
      const slice = base64String.slice(cursor, cursor + step);
      const sum = slice.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
      const amplitude = ((sum % 97) / 97) * 0.6 + 0.25;
      samples.push(amplitude);
      cursor += step;
    }
    return samples;
  };

  const samples = useMemo(() => generateWaveformSamples(audio?.base64), [audio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const handleTimeUpdate = () => {
      if (el.duration && el.duration > 0) {
        setProgress(el.currentTime / el.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
    };
  }, [audioRef]);

  const togglePlay = async () => {
    if (!source || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play audio', err);
    }
  };

  return (
    <Card delay={delay}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Conversation replay</p>
          <p className="text-sm text-slate-500">Audio from the interview</p>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!source}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all"
        >
          {isPlaying ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.987l11.54 6.347a1.125 1.125 0 010 1.974l-11.54 6.347a1.125 1.125 0 01-1.667-.987V5.653z" />
              </svg>
              Play
            </>
          )}
        </button>
      </div>

      <div className="w-full px-4 py-6">
        <div
          className="relative cursor-pointer flex items-center w-full gap-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const seekPos = Math.max(0, Math.min(1, x / rect.width));
            setProgress(seekPos);
            if (audioRef.current) {
              audioRef.current.currentTime = seekPos * (audioRef.current.duration || 0);
              audioRef.current.play();
              setIsPlaying(true);
            }
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            setHoverProgress(Math.max(0, Math.min(1, x / rect.width)));
          }}
          onMouseLeave={() => setHoverProgress(null)}
        >
          <div className="flex-1 relative">
            <Waveform data={samples} height={64} barWidth={4} barGap={2} />
            <div
              className="absolute top-0 bottom-0 w-1 bg-emerald-500 pointer-events-none"
              style={{ left: `${progress * 100}%`, transform: 'translateX(-50%)' }}
            />
            {hoverProgress !== null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-sky-500 pointer-events-none"
                style={{ left: `${hoverProgress * 100}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={source || undefined} preload="metadata" className="hidden" />

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{source ? 'Waveform powered by ElevenLabs UI' : 'No audio attached to this run'}</span>
        <span className="text-emerald-700 font-medium">{Math.round(progress * 100)}% played</span>
      </div>
    </Card>
  );
}
