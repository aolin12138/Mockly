import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  GraduationCap
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
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState({
    session: {
      interview_mode: "behavioral",
      duration_min: 30,
      language: "en"
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

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    console.log("Submitting Configuration:", formData);

    try {
      const token = localStorage.getItem('token');
      console.log("Using Token:", token);

      // Send configuration as JSON (CV file is already base64 encoded in formData)
      const response = await fetch('http://localhost:3000/api/interview/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        console.error("Failed to fetch prompts from backend");
      } else {
        const data = await response.json();
        console.log("Received Prompts:", data);
      }
    } catch (error) {
      console.error("Error submitting configuration:", error);
    }

    // Navigate to interview page
    navigate(`/${formData.session.interview_mode === 'behavioral' ? 'behavioural' : 'technical'}`);
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
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="font-bold text-slate-900">M</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Setup
            </span>
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
                        active={formData.session.interview_mode === 'behavioral_plus_dsa'}
                        onClick={() => updateField('session', 'interview_mode', 'behavioral_plus_dsa')}
                        icon={Code}
                      >
                        Behavioral + DSA
                      </SelectButton>
                    </div>
                  </div>

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
                </div>
              </motion.div>
            )}

            {/* STEP 2: TARGET ROLE */}
            {step === 2 && (
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

            {/* STEP 3: CANDIDATE PROFILE */}
            {step === 3 && (
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

            {step < totalSteps ? (
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
    </div>
  );
};

export default InterviewSetup;
