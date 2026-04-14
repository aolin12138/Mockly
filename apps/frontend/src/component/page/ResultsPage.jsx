'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clipboard } from 'lucide-react';

import { LoadingPage } from './LoadingPage';
import { SAMPLE_FEEDBACK } from './constants';

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

const USE_LOCAL_SAMPLE = false;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const FEEDBACK_REQUEST_LOCK_TTL_MS = 2 * 60 * 1000;
const FEEDBACK_POLL_INTERVAL_MS = 5_000;
const FEEDBACK_POLL_MAX_ATTEMPTS = 36;
const FEEDBACK_SSE_TIMEOUT_MS = 3 * 60 * 1000;

/* --- Transform the new feedback schema --- */
function transformFeedbackData(feedbackData) {
  if (!feedbackData) return null;

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
    dimensionScores: feedback.dimension_scores || [],
    answerBreakdown: feedback.answer_breakdown || [],
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
    transcript: Array.isArray(transcript)
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

/* --- Build dynamic section list for SectionNav --- */
function buildSections(data) {
  const sections = [];
  sections.push({ id: 'hero', label: 'Overview' });

  if (data.highlights?.bestMoment || data.highlights?.growthMoment) {
    sections.push({ id: 'highlights', label: 'Highlights' });
  }
  if (data.answerBreakdown.length > 0) {
    sections.push({ id: 'answers', label: 'STAR Breakdown' });
  }
  if (data.dimensionScores.length > 0) {
    sections.push({ id: 'dimensions', label: 'Skills' });
  }
  if (data.patterns.length > 0) {
    sections.push({ id: 'patterns', label: 'Patterns' });
  }
  if (data.strengths.length > 0 || data.areasForImprovement.length > 0) {
    sections.push({ id: 'strengths', label: 'Strengths & Growth' });
  }
  if (data.cvAlignment?.available) {
    sections.push({ id: 'cv-alignment', label: 'CV Alignment' });
  }
  if (data.nextSteps.length > 0) {
    sections.push({ id: 'next-steps', label: 'Next Steps' });
  }
  if (data.transcript?.length > 0) {
    sections.push({ id: 'replay', label: 'Replay' });
  }

  return sections;
}

/* --- Main Results Page --- */
export default function ResultsPage() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState(null);
  const [error, setError] = useState(null);

  const getFeedbackRequestLockKey = (sessionId) => `resultsFeedbackRequestLock:${sessionId}`;

  const hasFreshFeedbackRequestLock = (sessionId) => {
    try {
      const raw = sessionStorage.getItem(getFeedbackRequestLockKey(sessionId));
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const startedAt = Number(parsed?.startedAt || 0);
      if (!startedAt) return false;
      return Date.now() - startedAt < FEEDBACK_REQUEST_LOCK_TTL_MS;
    } catch {
      return false;
    }
  };

  const setFeedbackRequestLock = (sessionId) => {
    try {
      sessionStorage.setItem(getFeedbackRequestLockKey(sessionId), JSON.stringify({ startedAt: Date.now() }));
    } catch {
      // no-op if sessionStorage unavailable
    }
  };

  const clearFeedbackRequestLock = (sessionId) => {
    try {
      sessionStorage.removeItem(getFeedbackRequestLockKey(sessionId));
    } catch {
      // no-op if sessionStorage unavailable
    }
  };

  useEffect(() => {
    if (USE_LOCAL_SAMPLE) {
      const transformed = transformFeedbackData(SAMPLE_FEEDBACK);
      setFeedbackData(transformed);
      setIsLoading(false);
      return;
    }

    const fetchFeedback = async () => {
      try {
        const sessionId = urlSessionId || localStorage.getItem('currentSessionId');
        const token = localStorage.getItem('token');

        const waitForFeedbackViaSse = (activeSessionId) => new Promise((resolve) => {
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
            const response = await fetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
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
          const callbackDataStr = sessionStorage.getItem(`callbackData_${sessionId}`);
          if (callbackDataStr) {
            const callbackData = JSON.parse(callbackDataStr);
            if (callbackData.feedback) {
              const transformed = transformFeedbackData(callbackData.feedback);
              if (transformed) {
                setFeedbackData(transformed);
                setIsLoading(false);
                return;
              }
            }
          }
          navigate('/dashboard', { replace: true });
          return;
        }

        await new Promise((res) => setTimeout(res, 1000));

        // Check database for existing feedback
        const checkResponse = await fetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!checkResponse.ok) throw new Error('Failed to fetch session data');

        const sessionData = await checkResponse.json();
        const feedbackPrompt = sessionData.feedbackPrompt || sessionData.feedback_prompt;
        const agentId = sessionData.agentId || sessionData.agent_id;

        // Use cached feedback if available
        if (sessionData.feedback) {
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

        if (hasFreshFeedbackRequestLock(sessionId)) {
          const transformed = await pollSessionForFeedback({ maxAttempts: 3, intervalMs: 2000 });
          if (transformed) {
            setFeedbackData(transformed);
            setIsLoading(false);
            return;
          }
        }

        setFeedbackRequestLock(sessionId);

        try {
          // Generate feedback via backend route using the saved session id
          const response = await fetch(`${API_BASE_URL}/api/interview/session/${sessionId}/generate-feedback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
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
        } finally {
          clearFeedbackRequestLock(sessionId);
        }
      } catch (err) {
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
    transcript,
    audio,
  } = feedbackData;

  const sections = buildSections(feedbackData);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-emerald-100 overflow-hidden relative">
      <AmbientBackground />

      <SectionNav sections={sections} />

      <div className="relative z-10 min-h-screen flex justify-center px-4 py-8 lg:pl-16">
        <div className="w-full max-w-5xl space-y-8">
          {/* Hero */}
          <section id="hero">
            <HeroBanner summary={summary} meta={meta} />
          </section>

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
                  <h2 className="text-xl font-semibold text-slate-900">STAR Breakdown</h2>
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
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 px-6 py-3 text-sm font-medium hover:bg-slate-100 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-all cursor-pointer"
            >
              Practice Again
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
