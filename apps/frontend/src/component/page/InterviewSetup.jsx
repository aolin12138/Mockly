import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal.jsx';
import { authFetch, ensureAuthenticated } from '../../lib/auth';
import {
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  User,
  CheckCircle,
  Code,
  Zap,
  Upload,
  AlertTriangle,
  Key
} from 'lucide-react';

const InputField = ({ label, value, onChange, placeholder, type = "text", textarea = false }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-400">{label}</label>
    {textarea ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all min-h-[100px] resize-none"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
      />
    )}
  </div>
);

const Toggle = ({ label, checked, onChange, helperText }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between bg-slate-800/40 border border-white/10 rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {helperText && <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full p-1 transition-all ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  </div>
);

const SelectButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl border transition-all duration-200 w-full ${active
      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
      : 'bg-slate-800/30 border-white/5 text-slate-400 hover:bg-slate-800/50 hover:border-white/10'
      }`}
  >
    {Icon && <Icon size={20} className={active ? 'text-emerald-400' : 'text-slate-500'} />}
    <span className="font-medium">{children}</span>
  </button>
);

const TagInput = ({ label, tags, onAdd, onRemove, placeholder }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-400">{label}</label>
      <div className="bg-slate-800/50 border border-white/10 rounded-xl p-2 flex flex-wrap gap-2 min-h-[50px]">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center bg-slate-700/50 text-slate-200 px-2.5 py-1 rounded-lg text-sm border border-white/10">
            {tag}
            <button
              onClick={() => onRemove(tag)}
              className="ml-2 hover:text-red-400 transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none flex-1 min-w-[120px] px-2"
        />
      </div>
    </div>
  );
};

const FileUpload = ({ file, onFileSelect }) => {
  const handleChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileSelect(selected);
  };

  return (
    <div className="w-full">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-800/30 hover:border-emerald-500/30 transition-all group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {file ? (
            <>
              <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-sm text-slate-300 font-medium">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-500 mb-2 group-hover:text-emerald-400 transition-colors" />
              <p className="text-sm text-slate-400">
                <span className="font-semibold text-emerald-400">Click to upload CV</span> or drag and drop
              </p>
              <p className="text-xs text-slate-600 mt-1">PDF only (MAX. 10MB)</p>
            </>
          )}
        </div>
        <input type="file" className="hidden" accept="application/pdf,.pdf" onChange={handleChange} />
      </label>
    </div>
  );
};

const InterviewSetup = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAgent, setLastAgent] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [byokStatus, setByokStatus] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [setupWarnings, setSetupWarnings] = useState([]);
  const [formData, setFormData] = useState({
    session: {
      mode: "practice",
      duration_min: 15,
      language: "en",
      difficulty: "medium",
      communication_style: "general",
      preferred_coding_language: "javascript"
    },
    candidate: {
      cv_available: false,
      cv_file: null,
      cv_structured: {
        name: "",
        current_role: "",
        experience_years: 0,
        companies: [{ name: "", role: "", years: 0 }],
        key_skills: [],
        notable_projects: [{ name: "", description: "", tech: [] }],
        education: ""
      },
      practice_context: {
        focus_areas: [],
        prior_interview_experience: "none"
      }
    },
    role: {
      title: "",
      context: "",
      seniority: "junior",
      stage: "behavioral",
      company_preset: "general_tech",
    },
    interview: {
      mode: "behavioral",
      probe_domains: [],
      depth_preference: "balanced"
    }
  });

  const updateField = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const updateNestedField = (section, parentField, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [field]: value
        }
      }
    }));
  };

  const updateArrayItem = (section, parentField, arrayField, index, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [arrayField]: prev[section][parentField][arrayField].map((item, i) => (
            i === index ? { ...item, [field]: value } : item
          ))
        }
      }
    }));
  };

  const addArrayItem = (section, parentField, arrayField, newItem) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [arrayField]: [...prev[section][parentField][arrayField], newItem]
        }
      }
    }));
  };

  const removeArrayItem = (section, parentField, arrayField, index) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [arrayField]: prev[section][parentField][arrayField].filter((_, i) => i !== index)
        }
      }
    }));
  };

  const buildSubmissionPayload = () => {
    const isTechnicalOnly = formData.interview.mode === 'technical';
    const normalizedDurationMin = isTechnicalOnly
      ? Math.max(30, Number(formData.session.duration_min) || 30)
      : Math.max(15, Number(formData.session.duration_min) || 15);

    let localUserId = null;
    try {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}');
      localUserId = localUser?.id || null;
    } catch {
      localUserId = null;
    }

    return {
      agent_id: lastAgent?.id || '',
      userId: localUserId,
      session: {
        mode: formData.session.mode || 'practice',
        duration_min: normalizedDurationMin,
        language: formData.session.language || 'en',
        difficulty: formData.session.difficulty || 'medium',
        communication_style: formData.session.communication_style || 'general',
        preferred_coding_language: formData.session.preferred_coding_language || 'javascript'
      },
      candidate: {
        ...formData.candidate,
        practice_context: {
          focus_areas: formData.candidate.practice_context?.focus_areas || [],
          prior_interview_experience: formData.candidate.practice_context?.prior_interview_experience || 'none'
        }
      },
      role: {
        title: (formData.role.title || (formData.interview.mode === 'technical' ? 'Technical Interview' : '')).trim(),
        context: (formData.role.context || '').trim(),
        seniority: formData.role.seniority,
        stage: formData.role.stage,
        company_preset: formData.role.company_preset || 'general_tech'
      },
      interview: {
        mode: formData.interview.mode,
        probe_domains: Array.isArray(formData.interview.probe_domains) ? formData.interview.probe_domains : [],
        depth_preference: formData.interview.depth_preference || 'balanced',
        communication_style: formData.session.communication_style || 'general'
      }
    };
  };

  const getRecommendedWarnings = (payload) => {
    const warnings = [];

    if (payload.interview?.mode === 'technical') {
      return warnings;
    }

    if (payload.interview?.mode === 'behavioral' && !payload.role?.context) {
      warnings.push('Add role context for significantly better question quality.');
    }

    if (!Array.isArray(payload.interview?.probe_domains) || payload.interview.probe_domains.length === 0) {
      warnings.push('Add probe domains for more targeted questions. If empty, role rubric defaults will be used.');
    }

    return warnings;
  };

  // Fetch last agent on component mount
  useEffect(() => {
    const fetchLastAgent = async () => {
      try {
        const token = ensureAuthenticated();
        if (!token) {
          setLoadingAgent(false);
          return;
        }

        const response = await authFetch('http://localhost:3000/api/interview/agent/last', {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.agent) {
            setLastAgent(data.agent);
          }
        }
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED' || error?.code === 'AUTH_EXPIRED') return;
        console.error('Failed to fetch last agent:', error);
      } finally {
        setLoadingAgent(false);
      }
    };

    fetchLastAgent();
  }, []);

  // Fetch BYOK status
  useEffect(() => {
    const fetchByokStatus = async () => {
      try {
        const token = ensureAuthenticated();
        if (!token) return;
        const response = await authFetch('http://localhost:3000/api/integrations/elevenlabs/status', {
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          setByokStatus(data);
        }
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED' || error?.code === 'AUTH_EXPIRED') return;
        console.error('Failed to fetch BYOK status:', error);
        setByokStatus({ connected: false });
      }
    };
    fetchByokStatus();
  }, []);

  useEffect(() => {
    if (formData.interview.mode === 'technical' && Number(formData.session.duration_min) < 30) {
      updateField('session', 'duration_min', 30);
    }
  }, [formData.interview.mode, formData.session.duration_min]);

  const getTotalSteps = () => (formData.interview.mode === 'technical' ? 2 : 3);

  const minDurationForMode = formData.interview.mode === 'technical' ? 30 : 15;
  const selectedDurationMin = Number(formData.session.duration_min) || minDurationForMode;
  const estimatedRemainingMin = Number(byokStatus?.minutesRemaining ?? 0);
  const mayEndEarly = byokStatus?.connected && Number.isFinite(estimatedRemainingMin) && estimatedRemainingMin > 0 && selectedDurationMin > estimatedRemainingMin;

  useEffect(() => {
    setStep((prev) => Math.min(prev, getTotalSteps()));
  }, [formData.interview.mode]);

  const nextStep = () => setStep(prev => Math.min(prev + 1, getTotalSteps()));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleQuickStart = async () => {
    if (!lastAgent) return;

    setIsSubmitting(true);
    try {
      const token = ensureAuthenticated();
      if (!token) return;

      const response = await authFetch('http://localhost:3000/api/interview/session/quick-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: (() => {
            try {
              const localUser = JSON.parse(localStorage.getItem('user') || '{}');
              return localUser?.id || null;
            } catch {
              return null;
            }
          })()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setSessionError(errorData.error || 'ElevenLabs API key required. Please connect your key in Dashboard Settings.');
        }
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      const sessionId = data.sessionId;

      if (!sessionId) {
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem('pendingInterviewMode', 'behavioral');
      localStorage.setItem('currentSessionId', sessionId);
      localStorage.setItem('currentAgentId', lastAgent.id);
      localStorage.removeItem('currentPersistedSessionId');
      localStorage.removeItem('currentConversationId');

      // Go directly to waiting page (which will skip polling for temp sessions)
      navigate(`/interview/session/${sessionId}/waiting`);
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED' || error?.code === 'AUTH_EXPIRED') return;
      console.error('Error with quick-start:', error);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const payload = buildSubmissionPayload();

    const warnings = getRecommendedWarnings(payload);
    setSetupWarnings(warnings);
    if (warnings.length > 0) {
      toast.warning(warnings[0], { title: 'Recommended input missing' });
    }

    // First time: show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmSession = async () => {
    setIsSubmitting(true);
    console.log("Submitting Configuration:", formData);

    try {
      const token = ensureAuthenticated();
      if (!token) {
        console.error("No authentication token found. Please log in.");
        toast.error('Please log in to start an interview');
        return;
      }

      console.log("Using Token:", token);

      const payload = buildSubmissionPayload();
      const isTechnicalOnly = payload.interview.mode === 'technical';

      const endpoint = isTechnicalOnly
        ? 'http://localhost:3000/api/interview/technical/session'
        : 'http://localhost:3000/api/interview/session';

      // Send configuration as JSON (CV file is already base64 encoded in formData)
      const response = await authFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
        // No timeout - wait indefinitely
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch prompts from backend:", response.status, errorData);
        setIsSubmitting(false);

        if (response.status === 403) {
          setShowConfirmModal(false);
          setSessionError(errorData.error || 'ElevenLabs API key required. Please connect your key in Dashboard Settings.');
          toast.warning('API key required — connect your ElevenLabs key in the Dashboard', { title: 'Access Denied' });
          return;
        }

        if (errorData.details && errorData.details.includes('524')) {
          setShowConfirmModal(false);
        } else {
          setShowConfirmModal(false);
        }
        return;
      } else {
        const data = await response.json();
        console.log("Received Prompts:", data);

        const sessionId = data.sessionId;
        const question = data.question;
        if (!sessionId || (isTechnicalOnly && !question?.id)) {
          setIsSubmitting(false);
          setShowConfirmModal(false);
          return;
        }

        localStorage.setItem('pendingInterviewMode', payload.interview.mode);
        localStorage.setItem(
          'interviewDurationMin',
          String(isTechnicalOnly ? Math.max(30, Number(payload.session.duration_min) || 30) : Math.max(15, Number(payload.session.duration_min) || 15))
        );

        if (isTechnicalOnly) {
          localStorage.setItem('technicalSessionConfig', JSON.stringify({
            interview_mode: 'technical',
            duration_min: payload.session.duration_min,
            difficulty: payload.session.difficulty,
            communication_style: payload.session.communication_style,
            preferred_coding_language: payload.session.preferred_coding_language
          }));
          localStorage.setItem('currentTechnicalSessionId', sessionId);
          navigate(`/technical/${sessionId}`, {
            state: {
              question
            }
          });
        } else {
          localStorage.removeItem('currentPersistedSessionId');
          localStorage.removeItem('currentConversationId');
          navigate(`/interview/session/${sessionId}/waiting`);
        }
      }
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED' || error?.code === 'AUTH_EXPIRED') return;
      console.error("Error submitting configuration:", error);
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const steps = formData.interview.mode === 'technical'
    ? [{ title: "Type" }, { title: "Technical Setup" }]
    : [{ title: "Type" }, { title: "Role & Focus" }, { title: "Candidate" }];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl z-10 relative"
      >
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className='absolute -top-12 left-4 flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-emerald-400 transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
          <span className='text-sm font-medium'>Back</span>
        </button>

        {/* Progress Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="font-bold text-slate-900">M</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Setup
            </span>
            {!loadingAgent && lastAgent && (
              <div className="flex flex-col items-start self-end mt-6">
                <button
                  onClick={handleQuickStart}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-[0_0_20px_-5px_rgba(34,211,238,0.4)] transition-all transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span>Quick Start</span>
                </button>
                <span className="text-xs text-cyan-400/70 mt-0.5 text-center w-full">With last setup</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-emerald-500 text-slate-900' :
                  step === i + 1 ? 'bg-white text-slate-900' :
                    'bg-slate-800 text-slate-500 border border-white/10'
                  }`}>
                  {step > i + 1 ? <CheckCircle size={14} /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 rounded-full ${step > i + 1 ? 'bg-emerald-500/50' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* STEP 1: INTERVIEW TYPE FIRST */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Choose Interview Type</h2>
                  <p className="text-slate-400">Start by selecting whether this session is behavioral or technical.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-400 mb-2 block">Interview Type</label>
                    <div className="space-y-3">
                      {[
                        { id: 'behavioral', label: 'Behavioral', icon: User },
                        { id: 'technical', label: 'Technical', icon: Code }
                      ].map((modeOption) => (
                        <SelectButton
                          key={modeOption.id}
                          active={formData.interview.mode === modeOption.id}
                          onClick={() => updateField('interview', 'mode', modeOption.id)}
                          icon={modeOption.icon}
                        >
                          {modeOption.label}
                        </SelectButton>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Session Type</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {['practice', 'real'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateField('session', 'mode', mode)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.session.mode === mode
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Duration</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {(formData.interview.mode === 'technical' ? [30, 45, 60] : [15, 30, 45]).map(mins => (
                          <button
                            key={mins}
                            onClick={() => updateField('session', 'duration_min', mins)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.session.duration_min === mins
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                      {mayEndEarly && (
                        <p className="mt-2 text-xs text-amber-300">
                          Estimated credits may only support about {Math.round(estimatedRemainingMin)} min right now, so this session could end early.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Conversation Language</label>
                      <select
                        value={formData.session.language}
                        onChange={(e) => updateField('session', 'language', e.target.value)}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-emerald-500/50 appearance-none"
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="zh">Chinese (Mandarin)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2A: ROLE FOR BEHAVIORAL */}
            {step === 2 && formData.interview.mode === 'behavioral' && (
              <motion.div
                key="step2-role"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Role Context</h2>
                  <p className="text-slate-400">Define the role and hiring environment for this simulation.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Company Preset</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['general_tech', 'faang', 'startup', 'finance', 'consulting'].map(type => (
                          <SelectButton
                            key={type}
                            active={formData.role.company_preset === type}
                            onClick={() => updateField('role', 'company_preset', type)}
                          >
                            <span className="capitalize">{type.replace('_', ' ')}</span>
                          </SelectButton>
                        ))}
                      </div>
                    </div>

                    <InputField
                      label="Role Title"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={formData.role.title}
                      onChange={(e) => updateField('role', 'title', e.target.value)}
                    />

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Seniority</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {['intern', 'junior', 'mid', 'senior', 'staff', 'lead'].map(level => (
                          <button
                            key={level}
                            onClick={() => updateField('role', 'seniority', level)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.role.seniority === level
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Interview Stage</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['hr_screen', 'behavioral', 'system_design', 'final_loop'].map(stage => (
                          <SelectButton
                            key={stage}
                            active={formData.role.stage === stage}
                            onClick={() => updateField('role', 'stage', stage)}
                          >
                            <span className="capitalize text-xs">{stage.replace('_', ' ')}</span>
                          </SelectButton>
                        ))}
                      </div>
                    </div>

                    <InputField
                      label="Role Context"
                      placeholder="Team goals, product area, role responsibilities, interview constraints..."
                      value={formData.role.context}
                      onChange={(e) => updateField('role', 'context', e.target.value)}
                      textarea
                    />
                    {!formData.role.context.trim() && (
                      <p className="text-xs text-amber-300">Recommended: add 1-2 sentences of role context for better question quality.</p>
                    )}

                    <TagInput
                      label="Probe Domains (Recommended)"
                      tags={formData.interview.probe_domains}
                      onAdd={(tag) => updateField('interview', 'probe_domains', [...formData.interview.probe_domains, tag])}
                      onRemove={(tag) => updateField('interview', 'probe_domains', formData.interview.probe_domains.filter(t => t !== tag))}
                      placeholder="e.g. leadership, ambiguity handling, cross-team communication"
                    />
                    {formData.interview.probe_domains.length === 0 && (
                      <p className="text-xs text-amber-300">Recommended: add probe domains; if left empty, rubric defaults are used.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2B: TECHNICAL PREFERENCES */}
            {step === 2 && formData.interview.mode === 'technical' && (
              <motion.div
                key="step2-technical"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Technical Preferences</h2>
                  <p className="text-slate-400">Set difficulty, interview style, and default coding language.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-400 mb-2 block">Difficulty</label>
                    <div className="space-y-2">
                      {['easy', 'medium', 'hard'].map(level => (
                        <SelectButton
                          key={level}
                          active={formData.session.difficulty === level}
                          onClick={() => updateField('session', 'difficulty', level)}
                        >
                          <span className="capitalize">{level}</span>
                        </SelectButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400 mb-2 block">Interview Style</label>
                    <div className="space-y-2">
                      {['faang', 'startup', 'general'].map(style => (
                        <SelectButton
                          key={style}
                          active={formData.session.communication_style === style}
                          onClick={() => updateField('session', 'communication_style', style)}
                        >
                          <span className="capitalize">{style}</span>
                        </SelectButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400 mb-2 block">Preferred Language</label>
                    <div className="space-y-2">
                      {['javascript', 'python', 'java'].map(lang => (
                        <SelectButton
                          key={lang}
                          active={formData.session.preferred_coding_language === lang}
                          onClick={() => updateField('session', 'preferred_coding_language', lang)}
                        >
                          <span className="capitalize">{lang}</span>
                        </SelectButton>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: CANDIDATE */}
            {step === 3 && formData.interview.mode === 'behavioral' && (
              <motion.div
                key="step3-candidate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Candidate Profile</h2>
                  <p className="text-slate-400">Uploading your CV is highly recommended for better personalization. If you skip CV upload, please fill in as many candidate details as possible for a more comprehensive interview experience.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Toggle
                      label="CV Available"
                      helperText="Highly recommended. CV context helps generate more tailored prompts and feedback."
                      checked={formData.candidate.cv_available}
                      onChange={(val) => updateField('candidate', 'cv_available', val)}
                    />

                    {formData.candidate.cv_available && (
                      <div>
                        <label className="text-sm font-medium text-slate-400 mb-2 block">CV Upload (Optional)</label>
                        <FileUpload
                          file={formData.candidate.cv_file}
                          onFileSelect={(file) => {
                            const isPdf =
                              (file.type || '').toLowerCase() === 'application/pdf' ||
                              (file.name || '').toLowerCase().endsWith('.pdf');

                            if (!isPdf) {
                              toast.error('Only PDF CV files are supported.');
                              return;
                            }

                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = reader.result;
                              const base64Data = dataUrl.split(';base64,').pop();

                              updateField('candidate', 'cv_file', {
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                content: base64Data
                              });
                              updateField('candidate', 'cv_available', true);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                    )}

                    <InputField
                      label="Candidate Name"
                      placeholder="e.g. Alex Lee"
                      value={formData.candidate.cv_structured.name}
                      onChange={(e) => updateNestedField('candidate', 'cv_structured', 'name', e.target.value)}
                    />

                    <InputField
                      label="Current Role"
                      placeholder="e.g. Software Engineer"
                      value={formData.candidate.cv_structured.current_role}
                      onChange={(e) => updateNestedField('candidate', 'cv_structured', 'current_role', e.target.value)}
                    />

                    <InputField
                      label="Years of Experience"
                      type="number"
                      placeholder="0"
                      value={formData.candidate.cv_structured.experience_years}
                      onChange={(e) => updateNestedField('candidate', 'cv_structured', 'experience_years', Number(e.target.value) || 0)}
                    />

                    <TagInput
                      label="Key Skills"
                      tags={formData.candidate.cv_structured.key_skills}
                      onAdd={(tag) => updateNestedField('candidate', 'cv_structured', 'key_skills', [...formData.candidate.cv_structured.key_skills, tag])}
                      onRemove={(tag) => updateNestedField('candidate', 'cv_structured', 'key_skills', formData.candidate.cv_structured.key_skills.filter(t => t !== tag))}
                      placeholder="e.g. React, SQL, AWS"
                    />

                    <InputField
                      label="Education"
                      placeholder="e.g. BSc Computer Science, University of Auckland"
                      value={formData.candidate.cv_structured.education}
                      onChange={(e) => updateNestedField('candidate', 'cv_structured', 'education', e.target.value)}
                    />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-400">Companies</label>
                        <button
                          type="button"
                          onClick={() => addArrayItem('candidate', 'cv_structured', 'companies', { name: '', role: '', years: 0 })}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          + Add company
                        </button>
                      </div>

                      {formData.candidate.cv_structured.companies.map((company, index) => (
                        <div key={`company-${index}`} className="bg-slate-800/40 border border-white/10 rounded-xl p-3 space-y-3">
                          <InputField
                            label="Company Name"
                            placeholder="e.g. Xero"
                            value={company.name}
                            onChange={(e) => updateArrayItem('candidate', 'cv_structured', 'companies', index, 'name', e.target.value)}
                          />
                          <InputField
                            label="Role"
                            placeholder="e.g. Full Stack Engineer"
                            value={company.role}
                            onChange={(e) => updateArrayItem('candidate', 'cv_structured', 'companies', index, 'role', e.target.value)}
                          />
                          <InputField
                            label="Years"
                            type="number"
                            placeholder="0"
                            value={company.years}
                            onChange={(e) => updateArrayItem('candidate', 'cv_structured', 'companies', index, 'years', Number(e.target.value) || 0)}
                          />
                          {formData.candidate.cv_structured.companies.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeArrayItem('candidate', 'cv_structured', 'companies', index)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove company
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-400">Notable Projects</label>
                        <button
                          type="button"
                          onClick={() => addArrayItem('candidate', 'cv_structured', 'notable_projects', { name: '', description: '', tech: [] })}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          + Add project
                        </button>
                      </div>

                      {formData.candidate.cv_structured.notable_projects.map((project, index) => (
                        <div key={`project-${index}`} className="bg-slate-800/40 border border-white/10 rounded-xl p-3 space-y-3">
                          <InputField
                            label="Project Name"
                            placeholder="e.g. Candidate Ranking Engine"
                            value={project.name}
                            onChange={(e) => updateArrayItem('candidate', 'cv_structured', 'notable_projects', index, 'name', e.target.value)}
                          />
                          <InputField
                            label="Description"
                            placeholder="What did you build and why?"
                            value={project.description}
                            onChange={(e) => updateArrayItem('candidate', 'cv_structured', 'notable_projects', index, 'description', e.target.value)}
                            textarea
                          />
                          <TagInput
                            label="Tech Stack"
                            tags={project.tech}
                            onAdd={(tag) => updateArrayItem('candidate', 'cv_structured', 'notable_projects', index, 'tech', [...project.tech, tag])}
                            onRemove={(tag) => updateArrayItem('candidate', 'cv_structured', 'notable_projects', index, 'tech', project.tech.filter(t => t !== tag))}
                            placeholder="e.g. Node.js, Postgres"
                          />
                          {formData.candidate.cv_structured.notable_projects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeArrayItem('candidate', 'cv_structured', 'notable_projects', index)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove project
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                  <TagInput
                    label="Practice Focus Areas"
                    tags={formData.candidate.practice_context.focus_areas}
                    onAdd={(tag) => updateNestedField('candidate', 'practice_context', 'focus_areas', [...formData.candidate.practice_context.focus_areas, tag])}
                    onRemove={(tag) => updateNestedField('candidate', 'practice_context', 'focus_areas', formData.candidate.practice_context.focus_areas.filter(t => t !== tag))}
                    placeholder="e.g. confidence, communication, problem framing"
                  />

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Prior Interview Experience</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {['none', 'some', 'experienced'].map(level => (
                          <button
                            key={level}
                            onClick={() => updateNestedField('candidate', 'practice_context', 'prior_interview_experience', level)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.candidate.practice_context.prior_interview_experience === level
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* BYOK Demo Warning */}
          {byokStatus && !byokStatus.connected && (
            <div className="mt-6 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-300">ElevenLabs Not Connected</p>
                <p className="text-xs text-slate-400 mt-1">
                  You have <span className="text-yellow-400 font-bold">1 free demo session</span> for behavioural interviews.
                  Starting a session will use your demo credit. Connect your own API key in
                  <button onClick={() => navigate('/dashboard')} className="text-emerald-400 hover:text-emerald-300 underline ml-1 cursor-pointer">Dashboard Settings</button> for unlimited sessions.
                </p>
              </div>
            </div>
          )}

          {/* Session Error (e.g. 403 no key / no demo credits) */}
          {sessionError && (
            <div className="mt-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
              <Key size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Cannot Start Session</p>
                <p className="text-xs text-slate-400 mt-1">{sessionError}</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                >
                  Go to Dashboard Settings to connect your API key →
                </button>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="mt-10 flex justify-between items-center pt-6 border-t border-white/5">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-colors ${step === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>

            {step < getTotalSteps() ? (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
              >
                <span>Next Step</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105"
              >
                <Zap size={18} className="fill-white" />
                <span>Start Mock Interview</span>
              </button>
            )}
          </div>

        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => !isSubmitting && setShowConfirmModal(false)}
        title="Confirm Interview Settings"
        type="info"
        primaryButtonText="Start Interview"
        secondaryButtonText="Review Again"
        onPrimaryClick={handleConfirmSession}
        onSecondaryClick={() => setShowConfirmModal(false)}
        isPrimaryLoading={isSubmitting}
        showCloseButton={!isSubmitting}
      >
        <div className="space-y-4 text-slate-300 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <p className="font-semibold text-white mb-2">📋 Please Verify Your Settings:</p>
            <ul className="space-y-1 ml-2">
              <li>✓ Session Mode: <span className="text-emerald-400 font-medium capitalize">{formData.session.mode}</span></li>
              <li>✓ Interview Mode: <span className="text-emerald-400 font-medium capitalize">{formData.interview.mode.replace('_', ' ')}</span></li>
              <li>✓ Duration: <span className="text-emerald-400 font-medium">{formData.session.duration_min} minutes</span></li>
              {formData.interview.mode === 'technical' ? (
                <>
                  <li>✓ Difficulty: <span className="text-emerald-400 font-medium capitalize">{formData.session.difficulty}</span></li>
                  <li>✓ Interview Style: <span className="text-emerald-400 font-medium capitalize">{formData.session.communication_style}</span></li>
                  <li>✓ Preferred Language: <span className="text-emerald-400 font-medium capitalize">{formData.session.preferred_coding_language}</span></li>
                </>
              ) : (
                <>
                  <li>✓ Role: <span className="text-emerald-400 font-medium">{formData.role.title || 'Not specified'}</span></li>
                  <li>✓ Stage: <span className="text-emerald-400 font-medium capitalize">{formData.role.stage.replace('_', ' ')}</span></li>
                  <li>✓ Probe Domains: <span className="text-emerald-400 font-medium">{formData.interview.probe_domains.length || 0}</span></li>
                </>
              )}
            </ul>
          </div>

          {setupWarnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="font-semibold text-amber-200 mb-1">Recommended Improvements</p>
              <ul className="space-y-1 text-amber-100">
                {setupWarnings.map((warning, index) => (
                  <li key={`setup-warning-${index}`}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="font-semibold text-amber-200 mb-1">⚠️ Important:</p>
            <p>Once you start the session, you will be charged with tokens/credits. Please ensure all your settings are correct before proceeding.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InterviewSetup;
