'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Waveform } from '../ui/waveform';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingPage } from './LoadingPage';
import { SAMPLE_FEEDBACK } from './constants';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, TrendingUp, Lightbulb, ArrowRight, Target } from 'lucide-react';

/* --- N8N Webhook Config --- */
const N8N_WEBHOOK_URL = 'https://aolin12138.app.n8n.cloud/webhook/feedback';
const USE_LOCAL_SAMPLE = false;

/* --- Helper to transform feedback data --- */
function transformFeedbackData(feedbackData) {
  console.log('Transforming feedback data:', feedbackData);

  if (!feedbackData) {
    console.error('No feedback data provided');
    return null;
  }

  let data = Array.isArray(feedbackData) ? feedbackData[0] : feedbackData;
  const feedback = data.feedback || data;
  const transcript = data.transcript;
  const audio = data.audio;

  return {
    overallScore: feedback.overall_score ?? null,
    overallAssessment: feedback.overall_assessment || null,
    dimensionScores: feedback.dimension_scores || [],
    strengths: feedback.strengths || [],
    areasForImprovement: feedback.areas_for_improvement || [],
    overallRecommendation: feedback.overall_recommendation || null,
    transcript: transcript
      ? transcript.map((msg, index) => ({
        id: index + 1,
        role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
        text: msg.text || msg.message || '',
        timestart: msg.timestart ?? null,
      }))
      : null,
    audio,
  };
}

/* --- Card Component --- */
function Card({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
      {children}
    </motion.div>
  );
}

/* --- Audio Player Component --- */
function AudioPlayer({ audio, audioRef }) {
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
    const handleLoadedMetadata = () => console.log('Audio loaded, duration:', el.duration);
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
    <Card delay={0.3}>
      <div className='flex items-center justify-between mb-3'>
        <div>
          <p className='text-sm font-semibold text-white'>Conversation replay</p>
          <p className='text-xs text-slate-400'>Audio from the interview</p>
        </div>
        <button
          type='button'
          onClick={togglePlay}
          disabled={!source}
          className='inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-2 text-xs font-medium hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all'
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
              className='absolute top-0 bottom-0 w-1 bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)] pointer-events-none'
              style={{ left: `${progress * 100}%`, transform: 'translateX(-50%)' }}
            />
            {hoverProgress !== null && (
              <div
                className='absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] pointer-events-none'
                style={{ left: `${hoverProgress * 100}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={source || undefined} preload='metadata' className='hidden' />

      <div className='mt-3 flex items-center justify-between text-[11px] text-slate-500'>
        <span>{source ? 'Waveform powered by ElevenLabs UI' : 'No audio attached to this run'}</span>
        <span className="text-emerald-400 font-medium">{Math.round(progress * 100)}% played</span>
      </div>
    </Card>
  );
}

/* --- Helper to format time --- */
function formatTime(seconds) {
  if (seconds == null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* --- Transcript Card --- */
function TranscriptCard({ transcript, audioRef }) {
  const handleTimestampClick = (timestart) => {
    if (audioRef?.current && timestart != null) {
      audioRef.current.currentTime = timestart;
      audioRef.current.play().catch(err => console.error('Failed to play', err));
    }
  };

  return (
    <Card delay={0.4}>
      <h2 className='text-sm font-semibold text-white mb-1'>Chat history</h2>
      <p className='text-xs text-slate-400 mb-4'>Click timestamp to jump to that moment in the audio.</p>

      <div className='max-h-72 overflow-y-auto space-y-3 pr-1 custom-scrollbar'>
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
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                    : 'bg-slate-800/40 text-slate-100 border border-white/5')
                }
              >
                <div className='mb-1 flex items-center justify-between gap-2'>
                  <span className='text-[11px] font-semibold'>
                    {m.role === 'user' ? (
                      <span className='text-emerald-400'>You</span>
                    ) : (
                      <span className='text-cyan-400'>Rehearse.AI</span>
                    )}
                  </span>
                  {m.timestart != null && (
                    <button
                      type='button'
                      onClick={() => handleTimestampClick(m.timestart)}
                      className={
                        'text-[10px] font-medium px-2 py-0.5 rounded-full transition hover:scale-105 cursor-pointer ' +
                        (m.role === 'user'
                          ? 'bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50')
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
    </Card>
  );
}

/* --- Dimension Scores Component --- */
function DimensionScoresDisplay({ dimensionScores }) {
  if (!dimensionScores || dimensionScores.length === 0) return null;

  return (
    <Card delay={0.2}>
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-emerald-400" />
        Dimension Scores
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {dimensionScores.map((dimension, idx) => {
          const score = dimension.score || 0;
          const percentage = (score / 10) * 100;
          let colorClass = 'from-emerald-500 to-cyan-500';
          let textColor = 'text-emerald-400';
          let bgColor = 'bg-emerald-500/5';
          let borderColor = 'border-emerald-500/20';

          if (score < 5) {
            colorClass = 'from-red-500 to-rose-500';
            textColor = 'text-red-400';
            bgColor = 'bg-red-500/5';
            borderColor = 'border-red-500/20';
          } else if (score < 7) {
            colorClass = 'from-amber-500 to-orange-500';
            textColor = 'text-amber-400';
            bgColor = 'bg-amber-500/5';
            borderColor = 'border-amber-500/20';
          }

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * idx, duration: 0.3 }}
              className={`${bgColor} border ${borderColor} rounded-2xl p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{dimension.dimension}</span>
                <span className={`text-xs font-bold ${textColor}`}>{score}/10</span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.2 + 0.1 * idx, duration: 0.8, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${colorClass} shadow-lg`}
                />
              </div>
              {dimension.evidence && dimension.evidence.length > 0 && (
                <div className="space-y-2 mt-3">
                  {dimension.evidence.map((ev, evIdx) => (
                    <div key={evIdx} className="text-xs">
                      <p className="text-slate-300"><strong className="text-slate-200">Observation:</strong> {ev.observation}</p>
                      {ev.reasoning && (
                        <p className="text-slate-400 mt-1"><strong className="text-slate-300">Reasoning:</strong> {ev.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/* --- Main Results Page --- */
export default function ResultsPage() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const audioRef = useRef(null);
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
        await new Promise(res => setTimeout(res, 5000));

        // Get session ID from URL param or localStorage
        const sessionId = urlSessionId || localStorage.getItem('currentSessionId');

        if (!sessionId) {
          throw new Error('No session ID found. Please start a new interview session.');
        }

        // Check if feedback already exists in the database
        const checkFeedbackResponse = await fetch(`http://localhost:3000/api/interview/session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
        });

        if (!checkFeedbackResponse.ok) {
          throw new Error('Failed to fetch session data');
        }

        const sessionData = await checkFeedbackResponse.json();
        const feedbackPrompt = sessionData.feedbackPrompt;
        const agentId = sessionData.agentId;

        // If feedback already exists in the database, use it
        if (sessionData.feedback) {
          console.log('Found existing feedback in database, using cached feedback');
          const transformed = transformFeedbackData(sessionData.feedback);
          if (transformed) {
            setFeedbackData(transformed);
            localStorage.setItem('interviewFeedback', JSON.stringify(sessionData.feedback));
            setIsLoading(false);
            return;
          }
        }

        // Only generate new feedback if we have the required data and no existing feedback
        if (!feedbackPrompt || !agentId) {
          throw new Error('Session data incomplete. Cannot generate feedback.');
        }

        // Send feedback request to N8N webhook
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: agentId,
            feedback_agent_prompt: feedbackPrompt
          }),
        });

        const responseText = await response.text();
        console.log('Webhook response:', responseText, 'Status:', response.status); if (!response.ok) {
          throw new Error(`Webhook request failed: ${responseText || response.statusText}`);
        }

        if (!responseText) {
          throw new Error('Webhook returned empty response');
        }

        const feedbackData = JSON.parse(responseText);
        const transformed = transformFeedbackData(feedbackData);
        if (transformed) {
          setFeedbackData(transformed);
          localStorage.setItem('interviewFeedback', JSON.stringify(feedbackData));
          localStorage.removeItem('interviewError');

          // Store feedback in database
          const sessionId = localStorage.getItem('currentSessionId');
          if (sessionId) {
            try {
              const saveFeedbackResponse = await fetch(`http://localhost:3000/api/interview/session/${sessionId}/callback`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                  feedback: feedbackData.feedback || feedbackData,
                  feedback_prompt: feedbackPrompt
                }),
              });

              if (!saveFeedbackResponse.ok) {
                console.error('Failed to save feedback to database:', await saveFeedbackResponse.text());
              } else {
                console.log('Feedback successfully saved to database');
              }
            } catch (saveError) {
              console.error('Error saving feedback to database:', saveError);
              // Don't throw - we still want to show the feedback even if saving fails
            }
          }
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
      <div className='min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10'>
        <div className='w-full max-w-md text-center'>
          <div className='mb-6'>
            <div className='inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4'>
              <XCircle className='h-8 w-8 text-red-400' />
            </div>
            <h1 className='text-2xl font-bold text-white mb-2'>
              {error || 'Failed to load feedback'}
            </h1>
            <p className='text-slate-400'>
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
              className='inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25'
            >
              Retry
            </button>
            <button
              type='button'
              onClick={() => navigate('/')}
              className='inline-flex items-center justify-center rounded-full border border-white/10 text-white px-5 py-2.5 text-sm font-medium hover:bg-white/5'
            >
              Start new interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { overallScore, overallAssessment, dimensionScores, strengths, areasForImprovement, overallRecommendation, transcript, audio } = feedbackData;

  // Helper to get recommendation badge color
  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case 'strong_hire':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', label: 'Strong Hire' };
      case 'hire':
        return { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', label: 'Hire' };
      case 'neutral':
        return { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', label: 'Neutral' };
      case 'no_hire':
        return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', label: 'No Hire' };
      default:
        return { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-400', label: recommendation };
    }
  };

  const recommendationStyle = overallRecommendation ? getRecommendationColor(overallRecommendation) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className='relative z-10 min-h-screen flex items-center justify-center px-4 py-10'>
        <div className='w-full max-w-6xl space-y-6'>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className='text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400'>
                  Interview Summary
                </h1>
                <p className='mt-2 text-sm text-slate-400'>
                  Here's your comprehensive performance analysis and feedback
                </p>
              </div>
              {overallScore !== null && (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                      {overallScore}/100
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Overall Score</div>
                  </div>
                  {recommendationStyle && (
                    <div className={`px-4 py-2 rounded-full ${recommendationStyle.bg} border ${recommendationStyle.border}`}>
                      <span className={`text-sm font-semibold ${recommendationStyle.text}`}>
                        {recommendationStyle.label}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Overall Assessment */}
          {overallAssessment && (
            <Card delay={0.1}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className='text-sm font-semibold text-white'>Overall Assessment</h3>
                    {overallAssessment.confidence_level && (
                      <span className={`text-xs px-2 py-1 rounded-full ${overallAssessment.confidence_level === 'high' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        overallAssessment.confidence_level === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                        {overallAssessment.confidence_level} confidence
                      </span>
                    )}
                  </div>
                  {overallAssessment.summary && (
                    <p className='text-sm text-slate-300 leading-relaxed'>{overallAssessment.summary}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Dimension Scores */}
          {dimensionScores && dimensionScores.length > 0 && <DimensionScoresDisplay dimensionScores={dimensionScores} />}

          {/* Strengths and Areas for Improvement Grid */}
          {(strengths.length > 0 || areasForImprovement.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Strengths */}
              {strengths.length > 0 && (
                <Card delay={0.25}>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Strengths
                  </h2>
                  <ul className="space-y-3">
                    {strengths.map((strength, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + 0.05 * idx }}
                        className="flex flex-col gap-1 text-sm text-slate-300 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            {strength.dimension && (
                              <span className="text-emerald-400 font-semibold text-xs">{strength.dimension}: </span>
                            )}
                            <span>{strength.description || strength}</span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Areas for Improvement */}
              {areasForImprovement.length > 0 && (
                <Card delay={0.3}>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    Areas for Improvement
                  </h2>
                  <ul className="space-y-4">
                    {areasForImprovement.map((area, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + 0.05 * idx }}
                        className="flex flex-col gap-2 text-sm text-slate-300 bg-red-500/5 border border-red-500/20 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            {area.dimension && (
                              <span className="text-red-400 font-semibold text-xs">{area.dimension}: </span>
                            )}
                            <span>{area.suggestion || area}</span>
                          </div>
                        </div>
                        {area.example_better_response && (
                          <div className="ml-3.5 mt-1 pl-3 border-l-2 border-amber-500/30 bg-amber-500/5 rounded p-2">
                            <p className="text-xs text-amber-300"><strong>Better approach:</strong> {area.example_better_response}</p>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {/* Audio replay */}
          {audio && <AudioPlayer audio={audio} audioRef={audioRef} />}

          {/* Transcript */}
          {transcript && transcript.length > 0 && <TranscriptCard transcript={transcript} audioRef={audioRef} />}

          {/* Retry button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className='pt-3 flex justify-center'
          >
            <button
              type='button'
              onClick={() => navigate('/dashboard')}
              className='inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all'
            >
              Run another mock interview
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
