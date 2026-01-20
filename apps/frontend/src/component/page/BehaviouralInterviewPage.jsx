'use client';

import React, { useState } from 'react';
import { LiveWaveform } from '../ui/live-waveform.jsx';
import { Phone, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import { Orb } from '../ui/orb';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const backgroundStyle = {
    backgroundImage: `linear-gradient(
      180deg,
      rgba(255,255,255,0.98) 0%,
      rgba(248,250,252,0.97) 30%,
      rgba(241,245,249,0.95) 65%,
      rgba(226,232,240,0.92) 100%
    ), url(${gradientBackground})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center bottom',
    backgroundColor: '#f8fafc',
  };

  const handleStartCall = async () => {
    try {
      // Request microphone permission and start conversation
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the ElevenLabs conversation
      await conversation.startSession({
        agentId: AGENT_ID,
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
        {/* Header */}
        <div className='text-center mb-6'>
          <h1 className='text-[2rem] md:text-[2.4rem] font-bold tracking-tight'>
            <span className='text-slate-900 font-bold'>Rehearse. AI ,</span>
            <span className='text-slate-300 font-bold'> your interviewing agent</span>
          </h1>
          <p className='mt-3 text-sm md:text-[15px] text-slate-600 max-w-2xl mx-auto'>
            Start a live mock interview with our AI agent. Speak naturally and get real-time
            feedback through voice conversation.
          </p>
        </div>

        {/* Main Card with Official ElevenLabs Orb */}
        <div className='rounded-[28px] bg-gradient-to-br from-white/98 via-violet-50/90 to-indigo-50/90 border border-white/70 px-3 md:px-4 py-8 md:py-12 backdrop-blur'>
          <div className='flex flex-col items-center justify-center min-h-[500px] gap-8'>
            <div className='w-full flex flex-col items-center'>
              <div className='h-[400px] w-full flex items-center justify-center'>
                <Orb
                  colors={orbColors}
                  agentState={
                    conversation.status === 'connected'
                      ? conversation.isSpeaking
                        ? 'talking'
                        : 'listening'
                      : null
                  }
                  getInputVolume={() => conversation.getInputVolume?.() || 0}
                  getOutputVolume={() => conversation.getOutputVolume?.() || 0}
                />
              </div>
              {/* Live mic waveform visualization */}
              <div className='w-80'>
                <LiveWaveform active={isConnected} height={32} />
              </div>
            </div>

            <div className='text-center'>
              <p className='text-sm font-medium text-slate-600'>
                {conversation.status === 'disconnected' && 'Ready to start your interview'}
                {conversation.status === 'connecting' && 'Connecting to your interviewer...'}
                {conversation.status === 'connected' &&
                  (conversation.isSpeaking ? 'Interviewer is speaking...' : 'Listening to you...')}
              </p>
            </div>

            <div className='flex flex-col gap-3 items-center w-full max-w-md'>
              {!isConnected ? (
                <button
                  type='button'
                  onClick={handleStartCall}
                  disabled={conversation.status === 'connecting'}
                  className='w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all'
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
                    className='w-full rounded-full bg-slate-900 text-slate-50 py-2.5 text-sm font-medium shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-slate-900/60 focus:ring-offset-2 focus:ring-offset-slate-50'
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
