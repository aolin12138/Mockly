'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Clipboard } from 'lucide-react';

import { LoadingPage } from './LoadingPage';
import { SAMPLE_FEEDBACK } from './constants';
import { useTheme } from '../../context/ThemeContext';

// Shared results components
import AmbientBackground from '../results/AmbientBackground';
import ErrorState from '../results/ErrorState';
import TranscriptCard from '../results/TranscriptCard';
import SectionNav from '../results/SectionNav';
import Card from '../results/Card';

// Section components
import HeroBanner from '../results/HeroBanner';
import HighlightsCard from '../results/HighlightsCard';
import AnswerCard from '../results/AnswerCard';
import DimensionRadar from '../results/DimensionRadar';
import PatternsList from '../results/PatternsList';
import StrengthsImprovements from '../results/StrengthsImprovements';
import CvAlignmentSection from '../results/CvAlignmentSection';
import NextStepsList from '../results/NextStepsList';
import GapAnalysis from '../results/GapAnalysis';
import ProjectSuggestions from '../results/ProjectSuggestions';
import Roadmap from '../results/Roadmap';
import InterviewTips from '../results/InterviewTips';
import { authFetch, ensureAuthenticated } from '../../lib/auth';

void motion;

const USE_LOCAL_SAMPLE = false;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const FEEDBACK_POLL_INTERVAL_MS = 5_000;
const FEEDBACK_POLL_MAX_ATTEMPTS = 36;
const FEEDBACK_SSE_TIMEOUT_MS = 3 * 60 * 1000;

// Convert dimension_scores (object or array) to the array format components expect
function normalizeDimensionScores(raw) {
  if (Array.isArray(raw)) return raw.map(d => ({
    dimension: d.name || d.dimension || '',
    score: d.score || 0,
    evidence: Array.isArray(d.evidence) ? d.evidence : Array.isArray(d.observations) ? d.observations : [{ observation: d.note || '' }],
  }));
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([name, val]) => ({
      dimension: name,
      score: typeof val === 'object' ? (val.score || 0) : (val || 0),
      evidence: typeof val === 'object' ? [{ observation: val.note || '' }] : [{ observation: '' }],
    }));
  }
  return [];
}

function hasUsableFeedbackPayload(rawFeedback) {
  if (rawFeedback == null) return false;

  let payload = rawFeedback;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return false;
    }
  }

  if (Array.isArray(payload)) {
    payload = payload[0];
  }

  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'feedback')) {
    payload = payload.feedback;
  }

  if (payload == null) return false;
  if (typeof payload !== 'object' || Array.isArray(payload)) return Boolean(payload);

  return Object.keys(payload).length > 0;
}

/* --- Transform the new feedback schema --- */
function transformFeedbackData(feedbackData) {
  if (!hasUsableFeedbackPayload(feedbackData)) return null;

  let data = Array.isArray(feedbackData) ? feedbackData[0] : feedbackData;
  if (data?.data && typeof data.data === 'object') {
    data = { ...data.data, ...data };
  }
  const feedback = data.feedback || data;
  const transcript = data.transcript || data.transcripts || feedback.transcript || feedback.transcripts;
  const audio = data.audio;

  // Support both new schema (summary.overall_score) and legacy (overall_score at root)
  const summary = feedback.summary || {};
  const meta = feedback.meta || {};

  return {
    meta,
    summary: {
      overallScore: summary.overall_score ?? feedback.overall_score ?? null,
      oneLiner: summary.one_liner || feedback.overall_feedback || null,
      recommendation: summary.recommendation || feedback.overall_recommendation || null,
      readiness: summary.readiness || null,
    },
    dimensionScores: normalizeDimensionScores(feedback.dimension_scores || feedback.dimensions || {}),
    answerBreakdown: (feedback.answer_breakdown || feedback.star_examples || []).map(se => {
      // If already in answer_breakdown format, pass through
      if (se.star && typeof se.star === 'object') return se;
      // Convert star_examples format to answer_breakdown format
      const starStr = se.rewritten_star || '';
      const parsed = {};
      for (const label of ['Situation', 'Task', 'Action', 'Result']) {
        const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n(?:${['Situation','Task','Action','Result'].join('|')}):|$)`, 'i');
        const m = starStr.match(re);
        parsed[label.toLowerCase()] = m ? m[1].trim() : '';
      }
      return {
        question: se.question || '',
        quality: se.worth_rewriting ? 'weak' : 'strong',
        domain: se.domain || null,
        originalAnswer: se.original_answer || '',
        star: parsed,
        observation: se.why || '',
      };
    }),
    patterns: feedback.patterns || [],
    highlights: feedback.highlights
      ? {
          bestMoment: feedback.highlights.best_moment || null,
          growthMoment: feedback.highlights.growth_moment || null,
        }
      : null,
    cvAlignment: feedback.cv_interview_alignment || null,
    strengths: feedback.strengths || [],
    areasForImprovement: feedback.areas_for_improvement || [],
    nextSteps: feedback.next_steps || [],
    // Coaching feedback fields (new schema)
    gapAnalysis: feedback.gap_analysis || null,
    projectSuggestions: feedback.project_suggestions || [],
    roadmap: feedback.roadmap || null,
    interviewTips: feedback.interview_tips || [],
    praiseWorthy: feedback.praise_worthy || [],
    insufficientData: feedback.insufficient_data || false,
    // Research resources are distributed into their sections (project/gap/interview);
    // interviewPrepResources feeds the Interview Tips section.
    interviewPrepResources: feedback.interview_prep_resources || [],
    transcript: (() => {
      // Already an array of {role, text} — pass through directly
      if (Array.isArray(transcript)) {
        return transcript.map((msg, index) => ({
          id: index + 1,
          role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
          text: msg.text || msg.message || '',
          timestart: msg.timestart ?? null,
        }));
      }
      // Legacy string format: parse INTERVIEWER/CANDIDATE lines
      if (typeof transcript === 'string' && transcript.trim()) {
        const turns = [];
        const lines = transcript.split(/\n(?=INTERVIEWER:|CANDIDATE:)/);
        for (const line of lines) {
          if (line.startsWith('INTERVIEWER:')) {
            turns.push({ role: 'assistant', text: line.replace(/^INTERVIEWER:\s*/, '') });
          } else if (line.startsWith('CANDIDATE:')) {
            turns.push({ role: 'user', text: line.replace(/^CANDIDATE:\s*/, '') });
          }
        }
        return turns;
      }
      return null;
    })(),
    audio,
  };
}

/* --- Build dynamic section list for SectionNav --- */
function buildSections(data) {
  const sections = [];
  const incomplete = data.insufficientData || data.meta?.confidence_level === 'low';

  sections.push({ id: 'hero', label: 'Overview' });

  sections.push({ id: 'highlights', label: 'Highlights' });

  if (data.answerBreakdown.length > 0 || incomplete) {
    sections.push({ id: 'answers', label: 'STAR Breakdown' });
  }
  if (data.dimensionScores.length > 0) {
    sections.push({ id: 'dimensions', label: 'Skills' });
  }
  if (data.patterns.length > 0 || incomplete) {
    sections.push({ id: 'patterns', label: 'Patterns' });
  }
  sections.push({ id: 'strengths', label: 'Strengths & Growth' });

  sections.push({ id: 'cv-alignment', label: 'CV Alignment' });

  sections.push({ id: 'next-steps', label: 'Next Steps' });

  // Coaching sections
  sections.push({ id: 'gap-analysis', label: 'Gap Analysis' });
  sections.push({ id: 'projects', label: 'Projects' });
  sections.push({ id: 'roadmap', label: 'Roadmap' });
  sections.push({ id: 'tips', label: 'Interview Tips' });
  if (data.transcript?.length > 0) {
    sections.push({ id: 'replay', label: 'Replay' });
  }

  return sections;
}

/* --- Main Results Page --- */
export default function ResultsPage() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const sampleCase = searchParams.get('sample');
  const audioRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const hasStartedFetchRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasStartedFetchRef.current) {
      return;
    }
    hasStartedFetchRef.current = true;

    if (USE_LOCAL_SAMPLE) {
      const transformed = transformFeedbackData(SAMPLE_FEEDBACK);
      setFeedbackData(transformed);
      setIsLoading(false);
      return;
    }

    const fetchFeedback = async () => {
      try {
        // Sample preview mode — load from /samples/<case-id>.json (served by Vite)
        if (sampleCase) {
          const res = await fetch(`/samples/${sampleCase}.json`);
          if (!res.ok) throw new Error(`Sample not found: ${sampleCase}`);
          const sampleData = await res.json();
          const transformed = transformFeedbackData(sampleData);
          setFeedbackData(transformed);
          setIsLoading(false);
          return;
        }

        let sessionId = urlSessionId || localStorage.getItem('currentSessionId');
        const token = ensureAuthenticated();
        if (!token) return;

    const waitForFeedbackViaSse = (activeSessionId) => new Promise((resolve, reject) => {
          if (!token) {
            resolve(null);
            return;
          }

          const streamUrl = `${API_BASE_URL}/api/interview/session/${activeSessionId}/feedback-stream?token=${encodeURIComponent(token)}`;
          const source = new EventSource(streamUrl);
          let settled = false;

          const settle = (value) => {
            if (settled) return;
            settled = true;
            source.close();
            resolve(value);
          };

          const timeout = setTimeout(() => settle(null), FEEDBACK_SSE_TIMEOUT_MS);

          source.addEventListener('feedback-ready', (event) => {
            try {
              const payload = JSON.parse(event.data || '{}');
              const transformed = transformFeedbackData(payload.feedback);
              clearTimeout(timeout);
              settle(transformed || null);
            } catch {
              clearTimeout(timeout);
              settle(null);
            }
          });

          source.addEventListener('feedback-error', (event) => {
            try {
              const payload = JSON.parse(event.data || '{}');
              clearTimeout(timeout);
              source.close();
              reject(new Error(payload?.message || 'Feedback workflow failed.'));
            } catch {
              clearTimeout(timeout);
              source.close();
              reject(new Error('Feedback workflow failed.'));
            }
          });

          source.onerror = () => {
            clearTimeout(timeout);
            settle(null);
          };
        });

        const pollSessionForFeedback = async ({
          maxAttempts = FEEDBACK_POLL_MAX_ATTEMPTS,
          intervalMs = FEEDBACK_POLL_INTERVAL_MS,
        } = {}) => {
          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await authFetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              if (data?.feedback) {
                return transformFeedbackData(data.feedback);
              }
            }

            if (attempt < maxAttempts - 1) {
              await new Promise((res) => setTimeout(res, intervalMs));
            }
          }

          return null;
        };

        if (!sessionId) {
          setError('No session ID found. Please start a new interview session.');
          setIsLoading(false);
          return;
        }

        // Temp session — use sessionStorage
        if (sessionId.startsWith('temp_')) {
          const promotedSessionId = localStorage.getItem('currentPersistedSessionId');
          if (promotedSessionId && !promotedSessionId.startsWith('temp_')) {
            sessionId = promotedSessionId;
          } else {
            const callbackDataStr = sessionStorage.getItem(`callbackData_${sessionId}`);
            if (callbackDataStr) {
              const callbackData = JSON.parse(callbackDataStr);
              const callbackPersistedSessionId = callbackData.persistedSessionId || callbackData.sessionId || null;
              if (callbackPersistedSessionId && !String(callbackPersistedSessionId).startsWith('temp_')) {
                sessionId = callbackPersistedSessionId;
              }
              if (callbackData.feedback) {
                const transformed = transformFeedbackData(callbackData.feedback);
                if (transformed) {
                  setFeedbackData(transformed);
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
        }

        await new Promise((res) => setTimeout(res, 1000));

        // Check database for existing feedback
        const checkResponse = await authFetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!checkResponse.ok) throw new Error('Failed to fetch session data');

        const sessionData = await checkResponse.json();
        const feedbackPrompt = sessionData.feedbackPrompt || sessionData.feedback_prompt;
        const agentId = sessionData.agentId || sessionData.agent_id;

        // Use cached feedback if available
        if (hasUsableFeedbackPayload(sessionData.feedback)) {
          const transformed = transformFeedbackData(sessionData.feedback);
          if (transformed) {
            setFeedbackData(transformed);
            setIsLoading(false);
            return;
          }
        }

        if (!feedbackPrompt || !agentId) {
          throw new Error('Session data incomplete. Cannot generate feedback.');
        }

        // Generate feedback via backend route using the saved session id
        const response = await authFetch(`${API_BASE_URL}/api/interview/session/${sessionId}/generate-feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: agentId,
            feedback_agent_prompt: feedbackPrompt,
            feedback_prompt: feedbackPrompt,
          }),
        });

        const responseText = await response.text();
        if (response.status === 202) {
          const sseFeedback = await waitForFeedbackViaSse(sessionId);
          if (sseFeedback) {
            setFeedbackData(sseFeedback);
            return;
          }

          const transformed = await pollSessionForFeedback();
          if (transformed) {
            setFeedbackData(transformed);
            return;
          }
          throw new Error('Feedback is still processing. Please wait a moment and retry.');
        }

        if (!response.ok) throw new Error(`Webhook request failed: ${responseText || response.statusText}`);
        if (!responseText) throw new Error('Webhook returned empty response');

        const generationResult = JSON.parse(responseText);
        const rawFeedback = generationResult.feedback || generationResult;
        const transformed = transformFeedbackData(rawFeedback);

        if (transformed) {
          setFeedbackData(transformed);
          return;
        }

        const polledFeedback = await pollSessionForFeedback();
        if (polledFeedback) {
          setFeedbackData(polledFeedback);
          return;
        }

        throw new Error('Feedback is still processing. Please wait a moment and retry.');
      } catch (err) {
        if (err?.code === 'AUTH_REQUIRED' || err?.code === 'AUTH_EXPIRED') return;
        console.error('Error fetching feedback:', err);
        setError(err.message || 'Failed to process interview feedback. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  if (isLoading) return <LoadingPage />;

  if (error || !feedbackData) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          localStorage.removeItem('interviewFeedback');
          localStorage.removeItem('interviewError');
          window.location.reload();
        }}
        onNavigate={() => navigate('/')}
        navigateLabel="Start new interview"
      />
    );
  }

  const {
    meta,
    summary,
    dimensionScores,
    answerBreakdown,
    patterns,
    highlights,
    cvAlignment,
    strengths,
    areasForImprovement,
    nextSteps,
    // Coaching fields (new schema)
    gapAnalysis,
    projectSuggestions,
    roadmap,
    interviewTips,
    praiseWorthy,
    insufficientData,
    interviewPrepResources,
    transcript,
    audio,
  } = feedbackData;

  const sections = buildSections(feedbackData);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans antialiased selection:bg-emerald-100 dark:selection:bg-emerald-500/30 overflow-hidden relative">
      <AmbientBackground />

      <SectionNav sections={sections} />

      <div className="relative z-10 min-h-screen flex justify-center px-4 py-8 lg:pl-16">
        <div className="w-full max-w-5xl space-y-8">
          {/* Hero */}
          <section id="hero">
            <HeroBanner summary={summary} meta={meta} />

            {/* Theme toggle */}
            <div className="flex justify-end mb-4">
              <button onClick={toggleTheme}
                className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </section>

          {/* Incomplete session notice */}
          {insufficientData && (
            <Card delay={0.05} className="border-amber-200/80 bg-amber-50/60 dark:bg-amber-500/10 dark:border-amber-500/20">
              <p className="text-base font-semibold text-amber-800 dark:text-amber-300">⚠️ Limited data</p>
              <p className="text-base text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                This session ended before enough conversation was captured for a full evaluation. Scores and analysis are based on available data and may not reflect your full abilities. Some sections below are unavailable or limited.
              </p>
            </Card>
          )}

          {/* Reading guide */}
          <Card delay={0.1} className="border-emerald-200/80 bg-emerald-50/60">
            <p className="text-base font-semibold text-emerald-800">Recommended reading order</p>
            <p className="text-base text-emerald-700 mt-1 leading-relaxed">
              Review your STAR breakdown first, then move to skills and patterns to see what to repeat and what to fix next.
            </p>
          </Card>

          {/* Answer Breakdown — STAR Grid */}
          {answerBreakdown.length > 0 && (
            <section id="answers">
              <Card delay={0.2}>
                <div className="flex items-center gap-2 mb-5">
                  <Clipboard className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">STAR Breakdown</h2>
                </div>
                <div className="space-y-4">
                  {answerBreakdown.map((answer, idx) => (
                    <AnswerCard key={idx} answer={answer} index={idx} />
                  ))}
                </div>
              </Card>
            </section>
          )}

          {/* Highlights */}
          {highlights && (highlights.bestMoment || highlights.growthMoment) && (
            <section id="highlights">
              <HighlightsCard highlights={highlights} />
            </section>
          )}

          {/* Dimension Scores with Radar */}
          {dimensionScores.length > 0 && (
            <section id="dimensions">
              <DimensionRadar dimensionScores={dimensionScores} />
            </section>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <section id="patterns">
              <PatternsList patterns={patterns} />
            </section>
          )}

          {/* Strengths & Improvements */}
          {(strengths.length > 0 || areasForImprovement.length > 0) && (
            <section id="strengths">
              <StrengthsImprovements strengths={strengths} areasForImprovement={areasForImprovement} />
            </section>
          )}

          {/* CV Alignment */}
          {cvAlignment?.available && (
            <section id="cv-alignment">
              <CvAlignmentSection cvAlignment={cvAlignment} />
            </section>
          )}

          {/* Next Steps */}
          {nextSteps.length > 0 && (
            <section id="next-steps">
              <NextStepsList nextSteps={nextSteps} />
            </section>
          )}

          {/* ── Coaching Sections (new schema) ── */}

          {/* Gap Analysis (resources embedded on missing skills) */}
          {gapAnalysis && (
            <section id="gap-analysis">
              <GapAnalysis gapAnalysis={gapAnalysis} />
            </section>
          )}

          {/* Project Suggestions */}
          {projectSuggestions.length > 0 && (
            <section id="projects">
              <ProjectSuggestions projects={projectSuggestions} />
            </section>
          )}

          {/* Roadmap */}
          {roadmap && (
            <section id="roadmap">
              <Roadmap roadmap={roadmap} />
            </section>
          )}

          {/* Interview Tips (with STAR / behavioral prep resources) */}
          {interviewTips.length > 0 && (
            <section id="tips">
              <InterviewTips tips={interviewTips} resources={interviewPrepResources} />
            </section>
          )}

           {/* Transcript Replay */}
           {transcript && transcript.length > 0 && (
             <section id="replay">
               <TranscriptCard transcript={transcript} audio={audio} audioRef={audioRef} delay={0.45} />
             </section>
           )}

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="pt-3 pb-8 flex justify-center gap-4"
          >
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-6 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-all cursor-pointer"
            >
              Practice Again
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
