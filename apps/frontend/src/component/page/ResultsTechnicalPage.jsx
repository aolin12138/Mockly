'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Waveform } from '../ui/waveform';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { LoadingPage } from './LoadingPage';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Target,
  TrendingUp,
  Code2,
  Bug,
  Lightbulb,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Brain,
  FileCode,
  MessageSquare,
} from 'lucide-react';

// For results, go via our local proxy instead of hitting n8n directly.
const TECHNICAL_API_URL = import.meta.env.DEV
  ? 'http://localhost:4000/api/technical-interview'
  : '/api/technical-interview';

const USE_LOCAL_SAMPLE = false;

/* --- Helper to transform the new feedback schema --- */
function transformFeedbackData(feedbackData) {
  console.log('=== TRANSFORM START ===');
  console.log('Raw input:', JSON.stringify(feedbackData, null, 2).slice(0, 2000));

  if (!feedbackData) {
    console.error('No feedback data provided');
    return null;
  }

  // If n8n / caller ever returns an array, unwrap first element
  let data = Array.isArray(feedbackData) ? feedbackData[0] : feedbackData;
  console.log('After array unwrap - keys:', Object.keys(data));
  
  // The structure from n8n is: { audio, transcript, feedback: { outcome, overall, ... } }
  // So we need to get the nested feedback object for the actual feedback fields
  const feedback = data.feedback || data;
  console.log('Feedback object keys:', Object.keys(feedback));
  console.log('Feedback.dimensions:', feedback.dimensions);
  console.log('Feedback.actionPlan:', feedback.actionPlan);
  console.log('Feedback.outcome:', feedback.outcome);

  // Handle transcript - at top level of data
  const transcript = data.transcript;
  const transformedTranscript = transcript
    ? transcript.map((msg, index) => ({
        id: index + 1,
        role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
        text: msg.text || msg.message || '',
        timestart: msg.timestart ?? null,
      }))
    : null;

  // Build the result - feedback fields come from the nested feedback object
  const result = {
    meta: feedback.meta || {},
    outcome: feedback.outcome || {},
    overall: feedback.overall || {},
    dimensions: feedback.dimensions || [],
    debuggingNarrative: feedback.debuggingNarrative || feedback.debugging_narrative || null,
    codeAssessment: feedback.codeAssessment || feedback.code_assessment || null,
    actionPlan: feedback.actionPlan || feedback.action_plan || feedback.nextSteps || [],
    ui: feedback.ui || {},
    transcript: transformedTranscript,
    audio: data.audio, // audio is at top level
  };
  
  console.log('=== TRANSFORM RESULT ===');
  console.log('dimensions count:', result.dimensions?.length);
  console.log('actionPlan count:', result.actionPlan?.length);
  console.log('First dimension:', result.dimensions?.[0]);
  console.log('First actionPlan:', result.actionPlan?.[0]);
  
  return result;
}

/* --- Glassmorphism Card Component --- */
function Card({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* --- Collapsible Section Component --- */
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, delay = 0 }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card delay={delay}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-emerald-400" />}
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="pt-4">{children}</div>
      </motion.div>
    </Card>
  );
}

/* --- Audio player with waveform --- */
function AudioPlayer({ audio, audioRef }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverProgress, setHoverProgress] = useState(null);

  const source = audio?.base64
    ? `data:${audio.mimeType || 'audio/mpeg'};base64,${audio.base64}`
    : null;

  const generateWaveformSamples = (base64String, bars = 64) => {
    if (!base64String) return Array(bars).fill(0.25);
    const step = Math.max(1, Math.floor(base64String.length / (bars * 6)));
    const samples = [];
    let cursor = 0;
    for (let i = 0; i < bars; i += 1) {
      cursor = Math.min(cursor, base64String.length - 1);
      const slice = base64String.slice(cursor, cursor + step);
      const sum = slice
        .split('')
        .reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
      const amplitude = ((sum % 97) / 97) * 0.6 + 0.25;
      samples.push(amplitude);
      cursor += step;
    }
    return samples;
  };

  const samples = useMemo(() => generateWaveformSamples(audio?.base64 || ''), [audio]);

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
    <Card delay={0.5}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">Conversation Replay</p>
          <p className="text-xs text-slate-400">
            Audio from your technical interview
          </p>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!source}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-2 text-xs font-medium hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all"
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
              className="absolute top-0 bottom-0 w-1 bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)] pointer-events-none"
              style={{ left: `${progress * 100}%`, transform: 'translateX(-50%)' }}
            />
            {hoverProgress !== null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] pointer-events-none"
                style={{ left: `${hoverProgress * 100}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={source || undefined} preload="metadata" className="hidden" />

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{source ? 'Waveform powered by ElevenLabs UI' : 'No audio attached'}</span>
        <span className="text-emerald-400 font-medium">{Math.round(progress * 100)}% played</span>
      </div>
    </Card>
  );
}

/* --- Helpers for color based on score --- */

function getScoreColor(score) {
  if (score >= 8) {
    return {
      text: 'text-emerald-400',
      gradient: 'from-emerald-500 to-cyan-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      arc: '#10b981',
    };
  }
  if (score >= 5) {
    return {
      text: 'text-amber-400',
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      arc: '#f59e0b',
    };
  }
  return {
    text: 'text-red-400',
    gradient: 'from-red-500 to-rose-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    arc: '#ef4444',
  };
}

/* --- Hire Signal Badge --- */
function HireSignalBadge({ signal }) {
  const styles = {
    strong_hire: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', label: 'Strong Hire' },
    hire: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', label: 'Hire' },
    lean_hire: { bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-400', label: 'Lean Hire' },
    neutral: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', label: 'Neutral' },
    lean_no_hire: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400', label: 'Lean No Hire' },
    no_hire: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', label: 'No Hire' },
  };

  const style = styles[signal] || styles.neutral;

  return (
    <div className={`px-4 py-2 rounded-full ${style.bg} border ${style.border}`}>
      <span className={`text-sm font-semibold ${style.text}`}>{style.label}</span>
    </div>
  );
}

/* --- Outcome Badge --- */
function OutcomeBadge({ solved }) {
  if (solved) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-400">Solved</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40">
      <XCircle className="w-4 h-4 text-red-400" />
      <span className="text-sm font-medium text-red-400">Not Solved</span>
    </div>
  );
}

/* --- Dimension Score Card --- */
function DimensionCard({ dimension, index }) {
  const [expanded, setExpanded] = useState(false);
  
  // Handle different field name variations
  const score = dimension?.score ?? dimension?.rating ?? 0;
  const percentage = (score / 10) * 100;
  const colors = getScoreColor(score);

  const formatDimensionName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown Dimension';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Support multiple field names for dimension name (actual data uses 'key' and 'label')
  const dimensionName = dimension?.label || dimension?.dimension || dimension?.name || dimension?.key || 'Unknown';
  const summary = dimension?.summary || dimension?.description || dimension?.feedback || '';
  const ratingLabel = dimension?.rating || dimension?.ratingLabel || null;
  const evidence = dimension?.evidence || dimension?.examples || [];
  const strengths = dimension?.strengths || [];
  const weaknesses = dimension?.weaknesses || dimension?.areasForImprovement || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.3 }}
      className={`${colors.bg} border ${colors.border} rounded-2xl p-4`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">{formatDimensionName(dimensionName)}</span>
        <span className={`text-xs font-bold ${colors.text}`}>{score}/10</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: 0.2 + 0.1 * index, duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${colors.gradient} shadow-lg`}
        />
      </div>

      {/* Rating label */}
      {ratingLabel && (
        <div className="mb-3">
          <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {ratingLabel}
          </span>
        </div>
      )}

      {/* Summary (always visible) */}
      {summary && (
        <p className="text-xs text-slate-300 mb-3">{summary}</p>
      )}

      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-emerald-400 font-medium mb-1">Strengths:</p>
          <ul className="space-y-1">
            {strengths.map((s, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                <span className="text-emerald-400">+</span>
                <span>{typeof s === 'string' ? s : s.text || JSON.stringify(s)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {weaknesses && weaknesses.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-amber-400 font-medium mb-1">Areas to Improve:</p>
          <ul className="space-y-1">
            {weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                <span className="text-amber-400">-</span>
                <span>{typeof w === 'string' ? w : w.text || JSON.stringify(w)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence (collapsible) */}
      {evidence && evidence.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide evidence' : `Show ${evidence.length} evidence points`}
          </button>
          
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              {evidence.map((ev, evIdx) => {
                // Handle both object and string evidence
                const observation = typeof ev === 'string' ? ev : (ev.observation || ev.text || ev.description || JSON.stringify(ev));
                const quote = typeof ev === 'object' ? (ev.quote || ev.example) : null;
                return (
                  <div key={evIdx} className="text-xs bg-slate-800/50 rounded-lg p-3 border border-white/5">
                    <p className="text-slate-300">
                      <strong className="text-slate-200">Observation:</strong> {observation}
                    </p>
                    {quote && (
                      <p className="text-slate-400 mt-1 italic border-l-2 border-emerald-500/30 pl-2">
                        "{quote}"
                      </p>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

/* --- Action Plan Item --- */
function ActionPlanItem({ item, index }) {
  // If item is just a string, render it simply
  if (typeof item === 'string') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 * index }}
        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-400">{index + 1}</span>
          </div>
          <p className="text-sm text-slate-300">{item}</p>
        </div>
      </motion.div>
    );
  }

  // Handle different field name variations from API
  const title = item.title || item.focus_area || item.focusArea || item.area || 'Action Item';
  
  // Priority can be number (1=high, 2=medium, 3=low) or string
  let priority = 'medium';
  if (typeof item.priority === 'number') {
    priority = item.priority === 1 ? 'high' : item.priority === 2 ? 'medium' : 'low';
  } else if (typeof item.priority === 'string') {
    priority = item.priority.toLowerCase();
  }
  
  const how = item.how || item.recommendation || item.action || item.description || '';
  const why = item.why || '';
  const resources = item.resources || [];

  const priorityStyles = {
    high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20', label: 'High Priority' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20', label: 'Medium' },
    low: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', badge: 'bg-slate-500/20', label: 'Low' },
  };

  const style = priorityStyles[priority] || priorityStyles.medium;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className={`${style.bg} border ${style.border} rounded-xl p-4`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full ${style.badge} flex items-center justify-center`}>
          <span className={`text-xs font-bold ${style.text}`}>{index + 1}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-white">{title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.badge} ${style.text} uppercase font-medium`}>
              {style.label}
            </span>
          </div>
          
          {how && (
            <div className="mb-2">
              <p className="text-xs text-slate-400 font-medium mb-1">How:</p>
              <p className="text-xs text-slate-300">{how}</p>
            </div>
          )}
          
          {why && (
            <div className="mb-2">
              <p className="text-xs text-slate-400 font-medium mb-1">Why:</p>
              <p className="text-xs text-slate-300">{why}</p>
            </div>
          )}
          
          {resources && resources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-slate-400 font-medium mb-1">Resources:</p>
              <ul className="space-y-1">
                {resources.map((resource, idx) => {
                  const resourceText = typeof resource === 'string' ? resource : (resource.title || resource.name || resource.url || JSON.stringify(resource));
                  const resourceUrl = typeof resource === 'object' ? resource.url : null;
                  return (
                    <li key={idx} className="text-xs text-cyan-400">
                      {resourceUrl ? (
                        <a href={resourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {resourceText}
                        </a>
                      ) : (
                        <span>{resourceText}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* --- Time formatter --- */
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
      audioRef.current.play().catch((err) => console.error('Failed to play', err));
    }
  };

  return (
    <Card delay={0.4}>
      <h2 className="text-sm font-semibold text-white mb-1">Chat History</h2>
      <p className="text-xs text-slate-400 mb-4">Click timestamp to jump to that moment.</p>

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
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                    : 'bg-slate-800/40 text-slate-100 border border-white/5')
                }
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    {m.role === 'user' ? (
                      <span className="text-emerald-400">You</span>
                    ) : (
                      <span className="text-cyan-400">Interviewer</span>
                    )}
                  </span>
                  {m.timestart != null && (
                    <button
                      type="button"
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
                <p className="whitespace-pre-wrap text-xs">{m.text}</p>
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

/* --- Main Technical Results Page --- */
export default function TechnicalResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: urlSessionId } = useParams();
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const state = location.state || {};
    console.log('[technical-results] location.state:', state);
    console.log('[technical-results] urlSessionId:', urlSessionId);

    // If the interview page sent us feedback data directly, use it
    if (state.feedback) {
      console.log('[technical-results] Using feedback from state:', state.feedback);
      const transformed = transformFeedbackData(state.feedback);
      console.log('[technical-results] Transformed data:', transformed);
      if (transformed) {
        setFeedbackData(transformed);
        setIsLoading(false);
        return;
      }
    }

    // If we have raw data with feedback, transcript, audio
    const rawFromState = state.raw;
    if (rawFromState) {
      console.log('[technical-results] Using raw data from state');
      const transformed = transformFeedbackData(rawFromState);
      if (transformed) {
        setFeedbackData(transformed);
        setIsLoading(false);
        return;
      }
    }

    // 2) Dev mode: local sample
    if (USE_LOCAL_SAMPLE) {
      // TODO: Add sample data for new schema
      setIsLoading(false);
      return;
    }

    // 3) Fetch from API only if we don't have feedback in state
    const fetchFeedback = async () => {
      try {
        await new Promise((res) => setTimeout(res, 2000));

        // Get session ID from URL param or localStorage
        const sessionId = urlSessionId || localStorage.getItem('currentTechnicalSessionId');

        if (!sessionId) {
          throw new Error('No session ID found. Please start a new technical interview.');
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
        console.log('[technical-results] Session data from DB:', sessionData);
        console.log('[technical-results] Feedback field:', sessionData.feedback);

        // If feedback already exists in the database, use it
        if (sessionData.feedback) {
          console.log('Found existing feedback in database');
          console.log('[technical-results] Feedback structure keys:', Object.keys(sessionData.feedback));
          console.log('[technical-results] Is Array?', Array.isArray(sessionData.feedback));
          console.log('[technical-results] Raw feedback:', JSON.stringify(sessionData.feedback).slice(0, 500));
          const transformed = transformFeedbackData(sessionData.feedback);
          console.log('[technical-results] Transformed result keys:', transformed ? Object.keys(transformed) : null);
          console.log('[technical-results] Transformed outcome:', transformed?.outcome);
          console.log('[technical-results] Transformed overall:', transformed?.overall);
          console.log('[technical-results] Transformed dimensions count:', transformed?.dimensions?.length);
          if (transformed) {
            console.log('[technical-results] Calling setFeedbackData with transformed data');
            setFeedbackData(transformed);
            setIsLoading(false);
            return;
          }
        }

        throw new Error('No feedback available yet. Please wait for the interview to be processed.');
      } catch (err) {
        console.error('[technical-results] Error fetching feedback:', err);
        setError(err?.message || 'Failed to load technical interview feedback.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [location.state, urlSessionId]);

  if (isLoading) {
    console.log('[technical-results] Still loading...');
    return <LoadingPage />;
  }

  if (error || !feedbackData) {
    console.log('[technical-results] Error state - error:', error, 'feedbackData:', feedbackData);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {error || 'Failed to load feedback'}
            </h1>
            <p className="text-slate-400">
              We couldn't find feedback for this technical session.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('technicalInterviewFeedback');
                localStorage.removeItem('technicalInterviewError');
                window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate('/technical')}
              className="inline-flex items-center justify-center rounded-full border border-white/10 text-white px-5 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Start new technical interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { meta, outcome, overall, dimensions, debuggingNarrative, codeAssessment, actionPlan, ui, transcript, audio } = feedbackData;

  // Debug: Log what's being rendered
  console.log('=== RENDER TIME DEBUG ===');
  console.log('feedbackData keys:', Object.keys(feedbackData));
  console.log('outcome:', outcome);
  console.log('overall:', overall);
  console.log('dimensions:', dimensions);
  console.log('ui:', ui);
  console.log('transcript:', transcript);
  console.log('audio:', audio);
  console.log('=========================');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl space-y-6">
          {/* Header with Score and Verdict */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  Technical Interview Results
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {meta?.questionTitle || 'Comprehensive analysis of your coding interview performance'}
                </p>
                {meta?.language && (
                  <div className="mt-2 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-slate-400">{meta.language}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {overall?.score != null && (
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                      {overall.score}/10
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Overall Score</div>
                  </div>
                )}
                {overall?.hireSignal && <HireSignalBadge signal={overall.hireSignal} />}
              </div>
            </div>
          </motion.div>

          {/* Outcome Card */}
          {outcome && (
            <Card delay={0.1}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <OutcomeBadge solved={outcome.solved} />
                  {outcome.assistanceLevel && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span>Assistance: <strong>{outcome.assistanceLevel}</strong></span>
                    </div>
                  )}
                </div>
                {outcome.passSummary && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300">
                      {typeof outcome.passSummary === 'string' 
                        ? outcome.passSummary
                        : typeof outcome.passSummary === 'object'
                          ? (outcome.passSummary.summary || 
                             outcome.passSummary.text ||
                             `${outcome.passSummary.passed ?? outcome.passSummary.passedCount ?? '?'}/${outcome.passSummary.total ?? outcome.passSummary.totalCount ?? '?'} tests passed`)
                          : String(outcome.passSummary)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Overall Summary */}
          {overall?.summary && (
            <Card delay={0.15}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">Overall Assessment</h3>
                    {overall.confidence && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        overall.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        overall.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {overall.confidence} confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{overall.summary}</p>
                </div>
              </div>
            </Card>
          )}

          {/* UI Summary - Top Strengths and Improvements */}
          {ui && (ui.topStrengths?.length > 0 || ui.topImprovements?.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Strengths */}
              {ui.topStrengths?.length > 0 && (
                <Card delay={0.2}>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Top Strengths
                  </h2>
                  <ul className="space-y-3">
                    {ui.topStrengths.map((strength, idx) => {
                      const strengthText = typeof strength === 'string' ? strength : (strength.text || JSON.stringify(strength));
                      return (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + 0.05 * idx }}
                          className="flex items-start gap-2 text-sm text-slate-300 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                          <span>{strengthText}</span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              {/* Improvements */}
              {ui.topImprovements?.length > 0 && (
                <Card delay={0.25}>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    Areas to Improve
                  </h2>
                  <ul className="space-y-3">
                    {ui.topImprovements.map((improvement, idx) => {
                      const improvementText = typeof improvement === 'string' ? improvement : (improvement.text || JSON.stringify(improvement));
                      return (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + 0.05 * idx }}
                          className="flex items-start gap-2 text-sm text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>{improvementText}</span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {/* Dimension Scores */}
          {dimensions && dimensions.length > 0 && (
            <CollapsibleSection title="Skill Breakdown" icon={Target} defaultOpen={true} delay={0.3}>
              <div className="grid gap-4 md:grid-cols-2">
                {dimensions.filter(d => d && typeof d === 'object').map((dimension, idx) => (
                  <DimensionCard key={dimension.dimension || dimension.name || idx} dimension={dimension} index={idx} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Debugging Narrative */}
          {debuggingNarrative && (
            <CollapsibleSection title="Debugging Journey" icon={Bug} delay={0.35}>
              <div className="space-y-4">
                {debuggingNarrative.timeline && debuggingNarrative.timeline.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Timeline
                    </h4>
                    {debuggingNarrative.timeline.map((event, idx) => {
                      const eventText = typeof event === 'string' ? event : (event.event || event.text || JSON.stringify(event));
                      const eventTime = typeof event === 'object' ? event.time : null;
                      return (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <div className="flex-shrink-0 w-8 text-xs text-slate-500 font-mono">{eventTime || `${idx + 1}.`}</div>
                          <div className="flex-1 text-slate-300">{eventText}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(debuggingNarrative.description || debuggingNarrative.summary) && (
                  <p className="text-sm text-slate-300 mt-4">{debuggingNarrative.description || debuggingNarrative.summary}</p>
                )}
                {debuggingNarrative.goodPracticesObserved && debuggingNarrative.goodPracticesObserved.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-emerald-400 mb-2">Good Practices</h4>
                    <ul className="space-y-1">
                      {debuggingNarrative.goodPracticesObserved.map((practice, idx) => {
                        const practiceText = typeof practice === 'string' ? practice : (practice.text || JSON.stringify(practice));
                        return (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                            {practiceText}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {debuggingNarrative.issuesObserved && debuggingNarrative.issuesObserved.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">Areas for Improvement</h4>
                    <ul className="space-y-1">
                      {debuggingNarrative.issuesObserved.map((issue, idx) => {
                        const issueText = typeof issue === 'string' ? issue : (issue.text || JSON.stringify(issue));
                        const severityColor = issue?.severity === 'high' ? 'text-red-400' : 'text-amber-400';
                        return (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <AlertTriangle className={`w-3 h-3 ${severityColor} mt-0.5 flex-shrink-0`} />
                            {issueText}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Code Assessment */}
          {codeAssessment && (
            <CollapsibleSection title="Code Assessment" icon={Code2} delay={0.4}>
              {/* Notes/Overview */}
              {codeAssessment.notes && (
                <p className="text-sm text-slate-300 mb-4">{codeAssessment.notes}</p>
              )}
              
              <div className="grid gap-4 md:grid-cols-2">
                {/* Positives */}
                {codeAssessment.positives && codeAssessment.positives.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20">
                    <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Strengths
                    </h4>
                    <ul className="space-y-2">
                      {codeAssessment.positives.map((item, idx) => {
                        const itemText = typeof item === 'string' ? item : (item.text || item.description || JSON.stringify(item));
                        return (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400">•</span>
                            {itemText}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* Risks */}
                {codeAssessment.risks && codeAssessment.risks.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-amber-500/20">
                    <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Risks / Areas to Improve
                    </h4>
                    <ul className="space-y-2">
                      {codeAssessment.risks.map((item, idx) => {
                        const itemText = typeof item === 'string' ? item : (item.text || item.description || JSON.stringify(item));
                        return (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-amber-400">•</span>
                            {itemText}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* Legacy fields for backward compatibility */}
                {codeAssessment.correctness && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Correctness
                    </h4>
                    <p className="text-xs text-slate-300">{codeAssessment.correctness}</p>
                  </div>
                )}
                {codeAssessment.efficiency && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Efficiency
                    </h4>
                    <p className="text-xs text-slate-300">{codeAssessment.efficiency}</p>
                  </div>
                )}
                {codeAssessment.style && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-cyan-400" />
                      Code Style
                    </h4>
                    <p className="text-xs text-slate-300">{codeAssessment.style}</p>
                  </div>
                )}
                {codeAssessment.edgeCases && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      Edge Cases
                    </h4>
                    <p className="text-xs text-slate-300">{codeAssessment.edgeCases}</p>
                  </div>
                )}
              </div>
              {codeAssessment.overallNote && (
                <p className="text-sm text-slate-300 mt-4 italic">{codeAssessment.overallNote}</p>
              )}
            </CollapsibleSection>
          )}

          {/* Action Plan */}
          {actionPlan && actionPlan.length > 0 && (
            <CollapsibleSection title="Action Plan" icon={Lightbulb} defaultOpen={true} delay={0.45}>
              <div className="space-y-3">
                {actionPlan.map((item, idx) => (
                  <ActionPlanItem key={idx} item={item} index={idx} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Verdict Card */}
          {(ui?.verdict || ui?.oneLineVerdict) && (
            <Card delay={0.5}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <Award className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-2">Final Verdict</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{ui.verdict || ui.oneLineVerdict}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Audio and Transcript */}
          {(audio || (transcript && transcript.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              {audio && <AudioPlayer audio={audio} audioRef={audioRef} />}
              {transcript && transcript.length > 0 && (
                <TranscriptCard transcript={transcript} audioRef={audioRef} />
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="pt-3 flex justify-center gap-4"
          >
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center rounded-full border border-white/10 text-white px-6 py-3 text-sm font-medium hover:bg-white/5 transition-all"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/technical')}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              Try Another Problem
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
