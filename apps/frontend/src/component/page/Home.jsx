import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Code2, MessageSquare } from 'lucide-react';
import Header from './Header';
import ParticleText from '../ParticleText';
import DemoSection from '../home/DemoSection';
import { useTheme } from '../../context/ThemeContext';

const PRACTICE_QUESTIONS = [
  'Tell me about a time you led a project through ambiguity and still delivered a measurable outcome.',
  'How would you explain a difficult technical concept to a non-technical stakeholder under a tight deadline?',
  'Describe a decision you made with incomplete data and how you evaluated whether it was the right call.',
  'Walk me through a moment where your initial approach failed and what you changed to recover quickly.',
  'If you inherited a slow, unreliable API, what would you prioritize in your first two weeks and why?',
  'Tell me about a time you had to defend a technical decision to a cross-functional team with different priorities.'
];

const PRACTICE_TRACKS = [
  {
    title: 'Behavioral Practice',
    subtitle: 'Storytelling, leadership, and decision making',
    icon: MessageSquare,
    points: [
      'Use STAR structure to turn experiences into clear, high-signal answers.',
      'Practice ownership, conflict resolution, ambiguity, and impact framing.',
      'Improve communication quality with concise, outcome-driven responses.'
    ]
  },
  {
    title: 'Technical Practice',
    subtitle: 'Coding depth and technical communication',
    icon: Code2,
    points: [
      'Train on system design, debugging, trade-offs, and performance reasoning.',
      'Practice explaining technical ideas to both engineers and non-technical stakeholders.',
      'Strengthen structured thinking under pressure with realistic interview prompts.'
    ]
  }
];

const STEPS = [
  {
    label: '1. Read the prompt',
    description: 'Start with one realistic interview question that appears in a focused practice canvas.'
  },
  {
    label: '2. Write your answer',
    description: 'Structure your response clearly and include context, actions, and measurable outcomes.'
  },
  {
    label: '3. Analyze in dashboard',
    description: 'Send your answer for full AI analysis after login, with tailored coaching and next actions.'
  }
];

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const Home = () => {
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const token = localStorage.getItem('token');

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [typedQuestion, setTypedQuestion] = useState('');
  const [showAnswerArea, setShowAnswerArea] = useState(false);
  const [answer, setAnswer] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stars = useMemo(() => {
    return [...Array(50)].map((_, i) => ({
      id: i,
      top: `${(i * 37) % 100}%`,
      left: `${(i * 53) % 100}%`,
      size: `${1 + ((i * 7) % 3)}px`,
      animationClass: i % 3 === 0 ? 'animate-twinkle-1' : i % 3 === 1 ? 'animate-twinkle-2' : 'animate-twinkle-3',
      opacity: 0.35 + ((i * 11) % 45) / 100
    }));
  }, []);

  const currentQuestion = PRACTICE_QUESTIONS[currentQuestionIndex];
  const answerWordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  useEffect(() => {
    setTypedQuestion('');
    setShowAnswerArea(false);
    setAnswer('');

    if (prefersReducedMotion) {
      setTypedQuestion(currentQuestion);
      setShowAnswerArea(true);
      return undefined;
    }

    let charIndex = 0;
    const typingInterval = setInterval(() => {
      charIndex += 1;
      setTypedQuestion(currentQuestion.slice(0, charIndex));

      if (charIndex >= currentQuestion.length) {
        clearInterval(typingInterval);
        setShowAnswerArea(true);
      }
    }, 22);

    return () => clearInterval(typingInterval);
  }, [currentQuestion, prefersReducedMotion]);

  const showNextQuestion = () => {
    setCurrentQuestionIndex((prev) => {
      if (PRACTICE_QUESTIONS.length <= 1) return prev;
      let next = prev;
      while (next === prev) {
        next = Math.floor(Math.random() * PRACTICE_QUESTIONS.length);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-emerald-500/30 transition-colors duration-300">
      <Header />

      <div className="fixed inset-0 z-0 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300" style={{ height: '100vh', paddingBottom: '20vh' }}>
        <section className="relative h-full flex items-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-[#000000] hidden dark:block" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
          <div
            className="absolute inset-0 dark:hidden pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle 32vmin at 66% 46%, rgba(255,255,255,1) 0 75%, rgba(255,255,255,0.7) 83%, rgba(255,255,255,0.3) 91%, rgba(255,255,255,0) 100%), linear-gradient(to top, rgba(37,99,235,0.42) 0%, rgba(37,99,235,0.34) 34%, rgba(16,185,129,0.17) 62%, rgba(255,255,255,0) 78%, rgba(255,255,255,0) 100%)'
            }}
          />

          <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay hidden dark:block" />
          <div className="absolute inset-0 perspective-grid opacity-20 pointer-events-none mix-blend-screen hidden dark:block" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-emerald-950/30 opacity-60 pointer-events-none hidden dark:block" />

          <motion.div
            animate={prefersReducedMotion ? {} : { opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 left-1/4 right-1/4 h-[400px] bg-gradient-to-r from-blue-400/20 to-emerald-400/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none hidden dark:block"
          />

          <div className="absolute inset-0 pointer-events-none hidden dark:block">
            {stars.map((star) => (
              <div
                key={star.id}
                className={`absolute rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] ${star.animationClass}`}
                style={{ top: star.top, left: star.left, width: star.size, height: star.size, opacity: star.opacity }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full pointer-events-none z-10 isolate"
          >
            <ParticleText scrollProgress={scrollProgress} globeOffset={{ x: 0.66, y: 0.46 }} theme={theme} />
          </motion.div>

          <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full pointer-events-none">
            <div className="flex flex-col lg:flex-row items-center lg:gap-14 xl:gap-20">
              <div
                className="w-full lg:w-[35%] text-center lg:text-left pointer-events-auto transition-all duration-300"
              >
                <motion.h1
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-slate-900 dark:text-white mb-5 leading-[1.08] tracking-tight"
                >
                  Practice Interviews,
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-indigo-400">
                    Real Improvement
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-md mx-auto lg:mx-0"
                >
                  Train with realistic prompts, get structured AI feedback, and build confidence before the real interview.
                </motion.p>

                <motion.div
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="flex justify-center lg:justify-start gap-3"
                >
                  <Link
                    to={token ? '/dashboard' : '/register'}
                    className="hero-cta px-7 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-base font-semibold rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 cursor-pointer"
                  >
                    <span className="relative z-10">{token ? 'Go to Dashboard' : 'Get Started Free'}</span>
                  </Link>
                  <a
                    href="#question-lab"
                    className="px-7 py-3.5 border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white text-base font-medium rounded-full hover:bg-white/70 dark:hover:bg-white/10 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                  >
                    Try Question Lab
                  </a>
                </motion.div>
              </div>

              <div className="hidden lg:block w-[65%]" />
            </div>
          </div>
        </section>
      </div>

      <div className="relative z-10 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] dark:shadow-none" style={{ marginTop: '80vh' }}>
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-50 dark:to-[#02040a] -mt-32 pointer-events-none" />

        {/* Live product demo — 3-mode tabbed MP4 videos rendered via HyperFrames */}
        <DemoSection />

        <motion.section
          id="question-lab"
          className="py-24 relative overflow-hidden"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 48 }}
          whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="absolute inset-0 pointer-events-none dark:hidden">
            <div className="absolute top-8 left-1/3 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-sky-100/50 to-transparent blur-[110px]" />
            <div className="absolute bottom-0 right-0 w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-emerald-100/45 to-transparent blur-[90px]" />
          </div>
          <div className="absolute inset-0 pointer-events-none hidden dark:block">
            <div className="absolute top-16 left-1/4 w-[760px] h-[760px] rounded-full bg-blue-900/10 blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-[760px] h-[760px] rounded-full bg-emerald-900/10 blur-[120px]" />
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10"
          >
            <motion.div variants={fadeInUp} className="text-center mb-14">
              <span className="inline-block text-sm font-semibold tracking-[0.2em] uppercase text-blue-600 dark:text-blue-400 mb-4">
                Interactive Practice
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                Try a Real Interview Prompt
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Watch a prompt appear, write your answer, then analyze it in your dashboard.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="relative max-w-5xl mx-auto rounded-[2rem] border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-slate-900/30 backdrop-blur-2xl overflow-hidden shadow-[0_26px_65px_rgba(15,23,42,0.1)] dark:shadow-none">
              <div className="absolute -top-24 -right-20 w-72 h-72 bg-blue-300/20 dark:bg-blue-500/20 blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-24 -left-20 w-72 h-72 bg-emerald-300/20 dark:bg-emerald-500/20 blur-[80px] pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between border-b border-slate-200/70 dark:border-white/10 px-6 py-4 md:px-8">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Mock Interview Console</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">Live prompt simulation</p>
                </div>
                <button
                  type="button"
                  onClick={showNextQuestion}
                  className="interactive-btn text-sm font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-400/30 rounded-full px-4 py-1.5 bg-white/80 dark:bg-slate-900/40 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors duration-300"
                >
                  New question
                </button>
              </div>

              <div className="relative z-10 p-6 md:p-8">
                <div className="rounded-3xl border border-blue-200/70 dark:border-blue-400/30 bg-gradient-to-br from-blue-50/90 via-blue-50/70 to-emerald-50/80 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-emerald-500/10 px-5 py-6 md:px-7 md:py-7 min-h-[170px] md:min-h-[190px] shadow-[0_10px_30px_rgba(37,99,235,0.08)]">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Interviewer</p>
                  </div>
                  <p className="text-lg md:text-2xl leading-relaxed text-slate-800 dark:text-slate-100 font-medium">
                    {typedQuestion}
                    {!showAnswerArea && <span className="inline-block ml-1 w-[2px] h-[1.1em] bg-blue-600 dark:bg-blue-300 align-[-0.18em] animate-pulse" />}
                  </p>
                </div>
              </div>

              {showAnswerArea && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-10 px-6 pb-6 md:px-8 md:pb-8"
                >
                  <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 p-4 md:p-5">
                    <label htmlFor="answer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Your response
                    </label>
                    <textarea
                      id="answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Write your response. Focus on situation, action, and measurable impact."
                      className="w-full min-h-[190px] rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-950/55 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{answerWordCount} words</p>
                      <Link
                        to={token ? '/dashboard' : '/login'}
                        className="hero-cta interactive-btn inline-flex items-center rounded-full px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300"
                      >
                        {token ? 'Analyze in Dashboard' : 'Analyze answer'}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.section>

        <section className="py-20 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <span className="inline-block text-sm font-semibold tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400 mb-3">
                Practice Tracks
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Prepare for behavioral and technical interviews
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                Mockly focuses on the two interview areas that matter most: strong behavioral stories and clear technical communication.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {PRACTICE_TRACKS.map((track) => (
                <motion.div
                  key={track.title}
                  variants={fadeInUp}
                  className="interactive-card rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 backdrop-blur-xl p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)] dark:shadow-none"
                >
                  <div className="w-12 h-12 rounded-2xl mb-5 flex items-center justify-center bg-gradient-to-br from-blue-600 to-emerald-600">
                    <track.icon className="w-6 h-6 text-white" strokeWidth={2.2} />
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">{track.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-5">{track.subtitle}</p>
                  <div className="space-y-3">
                    {track.points.map((point) => (
                      <p key={point} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {point}
                      </p>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="py-20 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <span className="inline-block text-sm font-semibold tracking-[0.2em] uppercase text-emerald-600 dark:text-emerald-400 mb-3">
                How It Works
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">A focused loop for interview growth</h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map((step) => (
                <motion.div
                  key={step.label}
                  variants={fadeInUp}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-white/5 p-6"
                >
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">{step.label}</p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="py-20">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-900 dark:bg-white/5 p-10 md:p-12 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/15 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-[80px] pointer-events-none" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 relative z-10">Ready to interview with confidence?</h2>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto relative z-10">
                Start practicing with realistic prompts now, then unlock full coaching as your prep gets serious.
              </p>
              <Link
                to={token ? '/dashboard' : '/register'}
                className="interactive-btn relative z-10 inline-flex items-center px-8 py-3.5 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white text-base font-semibold rounded-full shadow-lg shadow-blue-500/20 transition-all duration-300 cursor-pointer"
              >
                {token ? 'Continue in Dashboard' : 'Start Practicing Free'}
              </Link>
            </motion.div>
          </div>
        </section>

        <footer className="py-10 border-t border-slate-200 dark:border-white/10 bg-transparent">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col md:flex-row gap-5 md:gap-0 justify-between md:items-center">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">Mockly</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">AI-powered interview practice and structured feedback.</p>
            </div>

            <div className="flex items-center gap-5">
              <Link to="/dashboard" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link to="/login" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Login
              </Link>
              <Link to="/register" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Register
              </Link>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mt-6">
            <p className="text-sm text-slate-500 dark:text-slate-500">© 2026 Mockly. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
