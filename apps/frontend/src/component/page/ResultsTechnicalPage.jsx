'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Waveform } from '../ui/waveform';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { LoadingPage } from './LoadingPage';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
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
  RotateCcw,
  Play,
  Hash,
  FlaskConical,
} from 'lucide-react';
import { authFetch, ensureAuthenticated } from '../../lib/auth';

// For results, go via our local proxy instead of hitting n8n directly.
const TECHNICAL_API_URL = import.meta.env.DEV
  ? 'http://localhost:4000/api/technical-interview'
  : '/api/technical-interview';

const USE_LOCAL_SAMPLE = false;

/* --- Helper to transform the new feedback schema --- */
function transformFeedbackData(feedbackData) {
  if (!feedbackData) {
    return null;
  }

  // If n8n / caller ever returns an array, unwrap first element
  let data = Array.isArray(feedbackData) ? feedbackData[0] : feedbackData;

  // The structure from workflow can be: { feedback, call_duration_secs, transcripts, audio } etc.
  const feedback = data.feedback || data;

  // Handle transcript(s) - top-level can be transcripts or transcript
  const transcript = Array.isArray(data.transcripts)
    ? data.transcripts
    : Array.isArray(data.transcript)
      ? data.transcript
      : [];
  const transformedTranscript = transcript.length > 0
    ? transcript.map((msg, index) => ({
        id: index + 1,
        role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
        text: msg.text || msg.message || '',
        timestart: msg.timestart ?? null,
      }))
    : null;

  // Extract scalar fields with defaults
  const outcome = feedback.outcome || null; // string: "solved" | "partially_solved" | "not_solved"
  const completed = feedback.completed ?? true;
  const reachedPhase = feedback.reached_phase ?? feedback.reachedPhase ?? null;
  const testResults = feedback.test_results ?? feedback.testResults ?? null;
  const time = feedback.time ?? null;
  const dimensions = Array.isArray(feedback.dimensions) ? feedback.dimensions : [];
  const thinkingAndLogic = feedback.thinking_and_logic ?? feedback.thinkingAndLogic ?? null;
  const codeAssessment = feedback.code_assessment ?? feedback.codeAssessment ?? null;
  const nextSteps = Array.isArray(feedback.next_steps ?? feedback.nextSteps) ? (feedback.next_steps ?? feedback.nextSteps) : [];
  const patternsToStudy = Array.isArray(feedback.patterns_to_study ?? feedback.patternsToStudy) ? (feedback.patterns_to_study ?? feedback.patternsToStudy) : [];
  const encouragement = feedback.encouragement ?? null;

  const result = {
    outcome,
    completed,
    reachedPhase,
    testResults,
    time,
    dimensions,
    thinkingAndLogic,
    codeAssessment,
    nextSteps,
    patternsToStudy,
    encouragement,
    transcript: transformedTranscript,
    audio: data.audio || null, // expects { mimeType, base64 }
    callDurationSecs: Number(data.call_duration_secs ?? data.callDurationSecs ?? 0) || null,
  };

  return result;
}

/* --- Glassmorphism Card Component --- */
function Card({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-2xl ${className}`}
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
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
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Conversation Replay</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Audio from your technical interview</p>
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

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
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
  if (score >= 5.5) {
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

function getLabelForScore(score) {
  if (score == null) return '—';
  if (score >= 8) return 'strong';
  if (score >= 5.5) return 'adequate';
  return 'needs work';
}

/* --- Outcome Chip --- */
function OutcomeChip({ outcome }) {
  if (!outcome) return null;

  const config = {
    solved: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', label: 'Solved', icon: CheckCircle2 },
    partially_solved: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', label: 'Partially Solved', icon: AlertTriangle },
    not_solved: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', label: 'Not Solved', icon: XCircle },
  };

  const style = config[outcome] || config.not_solved;
  const Icon = style.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${style.bg} border ${style.border}`}>
      <Icon className={`w-4 h-4 ${style.text}`} />
      <span className={`text-sm font-semibold ${style.text}`}>{style.label}</span>
    </div>
  );
}

/* --- Score Circle --- */
function ScoreCircle({ score, size = 'lg' }) {
  const scoreOutOfTen = score != null ? (score / 10).toFixed(1) : '—';
  const label = getLabelForScore(score != null ? score / 10 : null);
  const colors = getScoreColor(score != null ? score / 10 : 0);

  const sizeClasses = size === 'lg'
    ? 'w-28 h-28 text-3xl'
    : 'w-20 h-20 text-2xl';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${sizeClasses} flex items-center justify-center`}>
        {/* Ring background */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          {score != null && (
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={`url(#scoreGradient-${size})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(score / 10) * 264} 264`}
            />
          )}
          <defs>
            <linearGradient id={`scoreGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <span className={`relative font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400`}>
          {scoreOutOfTen}
        </span>
      </div>
      <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
    </div>
  );
}

/* --- Quick Fact Badge --- */
function QuickFact({ icon: Icon, label, value }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
      {Icon && <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

/* --- Dimension Score Card (new schema) --- */
function DimensionCard({ dimension, index }) {
  const score = dimension?.score ?? 0;
  const percentage = (score / 10) * 100;
  const colors = getScoreColor(score);
  const label = dimension?.label || getLabelForScore(score);
  const whatWentWell = dimension?.what_went_well ?? dimension?.whatWentWell ?? '';
  const whatToImprove = dimension?.what_to_improve ?? dimension?.whatToImprove ?? '';
  const hintsUsed = dimension?.hints_used ?? dimension?.hintsUsed ?? null;

  const formatDimensionName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown Dimension';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.3 }}
      className={`${colors.bg} border ${colors.border} rounded-2xl p-4`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDimensionName(dimension.name)}</span>
        <div className="flex items-center gap-2">
          {hintsUsed != null && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
              {hintsUsed} hint{hintsUsed !== 1 ? 's' : ''}
            </span>
          )}
          <span className={`text-xs font-bold ${colors.text}`}>{score.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: 0.2 + 0.1 * index, duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${colors.gradient} shadow-lg`}
        />
      </div>

      {/* Label */}
      <div className="mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
          {label}
        </span>
      </div>

      {/* What went well */}
      {whatWentWell && (
        <div className="mb-2">
          <p className="text-xs text-emerald-400 font-medium mb-1">What went well</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{whatWentWell}</p>
        </div>
      )}

      {/* What to improve */}
      {whatToImprove && (
        <div>
          <p className="text-xs text-amber-400 font-medium mb-1">What to improve</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{whatToImprove}</p>
        </div>
      )}
    </motion.div>
  );
}

/* --- Next Step Card --- */
function NextStepCard({ step, index }) {
  const action = step.action || '';
  const why = step.why || '';
  const how = step.how || '';

  if (!action && !why && !how) {
    // Fallback for plain string items
    const text = typeof step === 'string' ? step : '';
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 * index }}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-emerald-400">{index + 1}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{text}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-emerald-400">{index + 1}</span>
        </div>
        <div className="flex-1 space-y-2">
          {action && (
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{action}</p>
          )}
          {why && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Why</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">{why}</p>
            </div>
          )}
          {how && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">How</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">{how}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* --- Pattern Tag --- */
function PatternTag({ pattern, index }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 * index }}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 font-medium"
    >
      <Hash className="w-3 h-3" />
      {pattern}
    </motion.span>
  );
}

/* --- Test Results Panel --- */
function TestResultsPanel({ testResults }) {
  if (!testResults) return null;

  const passed = testResults.passed ?? 0;
  const total = testResults.total ?? 0;
  const byCategory = testResults.by_category ?? testResults.byCategory ?? {};
  const summaryNote = testResults.summary_note ?? testResults.summaryNote ?? '';

  return (
    <div className="space-y-4">
      {/* Passed / Total */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-emerald-400" />
          <span className="text-sm text-slate-700 dark:text-slate-300">Test Results</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{passed}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">{total}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">passed</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            passed === total ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' :
            passed >= total / 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
            'bg-gradient-to-r from-red-500 to-rose-500'
          }`}
        />
      </div>

      {/* By category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(byCategory).map(([category, result]) => {
            const isPass = result === 'pass' || result === true;
            const isFail = result === 'fail' || result === false || (typeof result === 'string' && result.toLowerCase().includes('fail'));
            return (
              <div
                key={category}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  isPass
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : isFail
                      ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                }`}
              >
                {isPass ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                ) : isFail ? (
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="capitalize">{category}</span>
                <span className="ml-auto font-medium">{typeof result === 'string' ? result : (isPass ? 'pass' : 'fail')}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary note */}
      {summaryNote && (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{summaryNote}</p>
      )}
    </div>
  );
}

/* --- Code Review Sandbox --- */
function CodeReviewSandbox({ sessionId, initialCode, language }) {
  const { theme } = useTheme();
  const [code, setCode] = useState(initialCode || '');
  const [originalCode] = useState(initialCode || '');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [error, setError] = useState(null);

  const handleRunTests = async () => {
    if (!sessionId) {
      setError('No session ID available to run tests.');
      return;
    }
    setIsRunning(true);
    setError(null);
    setTestResults(null);

    try {
      const response = await fetch(`/api/interview/session/${sessionId}/run-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, language: language || 'javascript' }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(errText || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      setTestResults(data);
    } catch (err) {
      console.error('Failed to run tests:', err);
      setError(err.message || 'Failed to run tests. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(originalCode);
    setTestResults(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Editor */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
        <Editor
          height="300px"
          language={language || 'javascript'}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            automaticLayout: true,
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunTests}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-2 text-xs font-medium hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Tests
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Submission
          </button>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
          Edits here are for practice and aren't saved — your interview submission is preserved.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">Test Results</p>
          <div className="grid gap-2">
            {Array.isArray(testResults.results) && testResults.results.length > 0 ? (
              testResults.results.map((test, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg text-xs ${
                    test.passed
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  {test.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${test.passed ? 'text-emerald-300' : 'text-red-300'}`}>
                      {test.name || `Test ${idx + 1}`}
                    </p>
                    {!test.passed && (
                      <div className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                        {test.input != null && <p>Input: <code className="text-slate-700 dark:text-slate-300">{JSON.stringify(test.input)}</code></p>}
                        {test.expected != null && <p>Expected: <code className="text-slate-700 dark:text-slate-300">{JSON.stringify(test.expected)}</code></p>}
                        {test.actual != null && <p>Actual: <code className="text-red-300">{JSON.stringify(test.actual)}</code></p>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {testResults.passed != null
                  ? `${testResults.passed} / ${testResults.total || '?'} tests passed`
                  : 'Tests completed (no detail available).'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
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
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Chat History</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Click timestamp to jump to that moment.</p>

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
                    : 'bg-slate-100 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/5')
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
                          : 'bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50')
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
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [error, setError] = useState(null);

  const generateFeedbackForSession = async (sessionId) => {
    const response = await authFetch(`http://localhost:3000/api/interview/session/${sessionId}/generate-technical-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(rawText || 'Failed to generate technical feedback');
    }

    const parsed = rawText ? JSON.parse(rawText) : {};
    const rawFeedback = parsed.feedback || parsed;
    const transformed = transformFeedbackData(rawFeedback);

    if (!transformed) {
      throw new Error('Generated feedback is invalid. Please try again.');
    }

    return { transformed, score: parsed.score ?? null };
  };

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
        if (state.score != null) setSessionMeta({ score: state.score, ...state.meta });
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
      const sample = {
        outcome: 'partially_solved',
        completed: true,
        reachedPhase: 4,
        testResults: { passed: 9, total: 10, by_category: { basic: 'pass', edge: '1 fail', performance: 'pass' }, summary_note: 'One edge case missed on large input.' },
        time: { taken_minutes: 32, budget_minutes: 35 },
        dimensions: [
          { name: 'Correctness & Completeness', score: 7.5, label: 'adequate', what_went_well: 'Covered most test cases.', what_to_improve: 'Missed one edge case.' },
          { name: 'Problem-Solving & Thinking', score: 8.0, label: 'strong', what_went_well: 'Clear approach discussion.', what_to_improve: 'Could consider alternative solutions.' },
          { name: 'Technical Communication', score: 8.5, label: 'strong', what_went_well: 'Articulated reasoning well.', what_to_improve: 'Use more precise terminology.' },
          { name: 'Complexity & Optimization', score: 4.5, label: 'needs work', what_went_well: 'Identified brute force.', what_to_improve: 'Analyze time/space complexity upfront.' },
          { name: 'Code Quality', score: 7.0, label: 'adequate', what_went_well: 'Readable code.', what_to_improve: 'Add more comments and error handling.' },
          { name: 'Independence', score: 6.0, label: 'adequate', hints_used: 2, what_went_well: 'Worked through problems independently.', what_to_improve: 'Ask clarifying questions earlier.' },
        ],
        thinkingAndLogic: 'You started by clarifying the problem constraints, then walked through a brute force approach before arriving at an O(n log n) solution using a hash map with sorting. Your reasoning was logical and you caught one inconsistency during the walkthrough.',
        codeAssessment: 'Your code is well-structured with consistent naming conventions. The hash map approach was appropriate for this problem. One area for improvement is handling edge cases like empty inputs and large numbers — you missed the integer overflow edge case.',
        nextSteps: [
          { action: 'Review hash map and sliding window patterns', why: 'These patterns appear in ~40% of technical interviews at this level', how: 'Practice 3-4 problems on LeetCode using the Two Pointer and Sliding Window tags' },
          { action: 'Practice explaining complexity analysis', why: 'Interviewers noted your complexity analysis could be more thorough', how: 'For each practice problem, write out the time and space complexity before coding' },
        ],
        patternsToStudy: ['hash map', 'complexity analysis', 'two pointers'],
        encouragement: 'You have solid fundamentals — with focused practice on edge case handling and complexity analysis, you\'ll be well-prepared for your next interview.',
      };
      setFeedbackData(sample);
      setSessionMeta({ score: 72 });
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
        const checkFeedbackResponse = await authFetch(`http://localhost:3000/api/interview/session/${sessionId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!checkFeedbackResponse.ok) {
          throw new Error('Failed to fetch session data');
        }

        const sessionData = await checkFeedbackResponse.json();
        console.log('[technical-results] Session data from DB:', sessionData);

        // Store session meta (score, language, code, etc.)
        if (sessionData.score != null) {
          setSessionMeta({ score: sessionData.score, language: sessionData.latestLanguage, code: sessionData.latestCode, questionTitle: sessionData.technicalQuestionSnapshot?.title });
        }

        // If feedback already exists in the database, use it
        if (sessionData.feedback) {
          console.log('Found existing feedback in database');
          const transformed = transformFeedbackData(sessionData.feedback);
          if (transformed) {
            setFeedbackData(transformed);
            setIsLoading(false);
            return;
          }
        }

        if (!ensureAuthenticated()) return;

        const generated = await generateFeedbackForSession(sessionId);
        setFeedbackData(generated.transformed);
        if (generated.score != null) setSessionMeta(prev => ({ ...prev, score: generated.score }));
      } catch (err) {
        if (err?.code === 'AUTH_REQUIRED' || err?.code === 'AUTH_EXPIRED') return;
        console.error('[technical-results] Error fetching feedback:', err);
        setError(err?.message || 'Failed to load technical interview feedback.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [location.state, urlSessionId]);

  const handleRetryGeneration = async () => {
    const sessionId = urlSessionId || localStorage.getItem('currentTechnicalSessionId');
    if (!sessionId) {
      setError('No session ID found. Please start a new technical interview.');
      return;
    }

    if (!ensureAuthenticated()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateFeedbackForSession(sessionId);
      setFeedbackData(result.transformed);
      if (result.score != null) setSessionMeta(prev => ({ ...prev, score: result.score }));
      setError(null);
    } catch (err) {
      if (err?.code === 'AUTH_REQUIRED' || err?.code === 'AUTH_EXPIRED') return;
      console.error('[technical-results] Retry generation failed:', err);
      setError(err?.message || 'Failed to generate technical feedback.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    console.log('[technical-results] Still loading...');
    return <LoadingPage />;
  }

  if (error || !feedbackData) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {error || 'Failed to load feedback'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              We couldn't find feedback for this technical session.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRetryGeneration}
              disabled={isGenerating}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25"
            >
              {isGenerating ? 'Generating feedback...' : 'Retry feedback generation'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/technical')}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Start new technical interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sessionScore = sessionMeta?.score != null ? sessionMeta.score : null;
  const sessionLanguage = sessionMeta?.language || 'javascript';
  const sessionCode = sessionMeta?.code || '';
  const sessionId = urlSessionId || localStorage.getItem('currentTechnicalSessionId');

  const {
    outcome,
    completed,
    reachedPhase,
    testResults,
    time,
    dimensions,
    thinkingAndLogic,
    codeAssessment,
    nextSteps,
    patternsToStudy,
    encouragement,
    transcript,
    audio,
  } = feedbackData;

  const hintsTotal = dimensions
    .filter(d => d.hints_used != null || d.hintsUsed != null)
    .reduce((sum, d) => sum + (d.hints_used ?? d.hintsUsed ?? 0), 0);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/20 dark:selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl space-y-6">

          {/* ===== 1. HEADER BAND ===== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {/* Title row */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                  Technical Interview Results
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Comprehensive analysis of your coding interview performance
                </p>
                {sessionLanguage && (
                  <div className="mt-2 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{sessionLanguage}</span>
                  </div>
                )}
              </div>

              {/* Score circle + outcome */}
              <div className="flex items-center gap-6">
                <ScoreCircle score={sessionScore} size="lg" />
                <OutcomeChip outcome={outcome} />
              </div>
            </div>

            {/* Quick facts row */}
            <div className="flex flex-wrap items-center gap-3">
              {testResults && (
                <QuickFact icon={FlaskConical} label="Tests" value={`${testResults.passed ?? 0}/${testResults.total ?? 0}`} />
              )}
              {time && (
                <QuickFact icon={Clock} label="Time" value={`${time.taken_minutes ?? '?'} / ${time.budget_minutes ?? '?'} min`} />
              )}
              {hintsTotal > 0 && (
                <QuickFact icon={Lightbulb} label="Hints" value={`${hintsTotal} used`} />
              )}
              {reachedPhase != null && (
                <QuickFact icon={TrendingUp} label="Phase" value={`${reachedPhase}`} />
              )}
              {completed != null && (
                <QuickFact icon={completed ? CheckCircle2 : XCircle} label="Completed" value={completed ? 'Yes' : 'No'} />
              )}
              {audio && feedbackData.callDurationSecs && (
                <QuickFact icon={Clock} label="Duration" value={formatTime(feedbackData.callDurationSecs)} />
              )}
            </div>
          </motion.div>

          {/* ===== 2. CODE REVIEW SANDBOX (NEW) ===== */}
          {sessionCode && (
            <CollapsibleSection title="Code Review Sandbox" icon={Code2} defaultOpen={true} delay={0.1}>
              <CodeReviewSandbox
                sessionId={sessionId}
                initialCode={sessionCode}
                language={sessionLanguage}
              />
            </CollapsibleSection>
          )}

          {/* ===== 3. TEST RESULTS PANEL ===== */}
          {testResults && (
            <Card delay={0.15}>
              <TestResultsPanel testResults={testResults} />
            </Card>
          )}

          {/* ===== 4. DIMENSION SCORE CARDS ===== */}
          {dimensions && dimensions.length > 0 && (
            <CollapsibleSection title="Skill Breakdown" icon={Target} defaultOpen={true} delay={0.2}>
              <div className="grid gap-4 md:grid-cols-2">
                {dimensions.filter(d => d && typeof d === 'object').map((dimension, idx) => (
                  <DimensionCard key={dimension.name || idx} dimension={dimension} index={idx} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ===== 5. THINKING & LOGIC ===== */}
          {thinkingAndLogic && (
            <CollapsibleSection title="Thinking & Logic" icon={Brain} delay={0.25}>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{thinkingAndLogic}</p>
            </CollapsibleSection>
          )}

          {/* ===== 6. CODE ASSESSMENT ===== */}
          {codeAssessment && (
            <CollapsibleSection title="Code Assessment" icon={Code2} delay={0.3}>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{codeAssessment}</p>
            </CollapsibleSection>
          )}

          {/* ===== 7. NEXT STEPS ===== */}
          {nextSteps && nextSteps.length > 0 && (
            <CollapsibleSection title="Next Steps" icon={Lightbulb} defaultOpen={true} delay={0.35}>
              <div className="space-y-3">
                {nextSteps.map((step, idx) => (
                  <NextStepCard key={idx} step={step} index={idx} />
                ))}
              </div>
              {/* Patterns to study */}
              {patternsToStudy && patternsToStudy.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Patterns to Study</p>
                  <div className="flex flex-wrap gap-2">
                    {patternsToStudy.map((pattern, idx) => (
                      <PatternTag key={idx} pattern={pattern} index={idx} />
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ===== 8. ENCOURAGEMENT ===== */}
          {encouragement && (
            <Card delay={0.4}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                  <Award className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Final Words</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">{encouragement}</p>
                </div>
              </div>
            </Card>
          )}

          {/* ===== 9. AUDIO PLAYER + TRANSCRIPT (keep existing) ===== */}
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
              className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-6 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
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
