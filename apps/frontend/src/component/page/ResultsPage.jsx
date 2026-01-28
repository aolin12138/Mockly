'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Waveform } from '../ui/waveform';
import { useNavigate } from 'react-router-dom';
import { LoadingPage } from './LoadingPage';
import { SAMPLE_FEEDBACK } from './constants';

/* --- N8N Webhook Config --- */
const N8N_WEBHOOK_URL = 'https://aolin12138.app.n8n.cloud/webhook/feedback';

const N8N_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
const USE_LOCAL_SAMPLE = false; // Toggle to render the sample JSON in constants.jsx

/* --- Helper to transform feedback data --- */
function transformFeedbackData(feedbackData) {
  console.log('Transforming feedback data:', feedbackData);

  if (!feedbackData) {
    console.error('No feedback data provided');
    return null;
  }

  // Handle array response
  let data = Array.isArray(feedbackData) ? feedbackData[0] : feedbackData;

  console.log('Data object:', data);

  const feedback = data.feedback || data;
  const transcript = data.transcript;
  const audio = data.audio;

  // Log what we're working with
  console.log('Feedback object:', feedback);
  console.log('Metrics:', feedback.metrics);

  // Require metrics to be present
  if (!feedback.metrics) {
    console.error('No metrics found in feedback');
    return null;
  }

  // Transform transcript if available
  const transformedTranscript = transcript
    ? transcript.map((msg, index) => ({
      id: index + 1,
      role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
      text: msg.text || msg.message || '',
      timestart: msg.timestart ?? null,
    }))
    : null;

  return {
    overallFeedback: feedback.overall_feedback || '',
    metrics: feedback.metrics,
    transcript: transformedTranscript,
    audio,
    candidateAnswer: feedback.candidate_answer,
    starFeedback: feedback.candidate_star_feedback,
    rephrasedAnswer: feedback.rephrased_star_answer,
  };
}


// --- Audio player with official ElevenLabs Waveform ---
function AudioPlayer({ audio, audioRef }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverProgress, setHoverProgress] = useState(null);

  const source = audio?.base64 ? `data:${audio.mimeType || 'audio/mpeg'};base64,${audio.base64}` : null;

  // Generate waveform data from base64 (reuse old logic for now)
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
    const handleLoadedMetadata = () => {
      console.log('Audio loaded, duration:', el.duration);
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('loadedmetadata', handleLoadedMetadata);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
    };
  }, []);

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
    <div className='bg-white rounded-3xl shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-5 border border-slate-100'>
      <div className='flex items-center justify-between mb-3'>
        <div>
          <p className='text-sm font-semibold text-slate-900'>Conversation replay</p>
          <p className='text-xs text-slate-500'>Audio from the interview (base64 sample)</p>
        </div>
        <button
          type='button'
          onClick={togglePlay}
          disabled={!source}
          className='inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-50 px-4 py-2 text-xs font-medium hover:bg-slate-800 shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all'
        >
          {isPlaying ? (
            <>
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='h-4 w-4'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 5.25v13.5m-7.5-13.5v13.5' />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='h-4 w-4'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M5.25 5.653c0-.856.917-1.398 1.667-.987l11.54 6.347a1.125 1.125 0 010 1.974l-11.54 6.347a1.125 1.125 0 01-1.667-.987V5.653z' />
              </svg>
              Play
            </>
          )}
        </button>
      </div>

      <div className='w-full px-4 py-6'>
        <div
          className='relative cursor-pointer flex items-center w-full gap-1'
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
          <div className='flex-1 relative'>
            <Waveform data={samples} height={64} barWidth={4} barGap={2} />
            <div
              className='absolute top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] pointer-events-none'
              style={{ left: `${progress * 100}%`, transform: 'translateX(-50%)' }}
            />
            {hoverProgress !== null && (
              <div
                className='absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.9)] pointer-events-none'
                style={{ left: `${hoverProgress * 100}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={source || undefined} preload='metadata' className='hidden' />

      <div className='mt-3 flex items-center justify-between text-[11px] text-slate-500'>
        <span>{source ? 'Waveform powered by ElevenLabs UI' : 'No audio attached to this run'}</span>
        <span>{Math.round(progress * 100)}% played</span>
      </div>
    </div>
  );
}

/* --- Helpers for color based on score --- */

function getScoreColor(score) {
  if (score >= 8) {
    return {
      text: 'text-emerald-600',
      chipBg: 'bg-emerald-50',
      chipBorder: 'border-emerald-100',
      arc: '#059669',
    };
  }
  if (score >= 5) {
    return {
      text: 'text-amber-600',
      chipBg: 'bg-amber-50',
      chipBorder: 'border-amber-100',
      arc: '#d97706',
    };
  }
  return {
    text: 'text-rose-600',
    chipBg: 'bg-rose-50',
    chipBorder: 'border-rose-100',
    arc: '#e11d48',
  };
}

/* --- Radar chart (hoverable) --- */

function RadarChart({ categories, activeId, onHover }) {
  const size = 280;
  const center = size / 2;
  const maxRadius = size * 0.38;
  const maxScore = 10;

  const radarStroke = '#7c3aed'; // violet-600
  const radarFill = 'rgba(129, 140, 248, 0.20)'; // indigo-ish
  const radarPoint = '#7c3aed'; // same purple for points

  const points = categories.map((cat, index) => {
    const angle = (2 * Math.PI * index) / categories.length - Math.PI / 2;
    const r = (cat.score / maxScore) * maxRadius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, cat };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const gridLines = [];
  const levels = 5;
  for (let i = 1; i <= levels; i += 1) {
    const r = (maxRadius * i) / levels;
    const circlePoints = [];
    for (let j = 0; j < categories.length; j += 1) {
      const angle = (2 * Math.PI * j) / categories.length - Math.PI / 2;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      circlePoints.push(`${x},${y}`);
    }
    gridLines.push(
      <polygon
        key={i}
        points={circlePoints.join(' ')}
        fill='none'
        stroke='#e5e7eb'
        strokeWidth='1'
      />
    );
  }

  return (
    <div className='bg-white rounded-3xl p-6 flex flex-col items-center justify-center'>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseLeave={() => onHover(null)}
      >
        {/* grid */}
        {gridLines}
        {/* axes */}
        {categories.map((_, index) => {
          const angle = (2 * Math.PI * index) / categories.length - Math.PI / 2;
          const x = center + maxRadius * Math.cos(angle);
          const y = center + maxRadius * Math.sin(angle);
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke='#e5e7eb'
              strokeWidth='1'
            />
          );
        })}
        {/* filled polygon */}
        <polygon points={polygonPoints} fill={radarFill} stroke={radarStroke} strokeWidth='2' />
        {/* points + labels */}
        {points.map(({ x, y, cat }, index) => {
          const isActive = cat.id === activeId;
          const color = radarPoint;

          // label position slightly further out
          const angle = (2 * Math.PI * index) / categories.length - Math.PI / 2;
          const labelR = maxRadius + 16;
          const lx = center + labelR * Math.cos(angle);
          const ly = center + labelR * Math.sin(angle);

          return (
            <g key={cat.id}>
              {/* interactive point */}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 6 : 4}
                fill={color}
                onMouseEnter={() => onHover(cat.id)}
              />
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill='none'
                  stroke={color}
                  strokeWidth='2'
                  opacity='0.8'
                />
              )}

              {/* label */}
              <text
                x={lx}
                y={ly}
                textAnchor='middle'
                dominantBaseline='middle'
                className={`text-[10px] cursor-default ${isActive ? 'font-semibold text-slate-900' : 'text-slate-400'
                  }`}
                onMouseEnter={() => onHover(cat.id)}
              >
                {cat.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* --- Circular metric card (plan overview style) --- */

function MetricCard({ category, active, onHover }) {
  const percent = Math.round((category.score / 10) * 100);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  const { text, chipBg, chipBorder, arc } = getScoreColor(category.score);

  return (
    <div
      className={
        'flex items-center gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm transition ' +
        (active ? 'border-slate-400 shadow-md' : 'border-slate-200')
      }
      onMouseEnter={() => onHover(category.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className='relative'>
        <svg width='64' height='64'>
          <circle cx='32' cy='32' r={radius} stroke='#e5e7eb' strokeWidth='5' fill='none' />
          <circle
            cx='32'
            cy='32'
            r={radius}
            stroke={arc}
            strokeWidth='5'
            fill='none'
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform='rotate(-90 32 32)'
          />
        </svg>
        <div className='absolute inset-0 flex items-center justify-center'>
          <span className={`text-xs font-semibold ${text}`}>{percent}%</span>
        </div>
      </div>

      <div className='flex flex-col'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold text-slate-900'>{category.label}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipBg} ${chipBorder} ${text}`}
          >
            {category.score.toFixed(1)}/10
          </span>
        </div>
        <p className='text-[11px] text-slate-500 mt-1'>{category.blurb}</p>
      </div>
    </div>
  );
}

/* --- Helper to format time --- */

function formatTime(seconds) {
  if (seconds == null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* --- Transcript bubble UI --- */

function TranscriptCard({ transcript, audioRef }) {
  const handleTimestampClick = (timestart) => {
    if (audioRef?.current && timestart != null) {
      audioRef.current.currentTime = timestart;
      audioRef.current.play().catch(err => console.error('Failed to play', err));
    }
  };

  return (
    <div className='bg-white rounded-3xl shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-5'>
      <h2 className='text-sm font-semibold text-slate-900 mb-1'>Chat history</h2>
      <p className='text-xs text-slate-500 mb-4'>Click timestamp to jump to that moment in the audio.</p>

      <div className='max-h-72 overflow-y-auto space-y-3 pr-1'>
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
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-900 border border-slate-200 shadow-sm')
                }
              >
                <div className='mb-1 flex items-center justify-between gap-2'>
                  <span className='text-[11px] font-semibold'>
                    {m.role === 'user' ? (
                      <span className='text-slate-300'>You</span>
                    ) : (
                      <span className='text-slate-600'>Rehearse.AI</span>
                    )}
                  </span>
                  {m.timestart != null && (
                    <button
                      type='button'
                      onClick={() => handleTimestampClick(m.timestart)}
                      className={
                        'text-[10px] font-medium px-2 py-0.5 rounded-full transition hover:scale-105 cursor-pointer ' +
                        (m.role === 'user'
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                      }
                    >
                      {formatTime(m.timestart)}
                    </button>
                  )}
                </div>
                <p className='whitespace-pre-wrap text-xs'>{m.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className='text-center text-sm text-slate-500 py-8'>
            No transcript available for this interview.
          </p>
        )}
      </div>
    </div>
  );
}

/* --- Main page --- */

export default function ResultsPage() {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState(null);
  const [error, setError] = useState(null);

  // Load feedback data on mount
  useEffect(() => {
    if (USE_LOCAL_SAMPLE) {
      const transformed = transformFeedbackData(SAMPLE_FEEDBACK);
      setFeedbackData(transformed);
      setIsLoading(false);
      return;
    }

    const fetchFeedback = async () => {
      try {
        // Wait 5 seconds before fetching to allow ElevenLabs to save audio/transcript
        await new Promise(res => setTimeout(res, 5000));
        // Call n8n webhook to get feedback
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            "xi-api-key": N8N_API_KEY,
          }),
        });

        const responseText = await response.text();
        console.log('Webhook response:', responseText, 'Status:', response.status);

        if (!response.ok) {
          const errorMsg = responseText || response.statusText;
          console.error('Webhook error response:', errorMsg);
          throw new Error(`Webhook request failed: ${errorMsg}`);
        }

        if (!responseText) {
          throw new Error('Webhook returned empty response');
        }

        const feedbackData = JSON.parse(responseText);

        // Transform and store the feedback
        const transformed = transformFeedbackData(feedbackData);
        if (transformed) {
          setFeedbackData(transformed);
          localStorage.setItem('interviewFeedback', JSON.stringify(feedbackData));
          localStorage.removeItem('interviewError');
        } else {
          setError('Invalid feedback data received - missing required fields');
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
        setError(error.message || 'Failed to process interview feedback. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (error || !feedbackData) {
    return (
      <div className='min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10'>
        <div className='w-full max-w-md text-center'>
          <div className='mb-6'>
            <div className='inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4'>
              <svg
                className='h-8 w-8 text-red-600'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth='1.5'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
                />
              </svg>
            </div>
            <h1 className='text-2xl font-bold text-slate-900 mb-2'>
              {error || 'Failed to load feedback'}
            </h1>
            <p className='text-slate-600'>
              We encountered an error while processing your interview feedback. Please try again.
            </p>
          </div>

          <div className='flex flex-col gap-3'>
            <button
              type='button'
              onClick={() => {
                localStorage.removeItem('interviewFeedback');
                localStorage.removeItem('interviewError');
                window.location.reload();
              }}
              className='inline-flex items-center justify-center rounded-full bg-slate-900 text-slate-50 px-5 py-2.5 text-sm font-medium hover:bg-slate-800 shadow-sm'
            >
              Retry
            </button>
            <button
              type='button'
              onClick={() => navigate('/')}
              className='inline-flex items-center justify-center rounded-full border border-slate-300 text-slate-900 px-5 py-2.5 text-sm font-medium hover:bg-slate-50'
            >
              Start new interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, transcript, overallFeedback, audio, candidateAnswer, starFeedback, rephrasedAnswer } = feedbackData;
  const overall = (metrics.reduce((acc, c) => acc + c.score, 0) / metrics.length).toFixed(1);

  return (
    <div className='min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10'>
      <div className='w-full max-w-6xl space-y-6'>
        {/* Header */}
        <div>
          <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900'>
            Interview summary
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Here&apos;s how this mock interview went across key skills, plus a quick replay of the
            conversation.
          </p>
        </div>

        {/* Overall feedback banner */}
        {overallFeedback && (
          <div className='bg-violet-50 border border-violet-200 rounded-2xl p-5'>
            <h3 className='text-sm font-semibold text-slate-900 mb-2'>Overall feedback</h3>
            <p className='text-sm text-slate-700'>{overallFeedback}</p>
          </div>
        )}

        {/* Overall + radar card */}
        <div className='bg-white rounded-3xl shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-6 md:p-7 flex flex-col md:flex-row gap-6 items-center md:items-stretch'>
          <div className='flex-1 flex flex-col justify-between'>
            <div className='mb-4'>
              <div className='inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-50 px-3 py-1 text-xs font-medium shadow-sm'>
                <span className='inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-900'>
                  {overall}
                </span>
                <span>Overall score / 10</span>
              </div>
              <h2 className='mt-4 text-base font-semibold text-slate-900'>
                Profile across interview skills
              </h2>
              <p className='mt-2 text-xs text-slate-500'>
                Hover a point or card to highlight that skill.
              </p>
            </div>

            <div className='grid grid-cols-2 gap-2 text-[11px] text-slate-500'>
              {metrics.slice(0, 4).map((cat) => (
                <button
                  key={cat.id}
                  type='button'
                  className={
                    'flex items-center justify-between rounded-xl px-2 py-1 border text-left transition ' +
                    (activeId === cat.id
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-transparent bg-slate-100')
                  }
                  onMouseEnter={() => setActiveId(cat.id)}
                  onMouseLeave={() => setActiveId(null)}
                >
                  <span className='truncate'>{cat.label}</span>
                  <span className='ml-2 font-semibold text-slate-700'>{cat.score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className='flex-1'>
            <RadarChart categories={metrics} activeId={activeId} onHover={setActiveId} />
          </div>
        </div>

        {/* Plan-overview-style metric cards */}
        <section className='space-y-2'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-semibold text-slate-900'>Skill breakdown</p>
            <p className='text-xs text-slate-500'>
              Green = strong · Yellow = mixed · Red = needs work
            </p>
          </div>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {metrics.map((cat) => (
              <MetricCard
                key={cat.id}
                category={cat}
                active={activeId === cat.id}
                onHover={setActiveId}
              />
            ))}
          </div>
        </section>

        {/* Audio replay + transcript */}
        {audio && <AudioPlayer audio={audio} audioRef={audioRef} />}

        <TranscriptCard transcript={transcript} audioRef={audioRef} />

        {(candidateAnswer || starFeedback || rephrasedAnswer) && (
          <section className='grid gap-4 md:grid-cols-2'>
            {candidateAnswer && (
              <div className='bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-5'>
                <h3 className='text-sm font-semibold text-slate-900 mb-2'>Your answer</h3>
                <p className='text-sm text-slate-700 whitespace-pre-wrap leading-relaxed'>{candidateAnswer}</p>
              </div>
            )}

            {starFeedback && (
              <div className='bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-5'>
                <h3 className='text-sm font-semibold text-slate-900 mb-2'>STAR feedback</h3>
                <p className='text-sm text-slate-700 whitespace-pre-wrap leading-relaxed'>{starFeedback}</p>
              </div>
            )}

            {rephrasedAnswer && (
              <div className='bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_rgba(148,163,184,0.35)] p-5 md:col-span-2'>
                <h3 className='text-sm font-semibold text-slate-900 mb-2'>Rephrased STAR answer</h3>
                <p className='text-sm text-slate-700 whitespace-pre-wrap leading-relaxed'>{rephrasedAnswer}</p>
              </div>
            )}
          </section>
        )}

        {/* Retry button */}
        <div className='pt-3 flex justify-center'>
          <button
            type='button'
            onClick={() => navigate('/')}
            className='inline-flex items-center justify-center rounded-full bg-slate-900 text-slate-50 px-5 py-2.5 text-sm font-medium hover:bg-slate-800 shadow-sm'
          >
            Run another mock interview
          </button>
        </div>
      </div>
    </div>
  );
}
