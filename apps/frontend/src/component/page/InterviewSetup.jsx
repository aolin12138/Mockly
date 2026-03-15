import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal.jsx';
import {
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Briefcase,
  User,
  Clock,
  Languages,
  Target,
  FileText,
  CheckCircle,
  Code,
  Zap,
  Upload,
  Brain,
  ShieldAlert,
  GraduationCap,
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
              <p className="text-xs text-slate-600 mt-1">PDF, DOCX (MAX. 10MB)</p>
            </>
          )}
        </div>
        <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleChange} />
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
  const [formData, setFormData] = useState({
    session: {
      interview_mode: "behavioral",
      duration_min: 30,
      language: "en",
      difficulty: "medium",
      preferred_coding_language: "javascript",
      technical_focus_areas: []
    },
    target: {
      company_preset: "general_tech",
      role_title: "",
      seniority: "grad",
      focus_areas: [],
      preferred_languages: [],
      job_description_text: "",
      job_url: ""
    },
    candidate: {
      cv_file: null,
      self_strengths: [],
      self_weaknesses: [],
      goals: [],
      anxieties: "",
      prior_interview_experience: "some"
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

  // Fetch last agent on component mount
  useEffect(() => {
    const fetchLastAgent = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoadingAgent(false);
          return;
        }

        const response = await fetch('http://localhost:3000/api/interview/agent/last', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.agent) {
            setLastAgent(data.agent);
          }
        }
      } catch (error) {
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
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch('http://localhost:3000/api/integrations/elevenlabs/status', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          setByokStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch BYOK status:', error);
        setByokStatus({ connected: false });
      }
    };
    fetchByokStatus();
  }, []);

  const getTotalSteps = () => {
    if (formData.session.interview_mode === 'technical') {
      return 2; // Step 1 (config) + Step 2 (focus areas)
    }
    return 3; // Step 1 (config) + Step 2 (target) + Step 3 (profile)
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, getTotalSteps()));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleQuickStart = async () => {
    if (!lastAgent) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:3000/api/interview/session/quick-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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

      // Go directly to waiting page (which will skip polling for temp sessions)
      navigate(`/interview/session/${sessionId}/waiting`);
    } catch (error) {
      console.error('Error with quick-start:', error);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // First time: show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmSession = async () => {
    setIsSubmitting(true);
    console.log("Submitting Configuration:", formData);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        console.error("No authentication token found. Please log in.");
        toast.error('Please log in to start an interview');
        navigate('/login');
        return;
      }

      console.log("Using Token:", token);

      const endpoint = formData.session.interview_mode === 'technical'
        ? 'http://localhost:3000/api/interview/technical/session'
        : 'http://localhost:3000/api/interview/session';

      // Send configuration as JSON (CV file is already base64 encoded in formData)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
        // No timeout - wait indefinitely
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch prompts from backend:", response.status, errorData);
        setIsSubmitting(false);

        if (response.status === 401) {
          setShowConfirmModal(false);
          navigate('/login');
          return;
        }

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
        if (!sessionId) {
          setIsSubmitting(false);
          setShowConfirmModal(false);
          return;
        }

        localStorage.setItem('pendingInterviewMode', formData.session.interview_mode);

        // Technical: store config and go straight to editor, Behavioral: go to waiting
        if (formData.session.interview_mode === 'technical') {
          localStorage.setItem('technicalSessionConfig', JSON.stringify(formData.session));
          navigate(`/technical/${sessionId}`);
        } else {
          navigate(`/interview/session/${sessionId}/waiting`);
        }
      }
    } catch (error) {
      console.error("Error submitting configuration:", error);
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const steps = [
    { title: "Session", icon: Clock },
    { title: "Target", icon: Target },
    { title: "Profile", icon: User }
  ];

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

            {/* STEP 1: SESSION SETTINGS */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Session Configuration</h2>
                  <p className="text-slate-400">Customize the parameters of your mock interview.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-400 mb-2 block">Interview Mode</label>
                    <div className="space-y-3">
                      <SelectButton
                        active={formData.session.interview_mode === 'behavioral'}
                        onClick={() => updateField('session', 'interview_mode', 'behavioral')}
                        icon={User}
                      >
                        Behavioral
                      </SelectButton>
                      <SelectButton
                        active={formData.session.interview_mode === 'technical'}
                        onClick={() => updateField('session', 'interview_mode', 'technical')}
                        icon={Code}
                      >
                        Technical
                      </SelectButton>
                      <SelectButton
                        active={formData.session.interview_mode === 'behavioral_plus_dsa'}
                        onClick={() => updateField('session', 'interview_mode', 'behavioral_plus_dsa')}
                        icon={Code}
                      >
                        Behavioral + DSA
                      </SelectButton>
                    </div>
                  </div>

                  {/* BEHAVIORAL CONFIG */}
                  {formData.session.interview_mode !== 'technical' && (
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-slate-400 mb-2 block">Duration</label>
                        <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                          {[15, 30, 45, 60].map(mins => (
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
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-400 mb-2 block">Language</label>
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
                  )}

                  {/* TECHNICAL CONFIG */}
                  {formData.session.interview_mode === 'technical' && (
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-slate-400 mb-2 block">Difficulty</label>
                        <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                          {['easy', 'medium', 'hard'].map(level => (
                            <button
                              key={level}
                              onClick={() => updateField('session', 'difficulty', level)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.session.difficulty === level
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                              {level}
                            </button>
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
                              {lang.charAt(0).toUpperCase() + lang.slice(1)}
                            </SelectButton>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: TARGET ROLE - ONLY FOR BEHAVIORAL */}
            {step === 2 && formData.session.interview_mode !== 'technical' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Target Role</h2>
                  <p className="text-slate-400">Tell us what you're aiming for.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Target Company</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['general_tech', 'finance', 'quant', 'startup'].map(type => (
                          <SelectButton
                            key={type}
                            active={formData.target.company_preset === type}
                            onClick={() => updateField('target', 'company_preset', type)}
                          >
                            <span className="capitalize">{type.replace('_', ' ')}</span>
                          </SelectButton>
                        ))}
                      </div>
                    </div>

                    <InputField
                      label="Role Title"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={formData.target.role_title}
                      onChange={(e) => updateField('target', 'role_title', e.target.value)}
                    />

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Seniority</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {['intern', 'grad', 'senior'].map(level => (
                          <button
                            key={level}
                            onClick={() => updateField('target', 'seniority', level)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.target.seniority === level
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
                    <TagInput
                      label="Focus Areas"
                      tags={formData.target.focus_areas}
                      onAdd={(tag) => updateField('target', 'focus_areas', [...formData.target.focus_areas, tag])}
                      onRemove={(tag) => updateField('target', 'focus_areas', formData.target.focus_areas.filter(t => t !== tag))}
                      placeholder="Type & Enter (e.g. System Design)"
                    />

                    <TagInput
                      label="Preferred Languages"
                      tags={formData.target.preferred_languages}
                      onAdd={(tag) => updateField('target', 'preferred_languages', [...formData.target.preferred_languages, tag])}
                      onRemove={(tag) => updateField('target', 'preferred_languages', formData.target.preferred_languages.filter(t => t !== tag))}
                      placeholder="e.g. Python, Java"
                    />

                    <InputField
                      label="Job Description (Optional)"
                      placeholder="Paste key responsibilities..."
                      value={formData.target.job_description_text}
                      onChange={(e) => updateField('target', 'job_description_text', e.target.value)}
                      textarea
                    />

                    <InputField
                      label="Job Posting URL (Optional)"
                      placeholder="https://..."
                      value={formData.target.job_url}
                      onChange={(e) => updateField('target', 'job_url', e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2B: TECH FOCUS AREAS - ONLY FOR TECHNICAL */}
            {step === 2 && formData.session.interview_mode === 'technical' && (
              <motion.div
                key="step2-tech"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Focus Areas</h2>
                  <p className="text-slate-400">Select topics you want to focus on.</p>
                </div>

                <div className="space-y-6">
                  <TagInput
                    label="Focus Areas"
                    tags={formData.session.technical_focus_areas || []}
                    onAdd={(tag) => updateField('session', 'technical_focus_areas', [...(formData.session.technical_focus_areas || []), tag])}
                    onRemove={(tag) => updateField('session', 'technical_focus_areas', (formData.session.technical_focus_areas || []).filter(t => t !== tag))}
                    placeholder="e.g. Arrays, Strings, Dynamic Programming, Graphs"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: CANDIDATE PROFILE - ONLY FOR BEHAVIORAL */}
            {step === 3 && formData.session.interview_mode !== 'technical' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Candidate Profile</h2>
                  <p className="text-slate-400">Help us personalize the challenge to you.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Resume / CV</label>
                      <FileUpload
                        file={formData.candidate.cv_file}
                        onFileSelect={(file) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            // Extract base64 data without the data URI prefix
                            const dataUrl = reader.result;
                            const base64Data = dataUrl.split(';base64,').pop();

                            updateField('candidate', 'cv_file', {
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              content: base64Data // Pure base64 string without prefix
                            });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>

                    <TagInput
                      label="Your Strengths"
                      tags={formData.candidate.self_strengths}
                      onAdd={(tag) => updateField('candidate', 'self_strengths', [...formData.candidate.self_strengths, tag])}
                      onRemove={(tag) => updateField('candidate', 'self_strengths', formData.candidate.self_strengths.filter(t => t !== tag))}
                      placeholder="e.g. Communication, SQL"
                    />

                    <TagInput
                      label="Your Weaknesses"
                      tags={formData.candidate.self_weaknesses}
                      onAdd={(tag) => updateField('candidate', 'self_weaknesses', [...formData.candidate.self_weaknesses, tag])}
                      onRemove={(tag) => updateField('candidate', 'self_weaknesses', formData.candidate.self_weaknesses.filter(t => t !== tag))}
                      placeholder="e.g. DP, Graphs"
                    />
                  </div>

                  <div className="space-y-6">
                    <InputField
                      label="Interview Anxiety"
                      placeholder="What makes you nervous?"
                      value={formData.candidate.anxieties}
                      onChange={(e) => updateField('candidate', 'anxieties', e.target.value)}
                      textarea
                    />

                    <TagInput
                      label="Session Goals"
                      tags={formData.candidate.goals}
                      onAdd={(tag) => updateField('candidate', 'goals', [...formData.candidate.goals, tag])}
                      onRemove={(tag) => updateField('candidate', 'goals', formData.candidate.goals.filter(t => t !== tag))}
                      placeholder="e.g. Concise answers"
                    />

                    <div>
                      <label className="text-sm font-medium text-slate-400 mb-2 block">Prior Experience</label>
                      <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5">
                        {['none', 'some', 'lots'].map(level => (
                          <button
                            key={level}
                            onClick={() => updateField('candidate', 'prior_interview_experience', level)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${formData.candidate.prior_interview_experience === level
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
              <li>✓ Interview Mode: <span className="text-emerald-400 font-medium capitalize">{formData.session.interview_mode.replace('_', ' ')}</span></li>
              {formData.session.interview_mode === 'technical' ? (
                <>
                  <li>✓ Difficulty: <span className="text-emerald-400 font-medium capitalize">{formData.session.difficulty}</span></li>
                  <li>✓ Language: <span className="text-emerald-400 font-medium capitalize">{formData.session.preferred_coding_language}</span></li>
                </>
              ) : (
                <>
                  <li>✓ Duration: <span className="text-emerald-400 font-medium">{formData.session.duration_min} minutes</span></li>
                  <li>✓ Role: <span className="text-emerald-400 font-medium">{formData.target.role_title || 'Not specified'}</span></li>
                </>
              )}
            </ul>
          </div>

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
