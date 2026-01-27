'use client';

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from './component/page/Header';

import behaviourIcon from './assets/behaviour.png';
import technicalIcon from './assets/technical.png';
import tickIcon from './assets/tick.png';
import gradientBackground from './assets/gradient_background.png';
import googleIcon from './assets/google.png';
import metaIcon from './assets/meta.png';
import mailIcon from './assets/mail.png';

const App = () => {
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);
  // Initialise from localStorage if available
  const [company, setCompany] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('selectedCompany')) || null
  );
  const [interviewType, setInterviewType] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('selectedInterviewType')) || ''
  );

  // CV: { fileName, mimeType, base64 } | null
  const [cv, setCv] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('candidateCv');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const ready = Boolean(company) && interviewType;

  const backgroundStyle = {
    backgroundImage: `linear-gradient(to top, rgba(248,250,252,1) 0%, rgba(248,250,252,1) 15%, rgba(248,250,252,0) 40%, rgba(248,250,252,0) 100%), url(${gradientBackground})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center bottom',
    backgroundColor: '#f8fafc',
  };

  const handleInterviewStart = () => {
    if (!ready) return;

    // persist choices for downstream pages
    if (company) {
      localStorage.setItem('selectedCompany', company);
    }
    localStorage.setItem('selectedInterviewType', interviewType);

    // persist CV (if any)
    if (cv) {
      localStorage.setItem('candidateCv', JSON.stringify(cv));
    } else {
      localStorage.removeItem('candidateCv');
    }

    // pass state forward so interview pages can access it directly too
    navigate(`/${interviewType}`, {
      state: {
        company,
        interviewType,
        cv,
      },
    });
  };

  return (
    <div className='min-h-screen text-slate-900 flex flex-col' style={backgroundStyle}>
      <Header />
      
      {/* Hero section */}
      <section className='w-full bg-slate-50'>
        <div className='mx-auto flex max-w-5xl flex-col items-center px-4 pt-28 pb-24 text-center md:pt-32 md:pb-32'>
          <h1 className='text-3xl sm:text-4xl md:text-[3.1rem] leading-tight font-bold text-slate-200'>
            <span className='block'>Welcome to something</span>
            <span className='block'>
              <span>new for </span>
              <span className='text-slate-900 font-extrabold'>interview prep</span>
            </span>
          </h1>
          <p className='mt-5 max-w-2xl text-sm md:text-base leading-relaxed text-slate-500'>
            FAANG-style interviews are brutal.{' '}
            <span className='italic text-slate-700 '>Rehearse.AI</span> turns preparation into an
            advantage – giving you a realistic conversational mock interview, tailored feedback, and
            the confidence to walk into every round prepared.
          </p>
        </div>
      </section>

      <main className='flex-1 flex flex-col'>
        <div className='flex-1 flex items-center justify-center px-4'>
          <div className='w-full max-w-5xl space-y-8'>
            {/* Company Selector */}
            <CompanySelector company={company} onChange={setCompany} />

            {/* Interview Type Selector */}
            <InterviewTypeGrid
              selectedType={interviewType}
              onChange={(id) => {
                const next = id || '';
                setInterviewType(next);
                if (next) {
                  localStorage.setItem('selectedInterviewType', next);
                } else {
                  localStorage.removeItem('selectedInterviewType');
                }
              }}
              disabled={!company}
            />

            {/* CV upload – now wired to setCv */}
            <CvUpload onCvLoaded={setCv} />

            {/* Stable area for Start interview / hint */}
            <div className='pt-4 flex justify-center'>
              <div className='min-h-[40px] flex items-center'>
                {ready ? (
                  <button
                    onClick={handleInterviewStart}
                    className='inline-flex items-center justify-center rounded-full bg-slate-900 text-slate-50 px-5 py-2.5 text-sm font-medium hover:bg-slate-800 transition'
                  >
                    Start interview
                  </button>
                ) : (
                  <p className='text-xs text-slate-600 text-center'>
                    Choose a company and interview type to start.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function CompanySelector({ company, onChange }) {
  const companies = [
    { id: 'google', label: 'Google', icon: googleIcon },
    { id: 'meta', label: 'Meta', icon: metaIcon },
    { id: 'other', label: 'Other' },
  ];

  const handleCompanyClick = (id, isSelected) => {
    const next = isSelected ? null : id;
    onChange(next);

    if (next) {
      localStorage.setItem('selectedCompany', next);
    } else {
      localStorage.removeItem('selectedCompany');
    }
  };

  return (
    <div className='space-y-2'>
      <p className='text-xs font-medium text-slate-500 uppercase'>Company</p>
      <div className='flex flex-wrap gap-2'>
        {companies.map((c) => {
          const selected = company === c.id;
          const base =
            'px-4 py-1.5 rounded-full text-sm transition inline-flex items-center gap-2 ' +
            (selected ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 ');

          return (
            <button
              key={c.id}
              type='button'
              className={base}
              onClick={() => handleCompanyClick(c.id, selected)}
            >
              {c.icon && (
                <span className='h-8 w-8 rounded-full bg-white flex items-center justify-center border border-slate-300'>
                  <img src={c.icon} alt={`${c.label} logo`} className='h-5 w-5 object-contain' />
                </span>
              )}
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const InterviewTypeGrid = ({ selectedType, onChange, disabled }) => {
  const options = [
    {
      id: 'behavioural',
      title: 'Behavioural interview',
      desc: 'Work style, communication, leadership, and culture fit questions.',
      icon: behaviourIcon,
    },
    {
      id: 'technical',
      title: 'Technical interview',
      desc: 'Coding, algorithms, data structures, and system design questions.',
      icon: technicalIcon,
    },
  ];

  const handleToggle = (id, isSelected) => {
    if (disabled) return;
    onChange(isSelected ? null : id);
  };

  return (
    <div className='space-y-4'>
      {options.map((opt) => {
        const selected = selectedType === opt.id;

        return (
          <button
            key={opt.id}
            type='button'
            disabled={disabled}
            onClick={() => handleToggle(opt.id, selected)}
            className={`flex items-start gap-4 transition rounded-xl px-2 py-1 -mx-2 ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
            }`}
          >
            <div className='mt-1'>
              {selected ? (
                <div className='h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center'>
                  <img src={tickIcon} alt='' className='h-4 w-4 invert' />
                </div>
              ) : (
                <div className='h-9 w-9 rounded-full border border-slate-300 flex items-center justify-center'>
                  <span className='text-xs text-slate-400 font-medium'>{opt.title[0]}</span>
                </div>
              )}
            </div>
            <div className='text-left'>
              <h3
                className={`text-base font-semibold ${
                  selected ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {opt.title}
              </h3>
              <p
                className={`mt-1 text-sm leading-relaxed ${
                  selected ? 'text-slate-500' : 'text-slate-300'
                }`}
              >
                {opt.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

function CvUpload({ onCvLoaded }) {
  const [fileName, setFileName] = useState(null);

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;
      if (!result || typeof result !== 'string') return;

      // result is like: "data:application/pdf;base64,AAAA..."
      const [meta, base64] = result.split(',');

      const cvPayload = {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: base64 || '',
      };

      if (onCvLoaded) {
        onCvLoaded(cvPayload);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <label className='inline-flex items-center gap-3 rounded-full bg-white/80 px-3 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-white transition'>
      <div className='flex h-6 w-6 items-center justify-center rounded-full bg-slate-900'>
        <span className='text-[11px] font-semibold text-white'>CV</span>
      </div>
      <div className='flex flex-col items-start'>
        <span className='font-medium text-[11px] text-slate-700'>
          {fileName ? 'CV uploaded' : 'Upload your CV'}
        </span>
        <span className='text-[10px] text-slate-400'>{fileName || 'PDF or DOCX, max 10 MB'}</span>
      </div>
      <input type='file' accept='.pdf,.doc,.docx' className='hidden' onChange={handleChange} />
    </label>
  );
}

export default App;
