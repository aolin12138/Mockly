'use client';

import React, { useEffect, useState } from 'react';
import { LiveWaveform } from '../ui/live-waveform.jsx';
import { Phone, PhoneOff, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import ParticleOrb from '../ui/particle-orb.jsx';
import gradientBackground from '../../assets/gradient_background.png';

/* ---------- Simple helper: read candidateCv from localStorage ---------- */
function getStoredCv() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('candidateCv');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to parse candidateCv from localStorage:', err);
    return null;
  }
}

/* ---------- ElevenLabs Agent Config ---------- */
const AGENT_ID = import.meta.env.VITE_GOOGLE_AGENT_ID || 'agent_0901kbyh4704effth28z4q9f684p';

/* ---------- Company Color Themes (two-color, original orb style) ---------- */
const COMPANY_COLORS = {
  Google: ['#2792DC', '#9CE6E6'],
  Microsoft: ['#2792DC', '#9CE6E6'],
  Amazon: ['#2792DC', '#9CE6E6'],
  Apple: ['#2792DC', '#9CE6E6'],
  Meta: ['#2792DC', '#9CE6E6'],
  Netflix: ['#2792DC', '#9CE6E6'],
  Tesla: ['#2792DC', '#9CE6E6'],
  default: ['#2792DC', '#9CE6E6'],
};

/* ---------- N8N Webhook Config (still here if you need it later) ---------- */
const N8N_WEBHOOK_URL = 'https://aolin12138.app.n8n.cloud/webhook/feedback';

/* ---------- Interview page with ElevenLabs Agent ---------- */

export default function BehaviouralInterviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testState, setTestState] = useState('idle'); // Test state for orb
  const [useTestMode, setUseTestMode] = useState(false); // Toggle between test and real
  const [agentId, setAgentId] = useState('');

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const loadSession = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/interview/session/${sessionId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) return;
        const data = await response.json();
        if (data?.agentId) {
          setAgentId(data.agentId);
          localStorage.setItem('currentAgentId', data.agentId);
        }
      } catch (error) {
        console.error('Failed to load session agentId:', error);
      }
    };

    loadSession();
  }, [sessionId]);

  // Get selected company + CV from localStorage
  const selectedCompany =
    (typeof window !== 'undefined' && window.localStorage.getItem('selectedCompany')) || 'default';
  const candidateCv = getStoredCv();

  const orbColors = COMPANY_COLORS[selectedCompany] || COMPANY_COLORS.default;

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('Agent connected');
    },
    onDisconnect: () => {
      console.log('Agent disconnected');
    },
    onMessage: (message) => {
      console.log('Message received:', message);

      // Inspect error-type messages (if any)
      if (message?.type === 'error' || message?.event === 'error') {
        console.error('[behavioural] Agent error message:', message);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      if (error?.message?.includes('data channel') || error?.message?.includes('RTCError')) {
        console.warn('Connection unstable - attempting to recover');
      }
    },
  });

  const handleCompleteInterview = async () => {
    setIsSubmitting(true);

    try {
      // End the conversation
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }

      // Navigate to results page – now also pass company + CV via state
      navigate('/results', {
        state: {
          company: selectedCompany,
          candidateCv,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackClick = async () => {
    if (window.confirm('Are you sure you want to leave? This will cancel your interview session and you\'ll need to reconfigure.')) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`http://localhost:3000/api/interview/session/${sessionId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Failed to cancel session:', error);
      }
      navigate('/dashboard');
    }
  };

  const backgroundStyle = {
    backgroundImage: `linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.98) 0%,
      rgba(30, 41, 59, 0.97) 30%,
      rgba(51, 65, 85, 0.95) 65%,
      rgba(71, 85, 105, 0.92) 100%
    ), url(${gradientBackground})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center bottom',
    backgroundColor: '#0f172a',
  };

  const handleStartCall = async () => {
    try {
      // Request microphone permission and start conversation
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the ElevenLabs conversation
      await conversation.startSession({
        agentId: agentId || localStorage.getItem('currentAgentId') || AGENT_ID,
        connectionType: 'webrtc', // Use WebRTC for better quality
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start the interview. Please check your microphone permissions.');
    }
  };

  const handleEndCall = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  const isConnected = conversation.status === 'connected';

  return (
    <div
      className='h-screen flex items-center justify-center overflow-hidden px-4'
      style={{
        ...backgroundStyle,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className='w-full max-w-5xl relative'>
        {/* Back Button */}
        <button
          onClick={handleBackClick}
          className='absolute top-0 left-0 flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-emerald-400 transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
          <span className='text-sm font-medium'>Back</span>
        </button>

        {/* Header */}
        <div className='text-center mb-6'>
          <h1 className='text-[2rem] md:text-[2.4rem] font-bold tracking-tight'>
            <span className='text-slate-100 font-bold'>Behavioural Interview</span>
            <span className='text-emerald-400 font-bold'> Session</span>
          </h1>
          <p className='mt-3 text-sm md:text-[15px] text-slate-300 max-w-2xl mx-auto'>
            Start a live mock interview with our AI agent. Speak naturally and get real-time
            feedback through voice conversation.
          </p>
        </div>

        {/* Main Card */}
        <div className='rounded-[28px] bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 border border-emerald-500/20 px-3 md:px-4 py-8 md:py-12 backdrop-blur-sm'>
          <div className='flex flex-col items-center justify-center min-h-[500px] gap-8'>
            <div className='w-full flex flex-col items-center'>
              <div className='h-[400px] w-full flex items-center justify-center'>
                <ParticleOrb
                  state={
                    useTestMode
                      ? testState
                      : conversation.status === 'connected'
                        ? conversation.isSpeaking
                          ? 'speaking'
                          : 'listening'
                        : 'idle'
                  }
                  colors={orbColors}
                />
              </div>
              {/* Live mic waveform visualization */}
              <div className='w-80'>
                <LiveWaveform active={conversation.status === 'connected'} height={32} />
              </div>
            </div>

            <div className='text-center'>
              <p className='text-sm font-medium text-slate-300'>
                {conversation.status === 'disconnected' && 'Ready to start your interview'}
                {conversation.status === 'connecting' && 'Connecting to your interviewer...'}
                {conversation.status === 'connected' &&
                  (conversation.isSpeaking ? 'Interviewer is speaking...' : 'Listening to you...')}
              </p>
            </div>

            {/* Test Mode Controls */}
            <div className='w-full max-w-md bg-slate-800/50 rounded-lg p-4 border border-slate-700'>
              <div className='flex items-center justify-between mb-3'>
                <span className='text-sm font-medium text-slate-300'>Test Mode</span>
                <button
                  onClick={() => setUseTestMode(!useTestMode)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${useTestMode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {useTestMode ? 'ON' : 'OFF'}
                </button>
              </div>
              {useTestMode && (
                <div className='flex gap-2'>
                  <button
                    onClick={() => setTestState('idle')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${testState === 'idle'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    Idle
                  </button>
                  <button
                    onClick={() => setTestState('listening')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${testState === 'listening'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    Listening
                  </button>
                  <button
                    onClick={() => setTestState('speaking')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${testState === 'speaking'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    Speaking
                  </button>
                  <button
                    onClick={() => setTestState('thinking')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${testState === 'thinking'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    Thinking
                  </button>
                </div>
              )}
            </div>

            <div className='flex flex-col gap-3 items-center w-full max-w-md'>
              {!isConnected ? (
                <button
                  type='button'
                  onClick={handleStartCall}
                  disabled={conversation.status === 'connecting'}
                  className='w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-slate-100 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg'
                >
                  <Phone className='h-5 w-5' />
                  <span>
                    {conversation.status === 'connecting' ? 'Connecting...' : 'Call Interviewer'}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type='button'
                    onClick={handleEndCall}
                    className='w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all'
                  >
                    <PhoneOff className='h-5 w-5' />
                    <span>End Call</span>
                  </button>

                  <button
                    type='button'
                    onClick={handleCompleteInterview}
                    disabled={isSubmitting}
                    className='w-full rounded-full bg-emerald-600 text-slate-50 py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 focus:ring-offset-slate-900'
                  >
                    {isSubmitting ? 'Processing feedback...' : 'Complete interview'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
