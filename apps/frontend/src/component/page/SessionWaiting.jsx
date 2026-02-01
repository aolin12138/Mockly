import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

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
          const route = mode === 'behavioral' ? 'behavioural' : 'technical';
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

      <div className="w-full max-w-2xl z-10 flex flex-col items-center space-y-8">
        <div className="h-[300px] w-full flex items-center justify-center">
          <ParticleOrb state="thinking" />
        </div>

        <div className="text-center space-y-4">
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentMessageIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400"
            >
              {loadingMessages[currentMessageIndex]}
            </motion.h2>
          </AnimatePresence>

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
            <span className="text-emerald-400 font-semibold">First time setup?</span> This might take a bit longer.
            <br />
            Please be patient, your interview will be ready soon.
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
