import React, { useState, useEffect } from 'react';
import MonacoEditor from 'react-monaco-editor';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal.jsx';
import { ArrowLeft, Play, RotateCcw, Check, X, ChevronDown, AlertCircle } from 'lucide-react';

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
      if (data.boilerplate && data.boilerplate[language]) {
        setCode(data.boilerplate[language]);
      } else {
        setCode('// Write your solution here\n');
      }
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
    if (!question || !code) {
      setError('Please enter code to run');
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `Code execution failed: ${response.statusText}`);
      }
      setTestResults(result);
      setShowResults(true);
    } catch (err) {
      setError(err.message);
      console.error('Error running code:', err);
    } finally {
      setRunning(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-emerald-400 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              {question.title}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Difficulty: <span className="text-emerald-400 font-medium">{question.difficulty}</span>
            </p>
          </div>
        </motion.div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Problem Statement */}
          <Card delay={0.1}>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-emerald-400 mb-3">Problem Statement</h2>
                <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {question.problemStatement}
                </p>
              </div>

              {question.constraints && question.constraints.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-cyan-400 mb-2">Constraints</h3>
                  <ul className="space-y-1">
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
                  <h3 className="text-sm font-semibold text-cyan-400 mb-2">Skills Tested</h3>
                  <div className="flex flex-wrap gap-2">
                    {question.skillTargets.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs text-emerald-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {question.visibleTests && question.visibleTests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-cyan-400 mb-2">Example Test Cases</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {question.visibleTests.map((test, idx) => (
                      <div key={idx} className="bg-slate-800/50 rounded p-2 text-xs font-mono text-slate-300">
                        <div>Input: <span className="text-cyan-300">{JSON.stringify(test.input)}</span></div>
                        <div>Output: <span className="text-emerald-300">{JSON.stringify(test.expectedOutput)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Right: Editor + Controls */}
          <div className="space-y-4">
            {/* Language Selector */}
            <Card delay={0.2}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Language</label>
                <div className="flex gap-2">
                  {['javascript', 'python', 'java'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${language === lang
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                      {lang === 'javascript' ? 'JavaScript' : lang === 'python' ? 'Python' : 'Java'}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Monaco Editor */}
            <Card delay={0.3} className="p-0 overflow-hidden">
              <div style={{ height: '400px' }}>
                <MonacoEditor
                  value={code}
                  language={language}
                  onChange={setCode}
                  theme="vs-dark"
                  options={{
                    selectOnLineNumbers: true,
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </Card>

            {/* Run & Reset Buttons */}
            <Card delay={0.4} className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRunCode}
                disabled={running}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                {running ? 'Running...' : 'Run Code'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                disabled={running}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>
            </Card>
          </div>
        </div>

        {/* Test Results */}
        <AnimatePresence>
          {showResults && testResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card delay={0.5}>
                <div className="space-y-4">
                  {/* Error or Results Summary */}
                  {testResults.error ? (
                    <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <X className="w-5 h-5 text-red-400" />
                        <h3 className="font-semibold text-red-400">{testResults.error}</h3>
                      </div>
                      {testResults.details && (
                        <p className="text-sm text-red-200 font-mono whitespace-pre-wrap">{testResults.details}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg text-emerald-400">
                          Test Results
                        </h3>
                        <span className="text-sm font-mono text-slate-400">
                          {testResults.visiblePassedTests}/{testResults.totalVisibleTests} visible passed
                        </span>
                      </div>

                      {/* Progress bar for visible tests */}
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(testResults.visiblePassedTests / testResults.totalVisibleTests) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        />
                      </div>

                      {/* Visible test result table */}
                      {testResults.visibleTestResults && testResults.visibleTestResults.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left py-2 px-2 text-slate-400">#</th>
                                <th className="text-left py-2 px-2 text-slate-400">Input</th>
                                <th className="text-left py-2 px-2 text-slate-400">Expected</th>
                                <th className="text-left py-2 px-2 text-slate-400">Actual</th>
                                <th className="text-left py-2 px-2 text-slate-400">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {testResults.visibleTestResults.map((test) => (
                                <tr key={test.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                  <td className="py-2 px-2 text-slate-400">{test.id}</td>
                                  <td className="py-2 px-2 font-mono text-cyan-300 text-xs truncate max-w-[120px]">
                                    {JSON.stringify(test.input)}
                                  </td>
                                  <td className="py-2 px-2 font-mono text-emerald-300 text-xs">
                                    {JSON.stringify(test.expected)}
                                  </td>
                                  <td className="py-2 px-2 font-mono text-slate-300 text-xs">
                                    {test.error ? (
                                      <span className="text-red-400">{test.error}</span>
                                    ) : (
                                      JSON.stringify(test.actual)
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {test.passed ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-400">
                                        <Check className="w-4 h-4" /> Pass
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-red-400">
                                        <X className="w-4 h-4" /> Fail
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Hidden tests summary */}
                      {testResults.totalHiddenTests > 0 && (
                        <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-slate-300">Hidden Tests</h4>
                            <span className="text-sm font-mono text-slate-400">
                              {testResults.hiddenPassedTests}/{testResults.totalHiddenTests} passed
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(testResults.hiddenPassedTests / testResults.totalHiddenTests) * 100}%` }}
                              transition={{ duration: 0.5, delay: 0.3 }}
                              className={`h-full ${testResults.hiddenPassedTests === testResults.totalHiddenTests ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Details not shown to prevent cheating</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-4 right-4 max-w-md"
            >
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exit Warning Modal */}
        <Modal
          isOpen={showExitWarning}
          onClose={() => setShowExitWarning(false)}
          title="⚠️ Are You Sure?"
          type="warning"
          primaryButtonText="Exit Session"
          secondaryButtonText="Keep Working"
          onPrimaryClick={() => {
            navigate('/dashboard');
          }}
          onSecondaryClick={() => setShowExitWarning(false)}
          showCloseButton={true}
        >
          <div className="space-y-3 text-slate-300 text-sm">
            <p>If you leave now, your progress will be lost and you <span className="text-amber-200 font-semibold">cannot return</span> to this session.</p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-100">You will need to start a completely new session to continue practicing.</p>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default TechnicalInterviewPage;

