import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

export function LoadingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing Your Feedback');
  const [subStatus, setSubStatus] = useState('Analyzing your interview performance…');
  const hasStartedProcessing = useRef(false);

  useEffect(() => {
    // Prevent double-call from React StrictMode
    if (hasStartedProcessing.current) {
      console.log('[LoadingPage] Already processing, skipping...');
      return;
    }

    const state = location.state || {};
    console.log('[LoadingPage] state:', state);

    // If we have technical interview data to process (handle both 'Technical' and 'technical')
    const isTechnicalType = state.type?.toLowerCase() === 'technical';
    if (isTechnicalType && state.executionSummary && state.webhookUrl) {
      hasStartedProcessing.current = true;
      processTechnicalFeedback(state);
    } else if (state.feedback) {
      // Already have feedback, go to results
      hasStartedProcessing.current = true;
      navigateToResults(state);
    }
  }, [location.state]);

  const processTechnicalFeedback = async (state) => {
    const { executionSummary, webhookUrl, sessionId: stateSessionId, conversationId, duration } = state;
    const token = localStorage.getItem('token');

    // Ensure we have a session ID (generate one if not provided)
    let finalSessionId = stateSessionId || `tech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[LoadingPage] Initial session ID:', finalSessionId);

    let feedbackData = null;

    try {
      setStatus('Sending to AI Evaluator');
      setSubStatus('Preparing your interview data…');

      // Send to n8n webhook
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(executionSummary),
      });

      setStatus('Generating Feedback');
      setSubStatus('AI is analyzing your performance…');

      if (!webhookResponse.ok) {
        console.error('Failed to send to n8n webhook:', webhookResponse.statusText);
        setStatus('Error');
        setSubStatus('Failed to generate feedback. Redirecting…');
        await new Promise(res => setTimeout(res, 2000));
      } else {
        console.log('Successfully sent to n8n webhook');
        try {
          feedbackData = await webhookResponse.json();
          console.log('Received feedback from n8n:', feedbackData);
        } catch (parseErr) {
          console.error('Failed to parse n8n response:', parseErr);
        }
      }

      // Save session to database with feedback (even if feedbackData is null)
      if (feedbackData) {
        setStatus('Saving Results');
        setSubStatus('Storing your interview session…');

        try {
          const saveResponse = await fetch('http://localhost:3000/api/interview/technical/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              conversationId,
              executionSummary,
              feedback: feedbackData,
              duration, // Duration in seconds
            }),
          });

          if (saveResponse.ok) {
            const saveResult = await saveResponse.json();
            finalSessionId = saveResult.sessionId;
            console.log('[LoadingPage] Session saved to database, new ID:', finalSessionId);
          } else {
            const errorText = await saveResponse.text();
            console.error('Failed to save session to database:', saveResponse.status, errorText);
          }
        } catch (saveErr) {
          console.error('Error saving session:', saveErr);
        }
      }

      setStatus('Feedback Ready');
      setSubStatus('Redirecting to your results…');
      await new Promise(res => setTimeout(res, 1000));

      // Navigate to results page
      const navigateTo = `/results-technical/${finalSessionId}`;
      console.log('[LoadingPage] Navigating to:', navigateTo);
      console.log('[LoadingPage] With state feedback:', feedbackData ? 'present' : 'missing');

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
    }
  };

  const navigateToResults = (state) => {
    const { sessionId, type, fromInterview } = state;
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
      </motion.div>
    </div>
  );
}

export default LoadingPage;
