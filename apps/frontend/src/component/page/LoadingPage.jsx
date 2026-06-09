import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { authFetch, ensureAuthenticated } from '../../lib/auth';

export function LoadingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing Your Feedback');
  const [subStatus, setSubStatus] = useState('Analyzing your interview performance…');
  const hasStartedProcessing = useRef(false);
  const latestStateRef = useRef(null);
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const PROCESSING_LOCK_TTL_MS = 2 * 60 * 1000;

  const getProcessingLockKey = (state) => {
    const type = (state?.type || 'unknown').toLowerCase();
    const sessionPart = state?.sessionId || state?.conversationId || state?.executionSummary?.conversationId || 'no-session';
    return `loadingProcessingLock:${type}:${sessionPart}`;
  };

  const hasFreshProcessingLock = (lockKey) => {
    try {
      const raw = sessionStorage.getItem(lockKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const startedAt = Number(parsed?.startedAt || 0);
      if (!startedAt) return false;
      return Date.now() - startedAt < PROCESSING_LOCK_TTL_MS;
    } catch {
      return false;
    }
  };

  const setProcessingLock = (lockKey) => {
    try {
      sessionStorage.setItem(lockKey, JSON.stringify({ startedAt: Date.now() }));
    } catch {
      // no-op if sessionStorage unavailable
    }
  };

  const clearProcessingLock = (lockKey) => {
    try {
      sessionStorage.removeItem(lockKey);
    } catch {
      // no-op if sessionStorage unavailable
    }
  };

  useEffect(() => {
    // Prevent double-call from React StrictMode
    if (hasStartedProcessing.current) {
      console.log('[LoadingPage] Already processing, skipping...');
      return;
    }

    const state = location.state || {};
    latestStateRef.current = state;
    console.log('[LoadingPage] state:', state);
    const lockKey = getProcessingLockKey(state);

    if (hasFreshProcessingLock(lockKey)) {
      console.log('[LoadingPage] Duplicate processing attempt blocked for key:', lockKey);
      setStatus('Processing Your Feedback');
      setSubStatus('Your interview is already being processed…');
      return;
    }

    setProcessingLock(lockKey);

    // If we have technical interview data to process (handle both 'Technical' and 'technical')
    const isTechnicalType = state.type?.toLowerCase() === 'technical';
    if (isTechnicalType && state.executionSummary && state.webhookUrl) {
      hasStartedProcessing.current = true;
      processTechnicalFeedback(state, lockKey);
    } else if (state.type?.toLowerCase() === 'behavioral' && state.sessionId) {
      hasStartedProcessing.current = true;
      processBehavioralFeedback(state, lockKey);
    } else if (state.feedback) {
      // Already have feedback, go to results
      hasStartedProcessing.current = true;
      clearProcessingLock(lockKey);
      navigateToResults(state);
    } else {
      clearProcessingLock(lockKey);
    }
  }, [location.state]);

  const getCallbackSessionData = (sessionId) => {
    try {
      const raw = sessionStorage.getItem(`callbackData_${sessionId}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        sessionId: data.persistedSessionId || data.sessionId || null,
        agentId: data.agentId || data.agent_id || localStorage.getItem('currentAgentId') || null,
        conversationId: data.conversationId || data.conversation_id || null,
        interviewPlan: data.interviewPlan || data.interview_plan || null,
        interviewPrompt: data.interviewPrompt || data.interview_prompt || null,
        feedbackPrompt: data.feedbackPrompt || data.feedback_prompt || data.feedback_prompt_final || null,
      };
    } catch (error) {
      console.warn('[LoadingPage] Failed to parse callback session data:', error);
      return null;
    }
  };

  const processTechnicalFeedback = async (state, lockKey) => {
    const { executionSummary, webhookUrl, sessionId: stateSessionId, conversationId, duration } = state;
    const token = ensureAuthenticated();
    if (!token) {
      clearProcessingLock(lockKey);
      return;
    }

    let finalSessionId = stateSessionId;
    console.log('[LoadingPage] Initial session ID:', finalSessionId);

    try {
      if (!stateSessionId) {
        throw new Error('Missing technical session ID.');
      }

      setStatus('Processing Your Interview');
      setSubStatus('Saving your session data…');

      // Backend already marked session as ended and triggered feedback.
      // Poll for feedback a few times before giving up.
      let feedbackData = null;
      const maxPolls = 6;
      for (let i = 0; i < maxPolls; i++) {
        try {
          const sessionResponse = await authFetch(`${API_BASE_URL}/api/interview/session/${finalSessionId}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            feedbackData = sessionData.feedback || null;
            if (feedbackData) {
              console.log('[LoadingPage] Feedback ready after', i + 1, 'polls');
              break;
            }
          }
        } catch (e) { /* ignore poll errors */ }
        
        if (i < maxPolls - 1) {
          setSubStatus(`Waiting for AI feedback… (attempt ${i + 1}/${maxPolls})`);
          await new Promise(res => setTimeout(res, 3000));
        }
      }

      if (feedbackData) {
        setStatus('Feedback Ready');
        setSubStatus('Redirecting to your results…');
      } else {
        setStatus('Feedback Still Processing');
        setSubStatus('This may take a minute. You can check back from your dashboard.');
        setShowRecoveryActions(true);
        await new Promise(res => setTimeout(res, 2000));
      }

      // Navigate to results — with or without feedback
      const navigateTo = `/results-technical/${finalSessionId}`;
      console.log('[LoadingPage] Navigating to:', navigateTo, '| feedback:', feedbackData ? 'present' : 'missing');

      navigate(navigateTo, {
        replace: true,
        state: {
          fromInterview: true,
          executionSummary,
          conversationId,
          feedback: feedbackData,
        }
      });

    } catch (err) {
      if (err?.code === 'AUTH_REQUIRED' || err?.code === 'AUTH_EXPIRED') return;
      console.error('Error processing feedback:', err);
      setStatus('Error');
      setSubStatus('Something went wrong. Please try again.');

      // Still try to navigate even on error
      setTimeout(() => {
        navigate(`/results-technical/${finalSessionId}`, {
          replace: true,
          state: { fromInterview: true, feedback: feedbackData }
        });
      }, 2000);
    } finally {
      clearProcessingLock(lockKey);
    }
  };

  const processBehavioralFeedback = async (state, lockKey) => {
    const { sessionId: rawSessionId, duration, company, candidateCv } = state;
    const sessionId = rawSessionId;
    const token = ensureAuthenticated();
    if (!token) {
      clearProcessingLock(lockKey);
      return;
    }
    let persistedSessionId = null;

    try {
      setShowRecoveryActions(false);
      setStatus('Finalizing Session');
      setSubStatus('Loading your interview configuration…');

      let sessionData = null;
      const sessionResponse = await authFetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (sessionResponse.ok) {
        sessionData = await sessionResponse.json();
      } else {
        console.warn('[LoadingPage] Session lookup failed, trying callback fallback:', sessionResponse.status);
        sessionData = getCallbackSessionData(sessionId);
      }

      if (!sessionData) {
        throw new Error('Failed to load session data');
      }

      const effectiveSessionId = sessionData.sessionId || sessionId;
      const resolvedAgentId = sessionData.agentId || sessionData.agent_id;
      const conversationId = sessionData.conversationId || sessionData.conversation_id || null;
      const feedbackPrompt = sessionData.feedbackPrompt || sessionData.feedback_prompt;

      if (!resolvedAgentId || !feedbackPrompt) {
        throw new Error('Session missing agent or feedback prompt.');
      }

      setStatus('Saving Session');
      setSubStatus('Storing your interview session…');

      const initialSaveResponse = await authFetch(`${API_BASE_URL}/api/interview/behavioral/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: effectiveSessionId,
          agentId: resolvedAgentId,
          conversationId,
          interviewPlan: sessionData.interviewPlan || null,
          interviewPrompt: sessionData.interviewPrompt || null,
          feedbackPrompt,
          feedback: null,
          duration,
        }),
      });

      if (!initialSaveResponse.ok) {
        const errorText = await initialSaveResponse.text();
        throw new Error(errorText || `Failed to save session (${initialSaveResponse.status})`);
      }

      const initialSaveResult = await initialSaveResponse.json();
      persistedSessionId = initialSaveResult.sessionId;

      setStatus('Generating Feedback');
      setSubStatus('AI is analyzing your interview…');

      const feedbackResponse = await authFetch(`${API_BASE_URL}/api/interview/session/${persistedSessionId}/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: resolvedAgentId,
          conversation_id: conversationId,
          feedback_prompt: feedbackPrompt,
        }),
      });

      const feedbackText = await feedbackResponse.text();
      if (feedbackResponse.status === 202) {
        setStatus('Feedback In Progress');
        setSubStatus('Your feedback is processing in the background. Opening results…');
        await new Promise((res) => setTimeout(res, 800));

        navigate(`/results/${persistedSessionId}`, {
          replace: true,
          state: {
            fromInterview: true,
            type: 'behavioral',
            sessionId: persistedSessionId,
            company,
            candidateCv,
            duration,
          },
        });
        return;
      }

      if (!feedbackResponse.ok) {
        if (feedbackResponse.status === 404) {
          throw new Error('Feedback endpoint not found. Please restart the backend server.');
        }
        throw new Error(feedbackText || 'Failed to generate behavioral feedback');
      }

      const feedbackPayload = feedbackText ? JSON.parse(feedbackText) : {};
      const generatedFeedback = feedbackPayload.feedback || null;
      if (!generatedFeedback) {
        setStatus('Feedback In Progress');
        setSubStatus('Your feedback is processing in the background. Opening results…');
        await new Promise((res) => setTimeout(res, 800));

        navigate(`/results/${persistedSessionId}`, {
          replace: true,
          state: {
            fromInterview: true,
            type: 'behavioral',
            sessionId: persistedSessionId,
            company,
            candidateCv,
            duration,
          },
        });
        return;
      }

      setStatus('Feedback Ready');
      setSubStatus('Redirecting to your results…');
      await new Promise((res) => setTimeout(res, 800));

      navigate(`/results/${persistedSessionId}`, {
        replace: true,
        state: {
          fromInterview: true,
          type: 'behavioral',
          sessionId: persistedSessionId,
          feedback: generatedFeedback,
          company,
          candidateCv,
          duration,
        },
      });
    } catch (err) {
      if (err?.code === 'AUTH_REQUIRED' || err?.code === 'AUTH_EXPIRED') return;
      console.error('Error processing behavioral feedback:', err);
      if (persistedSessionId) {
        setStatus('Session Saved');
        setSubStatus('Feedback failed for now. You can retry from results or history.');
        setTimeout(() => {
          navigate(`/results/${persistedSessionId}`, {
            replace: true,
            state: {
              fromInterview: true,
              type: 'behavioral',
              sessionId: persistedSessionId,
              company,
              candidateCv,
              duration,
            },
          });
        }, 1200);
      } else {
        setStatus('Error');
        setSubStatus(err?.message || 'Failed to process interview feedback. You can retry or return to dashboard.');
        setShowRecoveryActions(true);
      }
    } finally {
      clearProcessingLock(lockKey);
    }
  };

  const handleRetry = () => {
    const state = latestStateRef.current || location.state || {};
    if (state.type?.toLowerCase() === 'behavioral' && state.sessionId) {
      processBehavioralFeedback(state);
      return;
    }
    if (state.type?.toLowerCase() === 'technical' && state.executionSummary && state.webhookUrl) {
      processTechnicalFeedback(state);
      return;
    }
    setSubStatus('Missing session context. Please return to dashboard and try again.');
  };

  const navigateToResults = (state) => {
    const { sessionId, type } = state;
    // Check if it's a technical interview - handle both 'Technical' and 'technical'
    const isTechnical = type?.toLowerCase() === 'technical' || window.location.pathname.includes('technical');
    const resultsPath = isTechnical
      ? `/results-technical/${sessionId}`
      : `/results/${sessionId}`;

    console.log('[LoadingPage] navigateToResults - type:', type, 'isTechnical:', isTechnical, 'path:', resultsPath);

    setTimeout(() => {
      navigate(resultsPath, { replace: true, state });
    }, 1500);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden relative px-4'>
      {/* Ambient gradient blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Loading content */}
      <motion.div
        className='flex flex-col items-center gap-6 relative z-10'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Animated spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className='relative h-16 w-16'
        >
          <div className='absolute inset-0 rounded-full border-2 border-slate-700 border-opacity-30' />
          <div className='absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-cyan-400' />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className='absolute inset-1 rounded-full border-2 border-transparent border-b-purple-400 border-l-emerald-400'
          />
        </motion.div>

        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className='text-center'
        >
          <p className='text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400'>
            {status}
          </p>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className='text-sm text-slate-400 mt-2'
          >
            {subStatus}
          </motion.p>
        </motion.div>

        {/* Progress indicator dots */}
        <motion.div className='flex gap-2 mt-4'>
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.2,
              }}
              className='h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400'
            />
          ))}
        </motion.div>

        {showRecoveryActions && (
          <div className='mt-3 flex flex-col sm:flex-row gap-3'>
            <button
              type='button'
              onClick={handleRetry}
              className='inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2.5 text-sm font-medium'
            >
              Retry
            </button>
            <button
              type='button'
              onClick={() => navigate('/dashboard', { replace: true })}
              className='inline-flex items-center justify-center rounded-full border border-white/10 text-white px-5 py-2.5 text-sm font-medium hover:bg-white/5'
            >
              Back to dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default LoadingPage;
