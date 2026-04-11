import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleOrb from '../ui/particle-orb.jsx';

const fallbackLoadingMessages = [
  'Preparing your interview setup...',
  'Generating interview prompts...',
  'Configuring your agent...',
  'Finalizing your session...'
];

export default function SessionWaiting() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentMessage, setCurrentMessage] = useState(fallbackLoadingMessages[0]);
  const [recentMessages, setRecentMessages] = useState([fallbackLoadingMessages[0]]);
  const [errorMessage, setErrorMessage] = useState('');

  const pushStatusMessage = (message) => {
    if (!message) return;
    setCurrentMessage(message);
    setRecentMessages((prev) => {
      if (prev[prev.length - 1] === message) return prev;
      const next = [...prev, message];
      return next.slice(-4);
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => {
        const currentIdx = fallbackLoadingMessages.indexOf(prev);
        if (currentIdx === -1) return prev;
        const next = fallbackLoadingMessages[(currentIdx + 1) % fallbackLoadingMessages.length];
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // For temporary sessions (format: temp_*), use SSE to wait for n8n callback
    if (sessionId.startsWith('temp_')) {
      localStorage.setItem('currentSessionId', sessionId);

      let isActive = true;

      // Open SSE connection — backend will push data the instant n8n calls back
      const evtSource = new EventSource(
        `http://localhost:3000/api/interview/session/${sessionId}/stream`
      );

      evtSource.addEventListener('connected', () => {
        console.log('[SessionWaiting] SSE connected, waiting for n8n callback...');
        pushStatusMessage('Connected. Starting setup...');
      });

      evtSource.addEventListener('progress-update', (event) => {
        if (!isActive) return;
        try {
          const data = JSON.parse(event.data);
          if (data?.message) {
            pushStatusMessage(data.message);
          }
        } catch (err) {
          console.warn('[SessionWaiting] Failed to parse progress update:', err);
        }
      });

      evtSource.addEventListener('callback-data', (event) => {
        if (!isActive) return;

        try {
          const data = JSON.parse(event.data);
          console.log('[SessionWaiting] Callback data received via SSE:', data);

          // Store callback data in sessionStorage for the interview page
          sessionStorage.setItem(`callbackData_${sessionId}`, JSON.stringify(data));

          // Navigate to interview
          pushStatusMessage('Session ready. Launching interview...');
          const mode = localStorage.getItem('pendingInterviewMode') || 'behavioral';
          const routeMap = {
            'behavioral': 'behavioural',
            'technical': 'technical'
          };
          const route = routeMap[mode] || 'behavioural';
          navigate(`/${route}/${sessionId}`);
        } catch (err) {
          console.error('[SessionWaiting] Error parsing SSE data:', err);
        }
      });

      evtSource.onerror = (err) => {
        if (!isActive) return;
        console.warn('[SessionWaiting] SSE connection error, will auto-reconnect:', err);
        // EventSource auto-reconnects by default — no manual retry needed
      };

      return () => {
        isActive = false;
        evtSource.close();
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
            'technical': 'technical'
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
            <motion.h2
              key={currentMessage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400"
            >
              {currentMessage}
            </motion.h2>
          </AnimatePresence>

          <div className="space-y-1">
            {recentMessages.map((message, index) => (
              <p key={`${message}-${index}`} className="text-xs text-slate-500 text-center">
                {message}
              </p>
            ))}
          </div>

          <div className="flex justify-center space-x-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
          </div>
        </div>

        <motion.div
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
        </motion.div>

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
