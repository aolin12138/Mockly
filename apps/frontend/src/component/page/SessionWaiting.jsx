import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleOrb from '../ui/particle-orb.jsx';

const loadingMessages = [
  'Preparing your interview...',
  'Feeding the prompt...',
  'Processing your requirements...',
  'Setting up the desk...',
  'Analyzing your profile...',
  'Crafting personalized questions...',
  'Configuring the AI agent...',
  'Almost ready...'
];

export default function SessionWaiting() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [callbackData, setCallbackData] = useState(null);
  const isActiveRef = useRef(true);
  const pollIntervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const MotionH2 = motion.h2;
  const MotionDiv = motion.div;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Navigate reactively when callbackData has enough setup info to start the interview
  useEffect(() => {
    if (!callbackData || !sessionId) return;

    // Consider setup "ready" if we have an agentId OR interview prompts/plan
    const isReady = callbackData.agentId || callbackData.interviewPlan || callbackData.interviewPrompt;
    if (!isReady) {
      console.log('[SessionWaiting] Callback data received but missing agentId and prompts, waiting…');
      return;
    }

    console.log('[SessionWaiting] Setup data ready:', {
      agentId: callbackData.agentId || 'none',
      hasInterviewPlan: !!callbackData.interviewPlan,
      hasInterviewPrompt: !!callbackData.interviewPrompt,
    });

    // Store callback data in sessionStorage for the interview page
    sessionStorage.setItem(`callbackData_${sessionId}`, JSON.stringify(callbackData));

    const mode = localStorage.getItem('pendingInterviewMode') || 'behavioral';
    const routeMap = {
      'behavioral': 'behavioural',
      'technical': 'technical',
      'behavioral_plus_dsa': 'behavioural'
    };
    const route = routeMap[mode] || 'behavioural';
    console.log(`[SessionWaiting] Navigating to /${route}/${sessionId}`);
    navigate(`/${route}/${sessionId}`);
  }, [callbackData, sessionId, navigate]);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // For temporary sessions (format: temp_*), poll for callback data then go to interview
    if (sessionId.startsWith('temp_')) {
      localStorage.setItem('currentSessionId', sessionId);

      // Reset refs for this effect run
      isActiveRef.current = true;
      pollCountRef.current = 0;

      const maxPolls = 60; // Soft limit (3 minutes); keep polling after warning

      const pollCallbackData = async () => {
        if (!isActiveRef.current) return;
        
        if (pollCountRef.current >= maxPolls) {
          console.warn(`[SessionWaiting] Soft timeout after ${pollCountRef.current} polls for session ${sessionId}`);
          setErrorMessage('Setup is taking longer than expected. We are still checking…');
        }

        pollCountRef.current++;
        console.log(`[SessionWaiting] Poll #${pollCountRef.current} for session ${sessionId}`);

        try {
          const url = `http://localhost:3000/api/interview/session/${sessionId}/callback-data`;
          const response = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          console.log(`[SessionWaiting] Response status: ${response.status}`);

          if (!isActiveRef.current) return;

          if (response.ok) {
            const result = await response.json();
            console.log('[SessionWaiting] Callback data received:', result.data);

            const data = result.data || {};

            // Consider ready if we have agentId OR interview setup data (prompts/plan)
            const isReady = data.agentId || data.interviewPlan || data.interviewPrompt;
            if (isReady) {
              // We have enough setup data — stop polling and navigate
              isActiveRef.current = false;
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setCallbackData(data);
              return;
            } else {
              // Partial data (no agentId or prompts yet) — keep polling
              console.log('[SessionWaiting] Callback data not ready yet, continuing to poll…');
            }
          } else if (response.status === 404) {
            console.log(`[SessionWaiting] No callback data yet (404), poll #${pollCountRef.current}`);
          } else {
            const errorBody = await response.text().catch(() => '');
            console.warn(`[SessionWaiting] Unexpected response: ${response.status} - ${errorBody}`);
          }
        } catch (error) {
          if (!isActiveRef.current) return;
          console.error('[SessionWaiting] Error polling callback data:', error);
        }
      };

      // Start polling - first call immediate, then every 3 seconds
      pollCallbackData();
      pollIntervalRef.current = setInterval(pollCallbackData, 3000);

      return () => {
        isActiveRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }

    // For database sessions, poll session status
    let isActive = true;

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/interview/session/${sessionId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!isActive) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setErrorMessage(errorData?.error || 'Failed to fetch session status');
          return;
        }

        const data = await response.json();
        if (data.ready) {
          localStorage.setItem('currentSessionId', sessionId);
          if (data.agentId) {
            localStorage.setItem('currentAgentId', data.agentId);
          }
          const mode = localStorage.getItem('pendingInterviewMode') || 'behavioral';
          const routeMap = {
            'behavioral': 'behavioural',
            'technical': 'technical',
            'behavioral_plus_dsa': 'behavioural'
          };
          const route = routeMap[mode] || 'behavioural';
          navigate(`/${route}/${sessionId}`);
        }
      } catch {
        if (!isActive) return;
        setErrorMessage('Network error while checking session status');
      }
    };

    poll();
    const pollInterval = setInterval(poll, 3000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans overflow-hidden relative">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-2xl z-10 flex flex-col items-center space-y-12">
        <div className="h-[300px] w-full flex items-center justify-center">
          <ParticleOrb state="thinking" />
        </div>

        <div className="text-center space-y-6 pt-12">
          <AnimatePresence mode="wait">
            <MotionH2
              key={currentMessageIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400"
            >
              {loadingMessages[currentMessageIndex]}
            </MotionH2>
          </AnimatePresence>

          <div className="flex justify-center space-x-2">
            <MotionDiv
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
            <MotionDiv
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
            <MotionDiv
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
          </div>
        </div>

        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 px-6 py-4 rounded-xl bg-slate-900/50 border border-emerald-500/20 backdrop-blur-sm"
        >
          <p className="text-sm text-slate-300 text-center">
            <span className="text-emerald-400 font-semibold">Setting up your interview...</span>
            <br />
            This typically takes 3–5 minutes. Thank you for your patience!
          </p>
        </MotionDiv>

        {errorMessage && (
          <p className="text-xs text-rose-400 text-center max-w-md">
            {errorMessage}
          </p>
        )}

        <p className="text-xs text-slate-500 text-center max-w-md">
          We are customizing your interview experience based on your profile and preferences.
          This ensures the most relevant and effective practice session.
        </p>
      </div>
    </div>
  );
}
