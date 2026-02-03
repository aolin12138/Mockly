import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from 'react-monaco-editor';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal.jsx';
import { ArrowLeft, Play, RotateCcw, Check, X, ChevronDown, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import ParticleOrb from '../ui/particle-orb.jsx';

/**
 * TechnicalInterviewPage - Redesigned for Phase 3
 * Features:
 * - 2-column layout (problem + constraints | Monaco editor)
 * - Language selector (JavaScript/Python/Java)
 * - Visible test results table
 * - Dashboard-style UI (dark theme, glassmorphic cards)
 * - Framer Motion animations
 */

const Card = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-lg overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const TechnicalInterviewPage = () => {
  const navigate = useNavigate();
  const pendingUpdatesRef = useRef([]);
  const hasStartedSessionRef = useRef(false);
  const codeRef = useRef('');
  const languageRef = useRef('javascript');
  const questionRef = useRef(null);
  const testResultsRef = useRef(null);
  const AGENT_ID = import.meta.env.VITE_TECHNICAL_INTERVIEW_AGENT_ID || 'agent_6601kc3hn3b8fbv9p4hpskza0qgm';

  // Question and code state
  const [question, setQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [interviewStarted, setInterviewStarted] = useState(false);

  const conversation = useConversation({
    agentId: AGENT_ID,
    overrides: {
      agent: {
        firstMessage: "Hello! I'm your technical interviewer. I'm here to help you work through this coding problem. Feel free to ask questions or discuss your approach as you work through the solution.",
      },
    },
    clientTools: {
      getEditorState: () => {
        return JSON.stringify({
          code: codeRef.current,
          language: languageRef.current,
          question: questionRef.current,
          testResults: testResultsRef.current,
          timestamp: new Date().toISOString(),
        });
      },
    },
    onConnect: () => {
      while (pendingUpdatesRef.current.length > 0) {
        const update = pendingUpdatesRef.current.shift();
        if (update) {
          conversation.sendContextualUpdate(update);
        }
      }
    },
    onError: (error) => {
      console.error('Technical interview conversation error:', error);
    },
  });

  const sendAgentUpdate = (event, payload) => {
    const updateText = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    });

    if (conversation.status === 'connected') {
      conversation.sendContextualUpdate(updateText);
    } else {
      pendingUpdatesRef.current.push(updateText);
    }
  };

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    testResultsRef.current = testResults;
  }, [testResults]);

  // Auth guard and fetch question
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchQuestion(token);

    // Warn user when trying to leave the page
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      setShowExitWarning(true);
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigate]);

  const fetchQuestion = async (token) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3000/api/questions/random', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch question: ${response.statusText}`);
      }

      const data = await response.json();
      setQuestion(data);

      // Set initial code to boilerplate for selected language
      const initialCode = data.boilerplate && data.boilerplate[language]
        ? data.boilerplate[language]
        : '// Write your solution here\n';
      setCode(initialCode);

      sendAgentUpdate('onSessionStart', {
        question: data,
        language,
        code: initialCode,
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching question:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    if (question && question.boilerplate && question.boilerplate[newLanguage]) {
      setCode(question.boilerplate[newLanguage]);
    }
  };

  const handleReset = () => {
    if (question && question.boilerplate && question.boilerplate[language]) {
      setCode(question.boilerplate[language]);
      setTestResults(null);
      setShowResults(false);
    }
  };

  const handleRunCode = async () => {
    console.log('handleRunCode called', { question: question?.id, codeLength: code?.length, language });

    if (!question || !code) {
      const errorMsg = 'Please enter code to run';
      setError(errorMsg);
      console.error('Missing question or code:', { question: !!question, code: !!code });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setRunning(true);
      setError(null);
      setTestResults(null);

      console.log('Sending code execution request...');

      // Execute code first
      const response = await fetch('http://localhost:3000/api/code/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId: question.id,
          code,
          language,
        }),
      });

      console.log('Response received:', response.status, response.statusText);

      const result = await response.json();
      console.log('Result:', result);

      if (!response.ok) {
        throw new Error(result.message || result.error || `Code execution failed: ${response.statusText}`);
      }

      setTestResults(result);
      setShowResults(true);
      console.log('Test results set:', result);

      // Only send agent update after successful code execution
      if (conversation.status === 'connected') {
        sendAgentUpdate('onRunningCode', {
          phase: 'end',
          questionId: question.id,
          language,
          code,
          results: result,
        });
      }
    } catch (err) {
      const errorMsg = err.message;
      setError(errorMsg);
      console.error('Error running code:', err);

      // Only send error update if conversation is connected
      if (conversation.status === 'connected') {
        sendAgentUpdate('onRunningCode', {
          phase: 'error',
          questionId: question?.id,
          language,
          code,
          error: errorMsg,
        });
      }
    } finally {
      setRunning(false);
      console.log('handleRunCode finished');
    }
  };

  const handleBack = () => {
    if (window.confirm('Leave the technical interview?')) {
      navigate('/dashboard');
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="text-center">
          <div className="text-emerald-400 text-4xl mb-4">⟳</div>
          <p className="text-slate-300">Loading question...</p>
        </motion.div>
      </div>
    );
  }

  // Render error state
  if (error && !question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <Card className="max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h2 className="text-lg font-semibold text-slate-100">Error Loading Question</h2>
          </div>
          <p className="text-slate-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Return to Dashboard
          </button>
        </Card>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 p-4">
      <div className="h-screen flex flex-col">
        {/* Header - Title only */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-shrink-0 mb-2"
        >
          <div className="flex-1">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-emerald-400 transition-colors mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs">Back</span>
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent line-clamp-2">
              {question.title}
            </h1>
            <p className="text-slate-400 mt-0.5 text-xs">
              Difficulty: <span className="text-emerald-400 font-medium">{question.difficulty}</span>
            </p>
          </div>
        </motion.div>

        {/* Main Content Area - Horizontal layout */}
        <div className="flex-1 flex gap-3 overflow-hidden min-h-0 mt-1">
          {/* Left: Collapsible Problem Panel */}
          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '560px', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-lg p-3 overflow-hidden flex flex-col flex-shrink-0 self-start max-h-[75vh]"
              >
                <div className="space-y-3 overflow-y-auto pr-2 text-sm max-h-[60vh]">
                  <div>
                    <h2 className="text-sm font-semibold text-emerald-400 mb-1 uppercase tracking-wide">Problem</h2>
                    <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {question.problemStatement}
                    </p>
                  </div>

                  {question.constraints && question.constraints.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-1 uppercase tracking-wide">Constraints</h3>
                      <ul className="space-y-0.5">
                        {question.constraints.map((constraint, idx) => (
                          <li key={idx} className="text-slate-400 text-sm">
                            • {constraint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {question.skillTargets && question.skillTargets.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-1 uppercase tracking-wide">Skills</h3>
                      <div className="flex flex-wrap gap-1">
                        {question.skillTargets.map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-sm text-emerald-300">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.visibleTests && question.visibleTests.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-1 uppercase tracking-wide">Examples</h3>
                      <div className="space-y-1">
                        {question.visibleTests.map((test, idx) => (
                          <div key={idx} className="bg-slate-800/50 rounded p-1 text-sm font-mono text-slate-300">
                            <div>I: <span className="text-cyan-300">{JSON.stringify(test.input)}</span></div>
                            <div>O: <span className="text-emerald-300">{JSON.stringify(test.expectedOutput)}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPanelOpen(false)}
                  className="absolute top-2 right-2 p-1 hover:bg-slate-800 rounded transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle Button */}
          {!panelOpen && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setPanelOpen(true)}
              className="w-9 h-9 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-lg hover:bg-slate-900/60 transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </motion.button>
          )}

          {/* Editor + Orb Row */}
          <div className="flex-1 flex justify-between gap-6 overflow-hidden min-h-0">
            <div className="flex flex-col flex-1 min-w-0">
              {/* Language Selector */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-3 bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-lg px-4 py-2 mb-2 w-fit"
              >
                <label className="text-sm font-medium text-slate-300">Language:</label>
                <div className="flex gap-2">
                  {['javascript', 'python', 'java'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${language === lang
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                      {lang === 'javascript' ? 'JS' : lang === 'python' ? 'Python' : 'Java'}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-lg p-0 overflow-hidden flex-shrink-0 h-[520px]"
              >
                <MonacoEditor
                  value={code}
                  language={language}
                  onChange={setCode}
                  theme="vs-dark"
                  options={{
                    selectOnLineNumbers: true,
                    fontSize: 16,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex justify-between items-center flex-shrink-0 mt-2"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  disabled={running}
                  title="Reset"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </motion.button>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRunCode}
                    disabled={running}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    {running ? 'Running...' : 'Run'}
                  </motion.button>

                  {!interviewStarted && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        if (hasStartedSessionRef.current) {
                          return;
                        }
                        try {
                          setInterviewStarted(true);
                          hasStartedSessionRef.current = true;
                          await conversation.startSession({
                            agentId: AGENT_ID,
                          });
                        } catch (error) {
                          console.error('Failed to start technical interview conversation:', error);
                          setInterviewStarted(false);
                          hasStartedSessionRef.current = false;
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
                    >
                      Start Voice Agent
                    </motion.button>
                  )}
                </div>
              </motion.div>

              <AnimatePresence>
                {testResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-lg p-3 mt-2 flex-shrink-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">Test Results</h3>
                      {testResults.success !== undefined && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${testResults.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {testResults.visiblePassedTests}/{testResults.totalVisibleTests} Passed
                        </span>
                      )}
                    </div>

                    {/* Show error if present */}
                    {testResults.error && (
                      <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 mb-2">
                        <p className="font-medium text-sm">{testResults.error}</p>
                        {testResults.details && (
                          <p className="text-xs opacity-75 mt-1 whitespace-pre-wrap">{testResults.details}</p>
                        )}
                      </div>
                    )}

                    {/* Show visible test results */}
                    {testResults.visibleTestResults && testResults.visibleTestResults.length > 0 && (
                      <div className="space-y-2 text-sm">
                        {testResults.visibleTestResults.map((result, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-2 rounded-md flex items-start gap-2 ${result.passed
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/10 border border-red-500/20 text-red-300'
                              }`}
                          >
                            <span className="flex-shrink-0 mt-0.5 text-lg">
                              {result.passed ? '✓' : '✗'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-medium">
                                Test {idx + 1}: {result.passed ? 'Passed' : 'Failed'}
                              </p>
                              {!result.passed && (
                                <div className="text-xs opacity-75 mt-1">
                                  {result.expected !== undefined && (
                                    <p>Expected: <span className="text-emerald-400">{JSON.stringify(result.expected)}</span></p>
                                  )}
                                  {result.actual !== undefined && (
                                    <p>Got: <span className="text-red-400">{JSON.stringify(result.actual)}</span></p>
                                  )}
                                  {result.error && <p className="mt-1">{result.error}</p>}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Show hidden tests summary */}
                    {testResults.totalHiddenTests > 0 && (
                      <div className={`mt-3 p-3 rounded-lg border ${testResults.hiddenPassedTests === testResults.totalHiddenTests
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : testResults.hiddenPassedTests > 0
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {testResults.hiddenPassedTests === testResults.totalHiddenTests ? '🔒✓' : '🔒'}
                            </span>
                            <span className="text-sm font-semibold text-slate-200">Hidden Tests</span>
                          </div>
                          <span className={`text-sm font-bold px-2 py-1 rounded ${testResults.hiddenPassedTests === testResults.totalHiddenTests
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : testResults.hiddenPassedTests > 0
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                            }`}>
                            {testResults.hiddenPassedTests}/{testResults.totalHiddenTests} Passed
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {testResults.hiddenPassedTests === testResults.totalHiddenTests
                            ? 'All hidden tests passed! Your solution handles edge cases well.'
                            : testResults.hiddenPassedTests > 0
                              ? 'Some hidden tests failed. Consider edge cases and constraints.'
                              : 'Hidden tests check for edge cases not shown in examples.'}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 w-[380px] flex-shrink-0 h-[520px]">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ width: '360px', height: '360px' }}
              >
                <ParticleOrb
                  state={
                    conversation.status === 'connected'
                      ? conversation.isSpeaking ? 'speaking' : 'listening'
                      : conversation.status === 'connecting' ? 'thinking' : 'idle'
                  }
                  colors={['#2792DC', '#9CE6E6']}
                />
              </motion.div>
              <p className="text-sm font-semibold text-slate-400">
                {conversation.status === 'connected'
                  ? conversation.isSpeaking ? 'Speaking' : 'Listening'
                  : conversation.status === 'connecting' ? 'Connecting' : 'Ready'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Modal */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setError(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-red-500/20 rounded-lg p-4 max-w-md w-full"
              >
                <h2 className="text-red-400 font-semibold mb-2 text-sm">Error</h2>
                <p className="text-slate-300 text-xs mb-3 whitespace-pre-wrap">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TechnicalInterviewPage;

