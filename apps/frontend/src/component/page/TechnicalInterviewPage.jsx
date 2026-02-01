'use client';

import React, { useState, useEffect } from 'react';
import MonacoEditor from 'react-monaco-editor';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import { Orb } from '../ui/orb';
import { ArrowLeft } from 'lucide-react';
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

/* ---------- Fallback dummy problem ---------- */

const DUMMY_PROBLEM = {
  id: 'two-sum',
  title: 'Two Sum',
  description:
    'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
  starterCode: `function twoSum(nums, target) {
  // Write your solution here
  // Return an array [i, j] with the indices of the two numbers
}\n`,
};

/* ---------- Problem templates built from title ---------- */

const PROBLEM_TEMPLATES = {
  'Two Sum': {
    id: 'two-sum',
    title: 'Two Sum',
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
    starterCode: `function twoSum(nums, target) {
  // nums: number[]
  // target: number
  // Return [i, j] where nums[i] + nums[j] === target
}\n`,
  },
  'Container With Most Water': {
    id: 'container-with-most-water',
    title: 'Container With Most Water',
    description:
      'Given n non-negative integers a1, a2, ..., an, where each represents a point at coordinate (i, ai). n vertical lines are drawn such that the two endpoints of the line i are at (i, ai) and (i, 0). Find two lines that, together with the x-axis, form a container that holds the most water.',
    starterCode: `function maxArea(height) {
  // height: number[]
  // Return the maximum amount of water a container can store
}\n`,
  },
  'Roman to Integer': {
    id: 'roman-to-integer',
    title: 'Roman to Integer',
    description:
      'Given a Roman numeral, convert it to an integer. The input is guaranteed to be within the range 1 to 3999.',
    starterCode: `function romanToInt(s) {
  // s: string representing a Roman numeral
  // Return the corresponding integer
}\n`,
  },
  'Regular Expression Matching': {
    id: 'regular-expression-matching',
    title: 'Regular Expression Matching',
    description:
      "Implement regular expression matching with support for '.' and '*'.\n\n'.' Matches any single character.\n'*' Matches zero or more of the preceding element.\n\nThe matching should cover the entire input string (not partial).",
    starterCode: `function isMatch(s, p) {
  // s: input string
  // p: pattern with '.' and '*'
  // Return true if pattern matches the entire string
}\n`,
  },
  'Letter Combinations of a Phone Number': {
    id: 'letter-combinations-of-a-phone-number',
    title: 'Letter Combinations of a Phone Number',
    description:
      'Given a string containing digits from 2–9 inclusive, return all possible letter combinations that the number could represent. Return the answer in any order.',
    starterCode: `function letterCombinations(digits) {
  // digits: string of digits 2-9
  // Return all possible letter combinations
}\n`,
  },
};

/**
 * Build a full problem object from just a title.
 * If we don’t have a template, fall back to a generic wrapper.
 */
function buildProblemFromTitle(title) {
  if (!title) return DUMMY_PROBLEM;

  const template = PROBLEM_TEMPLATES[title];
  if (template) return template;

  return {
    id: 'custom-problem',
    title,
    description:
      `Solve the problem: ${title}.\n\n` +
      'Write a clear, efficient solution and be prepared to explain its time and space complexity.',
    starterCode: `// ${title}
function solve(input) {
  // TODO: implement your solution here
}\n`,
  };
}

/* -------------------------------------------------------------------------- */
/*                      Shared config for voice interview                      */
/* -------------------------------------------------------------------------- */

// Per-company agent IDs
const AGENT_IDS = {
  google: 'agent_5301kc3cd46tfvb9yvb15b3r1kxt', // Google-style tech interviewer
  meta: 'agent_3201kc3dbg7kfsgat6n0wsgfck8c', // Meta-style tech interviewer
  other: 'agent_9401kc3dcz0heexs1tkpj1181f7y', // General software interviewer
};

// Helper to choose correct agent, defaulting to "other"
function getAgentIdForCompany(company) {
  if (company === 'google') return AGENT_IDS.google;
  if (company === 'meta') return AGENT_IDS.meta;
  return AGENT_IDS.other;
}

// Where we send code + problem snapshot so n8n / ElevenLabs tools can see it
// (point this at your n8n webhook or Node proxy).
const CODE_SNAPSHOT_ENDPOINT = 'http://localhost:4000/api/technical-code-snapshot';

/* -------------------------------------------------------------------------- */
/*                 Bottom-right widget (status only, no controls)             */
/* -------------------------------------------------------------------------- */

function TechnicalVoiceWidget({ conversation }) {
  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';

  return (
    <div
      className='
        fixed bottom-4 right-4
        z-40
        flex flex-col items-end gap-2
        pointer-events-none
      '
    >
      <div
        className='
          pointer-events-auto
          rounded-2xl border border-slate-200/70 bg-white/95 shadow-lg
          px-3 py-2.5
          flex items-center gap-3
          max-w-xs
        '
      >
        <div className='w-[72px] h-[72px]'>
          <Orb
            colors={['#2792DC', '#9CE6E6']}
            agentState={isConnected ? (conversation.isSpeaking ? 'talking' : 'listening') : null}
            getInputVolume={() => conversation.getInputVolume?.() || 0}
            getOutputVolume={() => conversation.getOutputVolume?.() || 0}
          />
        </div>

        <div className='flex-1 min-w-0'>
          <p className='text-xs font-semibold text-slate-800 truncate'>Technical interview coach</p>
          <p className='text-[11px] text-slate-500'>
            {conversation.status === 'disconnected' &&
              'Interview coach is idle. Start the interview to connect.'}
            {isConnecting && 'Connecting to your interviewer…'}
            {isConnected &&
              (conversation.isSpeaking
                ? 'Interviewer is speaking…'
                : 'Listening while you code. Just talk if you need help.')}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Main technical page UI                           */
/* -------------------------------------------------------------------------- */

const TechnicalInterviewPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
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

  // 🔹 Which company are we targeting? (google | meta | other)
  const selectedCompany =
    (typeof window !== 'undefined' && window.localStorage.getItem('selectedCompany')) || 'other';

  const candidateCv = getStoredCv();

  const [problem, setProblem] = useState(DUMMY_PROBLEM);
  const [code, setCode] = useState(DUMMY_PROBLEM.starterCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConsent, setShowConsent] = useState(true);

  /* ---------- ElevenLabs conversation hook (shared with widget) ---------- */

  const conversation = useConversation({
    onConnect: () => {
      console.log('[tech-voice] Agent connected, id:', conversation.getId?.());
    },
    onDisconnect: () => {
      console.log('[tech-voice] Agent disconnected');
    },
    onMessage: (message) => {
      console.log('[tech-voice] Message:', message);
    },
    onError: (error) => {
      console.error('[tech-voice] Conversation error:', error);
    },
    onDebug: (debug) => {
      console.log('[tech-voice debug]', debug);
    },
  });

  const isConnecting = conversation.status === 'connecting';

  // Send current code + problem + CV to your backend/n8n so the agent can “see” it
  const syncCodeSnapshot = async () => {
    try {
      const conversationId = conversation.getId?.();

      const payload = {
        code,
        problemTitle: problem.title,
        company: selectedCompany,
        candidateCv, // 🔹 include CV context
      };

      // Only send conversation_id if we actually have one
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      await fetch(CODE_SNAPSHOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[tech-voice] Failed to sync code snapshot (ok while wiring):', err);
    }
  };

  // 🔁 Debounced snapshot sync while the call is active
  useEffect(() => {
    // Only sync while the interviewer is connected or connecting
    if (conversation.status !== 'connected' && conversation.status !== 'connecting') return;

    const timeoutId = setTimeout(() => {
      syncCodeSnapshot();
    }, 5000); // 5 second debounce

    return () => clearTimeout(timeoutId);
  }, [code, conversation.status]); // re-run when code changes during an active session

  const startVoiceCoach = async () => {
    // ✅ If already connecting or connected, do nothing
    if (conversation.status === 'connected' || conversation.status === 'connecting') {
      return;
    }

    try {
      // Ask for mic first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionAgentId = agentId || localStorage.getItem('currentAgentId') || getAgentIdForCompany(selectedCompany);
      console.log('[tech-voice] Starting session for company:', selectedCompany, 'agent:', sessionAgentId);

      // Start the ElevenLabs session
      await conversation.startSession({
        agentId: sessionAgentId,
        connectionType: 'webrtc',
      });

      // Once session is live, send an initial snapshot that can include conversation_id
      await syncCodeSnapshot();
    } catch (error) {
      console.error('[tech-voice] Failed to start conversation:', error);
      alert('Failed to start the interview coach. Please check microphone permissions.');
    }
  };

  const endVoiceCoach = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('[tech-voice] Failed to end conversation:', error);
    }
  };

  /* ---------- Fetch random problem on mount via Node proxy ---------- */

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/technical-interview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            start: true,
            company: selectedCompany, // 🔹 pass company to backend/n8n
            candidateCv, // 🔹 optional: let backend personalise problem if desired
          }),
        });

        const data = await response.json();
        const raw = Array.isArray(data) && data[0] ? data[0] : data;

        const built = buildProblemFromTitle(raw?.title);
        setProblem(built);
        setCode(built.starterCode);
      } catch (err) {
        console.error('Error fetching the problem (using dummy problem instead):', err);
        setProblem(DUMMY_PROBLEM);
        setCode(DUMMY_PROBLEM.starterCode);
      }
    };

    fetchProblem();
  }, [selectedCompany, candidateCv]);

  /* ---------- Submit + complete: eval, end call, go to results ---------- */

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

  const handleSubmitAndComplete = async () => {
    setIsSubmitting(true);

    try {
      // 🔹 Capture the conversation id *before* ending the session
      const conversationId = conversation.getId?.() || null;
      console.log('[technical-submit] conversationId at submit:', conversationId);

      if (conversation.status === 'connected') {
        await endVoiceCoach();
      }

      const response = await fetch('http://localhost:4000/api/technical-interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_code: code,
          randomized_problem: {
            title: problem.title,
            description: problem.description,
          },
          company: selectedCompany,
          candidateCv, // 🔹 main CV-aware evaluation hook for n8n / LLM
          conversation_id: conversationId,
        }),
      });

      const data = await response.json();
      console.log('[technical-feedback] response:', data);

      // ✅ Support both: plain object OR [ { ... } ]
      const first = Array.isArray(data) && data[0] ? data[0] : data;

      navigate('/results-technical', {
        state: {
          raw: data,
          feedback: first.feedback || null,
          transcript: first.transcript || null,
          audio: first.audio || null,
          problem,
          code,
          company: selectedCompany,
          candidateCv,
        },
      });
    } catch (error) {
      console.error('Error submitting the code:', error);
      alert('Failed to submit and complete the interview. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- Consent modal: start interview + auto-connect voice ---------- */

  const handleStartInterview = async () => {
    setShowConsent(false);

    // Kick off the voice call as soon as they accept.
    // Spoken intro lives in the ElevenLabs agent config.
    await startVoiceCoach();
  };

  /* --------------------------------- Render -------------------------------- */

  return (
    <div
      className='interview-container'
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background: `linear-gradient(
          180deg,
          rgba(255,255,255,0.98) 0%,
          rgba(248,250,252,0.97) 30%,
          rgba(241,245,249,0.95) 65%,
          rgba(226,232,240,0.92) 100%
        ), url(${gradientBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundColor: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          position: 'relative',
        }}
      >
        {/* Back Button */}
        <button
          onClick={handleBackClick}
          className='absolute top-4 left-4 flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
          <span className='text-sm font-medium'>Back</span>
        </button>

        {/* Header */}
        <div className='text-center mb-6'>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              color: '#1F2937',
            }}
          >
            <span className='text-slate-900 font-bold'>Rehearse.AI, </span>
            <span className='text-slate-300 font-bold'>your technical interviewer</span>
          </h1>

          <p className='mt-3 text-sm text-slate-600 max-w-2xl mx-auto'>
            Your interviewer will connect on voice, watch as you code, and jump in when you ask for
            help. Think out loud if you like, and if you want a hint or a sanity check on your
            approach, just speak up — otherwise code as you normally would in a real interview.
          </p>
        </div>

        {/* Problem + editor */}
        {problem && (
          <div
            style={{
              maxWidth: '960px',
              margin: '0 auto',
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.75rem',
              marginTop: '2rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 600,
                marginTop: '0.75rem',
                color: '#111827',
              }}
            >
              {problem.title}
            </h2>
            <p
              style={{
                fontSize: '1rem',
                color: '#4b5563',
                whiteSpace: 'pre-wrap',
                marginBottom: '1rem',
              }}
            >
              {problem.description}
            </p>

            {/* Monaco editor */}
            <div style={{ height: '400px', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <MonacoEditor
                value={code}
                language='javascript'
                onChange={setCode}
                theme='vs-dark'
                options={{
                  selectOnLineNumbers: true,
                  fontSize: 14,
                  minimap: { enabled: false },
                }}
              />
            </div>

            {/* Single submit + complete button */}
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={handleSubmitAndComplete}
                disabled={isSubmitting}
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 1.4rem',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: isSubmitting ? '#9ca3af' : '#111827',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: isSubmitting ? 'default' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Submit & complete interview'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consent Modal */}
      {showConsent && (
        <div className='fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40'>
          <div className='bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden'>
            <div className='px-6 py-4 border-b border-slate-200 flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-slate-900'>
                Start your technical interview
              </h2>
              <button
                type='button'
                className='text-slate-400 hover:text-slate-600 text-xl leading-none'
                onClick={() => navigate('/')}
                aria-label='Close'
              >
                ×
              </button>
            </div>

            <div className='px-6 py-4 text-sm text-slate-600 max-h-[50vh] overflow-y-auto'>
              <p className='mb-3'>
                We&apos;ll connect you to a live AI technical interviewer over voice. They&apos;ll
                watch as you code in real time.
              </p>
              <p className='mb-3'>
                Talk through your thinking the way you would in a real on-site. If you get stuck on
                syntax, want a hint, or need to sanity-check an approach, just say so and your
                interviewer will respond.
              </p>
              <p>
                If you prefer silence, that&apos;s fine too – start coding and only ask for help
                when you want it.
              </p>
            </div>

            <div className='px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50'>
              <button
                type='button'
                className='px-4 py-2 rounded-full text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100'
                onClick={() => navigate('/')}
              >
                Cancel
              </button>
              <button
                type='button'
                className='inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 shadow-sm'
                onClick={handleStartInterview}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting…' : 'Start interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right voice orb widget – status only */}
      <TechnicalVoiceWidget conversation={conversation} />
    </div>
  );
};

export default TechnicalInterviewPage;
