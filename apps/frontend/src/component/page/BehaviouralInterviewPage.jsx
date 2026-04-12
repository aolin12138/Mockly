'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LiveWaveform } from '../ui/live-waveform.jsx';
import { Phone, PhoneOff, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal.jsx';
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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

/* ---------- Interview page with ElevenLabs Agent ---------- */

export default function BehaviouralInterviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testState, setTestState] = useState('idle'); // Test state for orb
  const [useTestMode, setUseTestMode] = useState(false); // Toggle between test and real
  const [agentId, setAgentId] = useState('');
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [startTime, setStartTime] = useState(null); // Track when interview started
  const [hasConnected, setHasConnected] = useState(false); // Track if call ever connected
  const [sessionEndedIntentionally, setSessionEndedIntentionally] = useState(false); // Track if user ended session
  const [isConnecting, setIsConnecting] = useState(false); // Track connection in progress
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false); // Show warning on unexpected disconnect
  const [creditToolWarning, setCreditToolWarning] = useState('');
  const [persistedSessionId, setPersistedSessionId] = useState(localStorage.getItem('currentPersistedSessionId') || null);
  const workflowTriggeredRef = useRef(false); // Prevent duplicate workflow triggers
  const showDevControls = import.meta.env.DEV && import.meta.env.VITE_ENABLE_INTERVIEW_TEST_MODE === 'true';
  const selectedDurationMin = Math.max(15, Number(localStorage.getItem('interviewDurationMin')) || 15);

  const fetchCreditStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return {
        credits_remaining: null,
        eta_min_remaining: null,
        low_credit: false,
        critical_credit: false,
        recommended_check_turns: 5,
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/integrations/elevenlabs/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch credit status (${response.status})`);
    }

    const data = await response.json();
    const creditsRemaining = Math.max(0, Number(data.characterLimit || 0) - Number(data.characterCount || 0));
    const etaMinRemaining = Number(data.minutesRemaining || 0);

    return {
      credits_remaining: creditsRemaining,
      eta_min_remaining: Math.round(etaMinRemaining * 10) / 10,
      low_credit: creditsRemaining <= 20000,
      critical_credit: creditsRemaining <= 2000,
      recommended_check_turns: creditsRemaining <= 5000 ? 1 : creditsRemaining <= 20000 ? 2 : 5,
    };
  };

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId);
      if (!sessionId.startsWith('temp_')) {
        localStorage.setItem('currentPersistedSessionId', sessionId);
        setPersistedSessionId(sessionId);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // For temporary sessions, skip database lookup (data is in-memory)
    if (sessionId.startsWith('temp_')) {
      // Try to load agentId from callback data stored in sessionStorage
      const callbackDataStr = sessionStorage.getItem(`callbackData_${sessionId}`);
      if (callbackDataStr) {
        const callbackData = JSON.parse(callbackDataStr);
        if (callbackData.agentId) {
          setAgentId(callbackData.agentId);
          localStorage.setItem('currentAgentId', callbackData.agentId);
        }
        if (callbackData.persistedSessionId) {
          setPersistedSessionId(callbackData.persistedSessionId);
          localStorage.setItem('currentPersistedSessionId', callbackData.persistedSessionId);
        }
        if (callbackData.toolReady === false && callbackData.toolWarning) {
          setCreditToolWarning(callbackData.toolWarning);
        }
      }
      return;
    }

    const loadSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/interview/session/${sessionId}`, {
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
        if (data?.toolReady === false && data?.toolWarning) {
          setCreditToolWarning(data.toolWarning);
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
    clientTools: {
      getCreditStatus: async () => {
        try {
          const status = await fetchCreditStatus();
          console.log('[behavioural] getCreditStatus tool response:', status);
          return status;
        } catch (error) {
          console.error('[behavioural] getCreditStatus tool failed:', error);
          return {
            credits_remaining: null,
            eta_min_remaining: null,
            low_credit: false,
            critical_credit: false,
            recommended_check_turns: 5,
            error: 'credit_status_unavailable'
          };
        }
      }
    },
    onConnect: () => {
      console.log('Agent connected');
      setHasConnected(true);
      setIsConnecting(false);
    },
    onDisconnect: () => {
      console.log('Agent disconnected, intentional:', sessionEndedIntentionally);
      setIsConnecting(false);
      // If disconnected unexpectedly (not by user action), show warning
      if (hasConnected && !sessionEndedIntentionally && !workflowTriggeredRef.current) {
        console.warn('Unexpected disconnect detected');
        setShowDisconnectWarning(true);
      }
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
      setIsConnecting(false);
      if (error?.message?.includes('data channel') || error?.message?.includes('RTCError')) {
        console.warn('Connection unstable - attempting to recover');
        // Don't trigger session end on connection errors
      }
    },
  });

  const ensureStartablePlatformSessionId = async () => {
    const token = localStorage.getItem('token');
    const baseSessionId = persistedSessionId || localStorage.getItem('currentPersistedSessionId') || sessionId;

    if (!token || !baseSessionId || baseSessionId.startsWith('temp_')) {
      return baseSessionId;
    }

    const sessionResponse = await fetch(`${API_BASE_URL}/api/interview/session/${baseSessionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!sessionResponse.ok) {
      return baseSessionId;
    }

    const sessionData = await sessionResponse.json();
    if (!sessionData?.conversationId) {
      return baseSessionId;
    }

    const spawnResponse = await fetch(`${API_BASE_URL}/api/interview/session/${baseSessionId}/spawn-reconnect-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!spawnResponse.ok) {
      return baseSessionId;
    }

    const spawned = await spawnResponse.json();
    const newSessionId = spawned?.sessionId || baseSessionId;
    setPersistedSessionId(newSessionId);
    localStorage.setItem('currentPersistedSessionId', newSessionId);
    localStorage.setItem('currentSessionId', newSessionId);
    return newSessionId;
  };

  const linkConversationToSession = async (platformSessionId, elevenConversationId) => {
    const token = localStorage.getItem('token');
    if (!token || !platformSessionId || !elevenConversationId || platformSessionId.startsWith('temp_')) {
      return;
    }

    await fetch(`${API_BASE_URL}/api/interview/session/${platformSessionId}/link-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        conversationId: elevenConversationId
      })
    });
  };

  // Workflow: Save feedback and navigate to results
  const handleSessionEndWorkflow = async () => {
    setIsSubmitting(true);
    try {
      const endTime = Date.now();
      const durationSeconds = startTime ? Math.round((endTime - startTime) / 1000) : null;
      console.log(`Behavioural interview duration: ${durationSeconds} seconds`);

      const finalSessionId = persistedSessionId || localStorage.getItem('currentPersistedSessionId') || sessionId;

      navigate('/loading', {
        replace: true,
        state: {
          type: 'behavioral',
          sessionId: finalSessionId,
          duration: durationSeconds,
          company: selectedCompany,
          candidateCv,
        }
      });
    } catch (error) {
      console.error('Session end workflow failed:', error);
      workflowTriggeredRef.current = false;
      setSessionEndedIntentionally(false);
      toast.error(error?.message || 'Failed to process interview completion.', { title: 'Workflow Error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Button: End conversation only
  const handleCompleteInterview = async () => {
    setIsSubmitting(true);
    try {
      setSessionEndedIntentionally(true);
      if (conversation.status === 'connected') {
        await conversation.endSession();
      } else if (!workflowTriggeredRef.current) {
        workflowTriggeredRef.current = true;
        await handleSessionEndWorkflow();
      }
      // Workflow will trigger automatically on session end
    } catch (error) {
      console.error('Failed to complete interview:', error);
      setSessionEndedIntentionally(false);
      workflowTriggeredRef.current = false;
      toast.error('Failed to complete interview. Please try again.', { title: 'Completion Error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test button: End call without feedback workflow
  const handleEndCallOnly = async () => {
    setIsSubmitting(true);
    try {
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }
      // Navigate to dashboard without triggering feedback
      navigate('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };
  // Listen for session end and trigger workflow
  // Only trigger after the call has actually connected and then disconnected intentionally
  useEffect(() => {
    if (hasConnected && sessionEndedIntentionally && conversation.status === 'disconnected') {
      // Guard against duplicate triggers
      if (workflowTriggeredRef.current) {
        console.log('Workflow already triggered, skipping');
        return;
      }
      workflowTriggeredRef.current = true;
      handleSessionEndWorkflow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.status, hasConnected, sessionEndedIntentionally]);

  const handleBackClick = async () => {
    setShowExitWarning(true);
  };

  const handleConfirmExit = async () => {
    setShowExitWarning(false);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/api/interview/session/${sessionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to cancel session:', error);
    }
    navigate('/dashboard');
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

      // Start timing the interview
      setStartTime(Date.now());
      setIsConnecting(true);
      // Note: hasConnected is now set in the onConnect callback

      const creditStatus = await fetchCreditStatus().catch(() => ({
        credits_remaining: null,
        eta_min_remaining: null,
      }));

      const activeSessionId = await ensureStartablePlatformSessionId();

      // Start the ElevenLabs conversation
      const callSession = await conversation.startSession({
        agentId: agentId || localStorage.getItem('currentAgentId') || AGENT_ID,
        connectionType: 'webrtc', // Use WebRTC for better quality
        dynamicVariables: {
          session_id: activeSessionId || localStorage.getItem('currentSessionId') || null,
          mode: 'behavioral',
          selected_duration_min: selectedDurationMin,
          eta_min_initial: creditStatus.eta_min_remaining,
          credits_remaining_initial: creditStatus.credits_remaining,
          low_threshold: 20000,
          critical_threshold: 2000,
        }
      });

      const elevenConversationId = callSession?.getId?.() || null;
      if (elevenConversationId) {
        await linkConversationToSession(activeSessionId, elevenConversationId);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setIsConnecting(false);
      toast.error('Failed to start the interview. Please check your microphone permissions.', { title: 'Microphone Error' });
    }
  };

  const handleEndCall = async () => {
    try {
      setSessionEndedIntentionally(true); // Mark that user intentionally ended the session
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end conversation:', error);
      setSessionEndedIntentionally(false); // Reset on error
    }
  };

  // Handle reconnection after unexpected disconnect
  const handleReconnect = async () => {
    setShowDisconnectWarning(false);
    try {
      setIsConnecting(true);
      const creditStatus = await fetchCreditStatus().catch(() => ({
        credits_remaining: null,
        eta_min_remaining: null,
      }));
      const activeSessionId = await ensureStartablePlatformSessionId();
      const callSession = await conversation.startSession({
        agentId: agentId || localStorage.getItem('currentAgentId') || AGENT_ID,
        connectionType: 'webrtc',
        dynamicVariables: {
          session_id: activeSessionId || localStorage.getItem('currentSessionId') || null,
          mode: 'behavioral',
          selected_duration_min: selectedDurationMin,
          eta_min_initial: creditStatus.eta_min_remaining,
          credits_remaining_initial: creditStatus.credits_remaining,
          low_threshold: 20000,
          critical_threshold: 2000,
        }
      });
      const elevenConversationId = callSession?.getId?.() || null;
      if (elevenConversationId) {
        await linkConversationToSession(activeSessionId, elevenConversationId);
      }
      toast.success('Reconnected successfully!', { title: 'Connection Restored' });
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setIsConnecting(false);
      toast.error('Failed to reconnect. Please try again.', { title: 'Reconnection Failed' });
    }
  };

  // Handle ending session after unexpected disconnect
  const handleEndAfterDisconnect = () => {
    setShowDisconnectWarning(false);
    setSessionEndedIntentionally(true);
    // Trigger the workflow manually since we're already disconnected
    if (!workflowTriggeredRef.current) {
      workflowTriggeredRef.current = true;
      handleSessionEndWorkflow();
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
          {creditToolWarning && (
            <div className="mt-4 mx-auto max-w-2xl rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200">
              {creditToolWarning}
            </div>
          )}
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
                {conversation.status === 'disconnected' && !isConnecting && 'Ready to start your interview'}
                {(conversation.status === 'connecting' || isConnecting) && 'Connecting to your interviewer...'}
                {conversation.status === 'connected' &&
                  (conversation.isSpeaking ? 'Interviewer is speaking...' : 'Listening to you...')}
              </p>
            </div>

            {showDevControls && (
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
            )}

            <div className='flex flex-col gap-3 items-center w-full max-w-md'>
              {!isConnected ? (
                <button
                  type='button'
                  onClick={handleStartCall}
                  disabled={conversation.status === 'connecting' || isConnecting}
                  className='w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-slate-100 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg'
                >
                  <Phone className='h-5 w-5' />
                  <span>
                    {(conversation.status === 'connecting' || isConnecting) ? 'Connecting...' : 'Call Interviewer'}
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

                  {showDevControls && (
                    <button
                      type='button'
                      onClick={handleEndCallOnly}
                      disabled={isSubmitting}
                      className='w-full rounded-full bg-slate-600 text-slate-50 py-2.5 text-sm font-medium shadow-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-slate-500/60 focus:ring-offset-2 focus:ring-offset-slate-900'
                    >
                      {isSubmitting ? 'Ending call...' : 'End Call Only (Test)'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Warning Modal */}
      <Modal
        isOpen={showExitWarning}
        onClose={() => setShowExitWarning(false)}
        title="⚠️ Leave Interview?"
        type="warning"
        primaryButtonText="Leave & Cancel"
        secondaryButtonText="Keep Interviewing"
        onPrimaryClick={handleConfirmExit}
        onSecondaryClick={() => setShowExitWarning(false)}
        showCloseButton={true}
      >
        <div className="space-y-3 text-slate-300 text-sm">
          <p>If you leave now, your session will be <span className="text-amber-200 font-semibold">cancelled immediately</span> and you won't receive feedback.</p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-100">You can start a new interview session from the dashboard.</p>
          </div>
        </div>
      </Modal>

      {/* Unexpected Disconnect Warning Modal */}
      <Modal
        isOpen={showDisconnectWarning}
        onClose={() => setShowDisconnectWarning(false)}
        title="⚠️ Connection Lost"
        type="warning"
        primaryButtonText="Reconnect"
        secondaryButtonText="End Interview"
        onPrimaryClick={handleReconnect}
        onSecondaryClick={handleEndAfterDisconnect}
        showCloseButton={false}
      >
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Your connection to the interviewer was <span className="text-amber-200 font-semibold">unexpectedly lost</span>.</p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-slate-200">Would you like to reconnect and continue, or end the interview now?</p>
          </div>
          <p className="text-xs text-slate-400">If you end now, your progress will be saved and you'll receive feedback.</p>
        </div>
      </Modal>
    </div>
  );
}
