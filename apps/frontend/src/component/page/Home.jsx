import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './Header';
import ParticleText from '../ParticleText';
import SectionWrapper, { fadeInUp, staggerContainer } from '../ui/SectionWrapper';
import { useTheme } from '../../context/ThemeContext';

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef(null);
  const { theme } = useTheme();

  // Memoize star positions to avoid re-rendering sparkles
  const stars = useMemo(() => {
    return [...Array(50)].map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      animationClass: i % 3 === 0 ? 'animate-twinkle-1' : i % 3 === 1 ? 'animate-twinkle-2' : 'animate-twinkle-3',
      opacity: Math.random() * 0.5 + 0.3
    }));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = window.innerHeight * 0.8;
      const progress = Math.min(scrolled / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Logo scrolling animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId;
    let position = 0;
    const speed = 0.3;

    const animate = () => {
      position -= speed;
      const singleSetWidth = scrollContainer.scrollWidth / 4;
      if (Math.abs(position) >= singleSetWidth) {
        position = position + singleSetWidth;
      }
      scrollContainer.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => { if (animationId) cancelAnimationFrame(animationId); };
  }, []);

  // Calculate opacity for hero text (fade out on scroll)
  const textOpacity = 1 - scrollProgress * 1.5;
  const textTransform = `translateY(${scrollProgress * -50}px)`;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-emerald-500/30 transition-colors duration-300">
      <Header />

      {/* Fixed Hero Section */}
      <div className="fixed inset-0 z-0 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300" style={{ height: '100vh', paddingBottom: '20vh' }}>
        <section className="relative h-full flex items-center overflow-hidden">
          {/* Deep Space Background - Dark Mode Only */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-[#000000] hidden dark:block" />

          {/* Light Mode - Gradient background like Meridian */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/60 dark:hidden" />
          <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-emerald-100/30 via-blue-50/20 to-transparent dark:hidden" />

          {/* Light mode - Colored glow behind globe */}
          <div className="absolute top-[10%] right-[5%] w-[700px] h-[700px] bg-gradient-to-bl from-blue-200/50 via-emerald-100/40 to-transparent rounded-full blur-[120px] pointer-events-none dark:hidden" />
          <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-gradient-to-tr from-blue-100/30 via-transparent to-transparent rounded-full blur-[100px] pointer-events-none dark:hidden" />

          {/* Noise Texture Overlay - Dark mode only */}
          <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay hidden dark:block" />

          {/* Perspective Grid - Dark mode only */}
          <div className="absolute inset-0 perspective-grid opacity-20 pointer-events-none mix-blend-screen hidden dark:block" />

          {/* Ambient Texture Light - Dark mode only */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-emerald-950/30 opacity-60 pointer-events-none hidden dark:block" />

          {/* Top Green/Blue Light - Dark mode only */}
          <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-blue-900/20 via-emerald-900/10 to-transparent blur-3xl hidden dark:block" />
          <motion.div
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-32 left-1/4 right-1/4 h-[400px] bg-gradient-to-r from-blue-400/20 to-emerald-400/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none hidden dark:block"
          />

          {/* Stars - Dark Mode Only */}
          <div className="absolute inset-0 pointer-events-none hidden dark:block">
            {stars.map((star) => (
              <div
                key={star.id}
                className={`absolute rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] ${star.animationClass}`}
                style={{
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                }}
              />
            ))}
          </div>

          {/* Particle Background - receives scroll progress + globe offset */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            <ParticleText
              scrollProgress={scrollProgress}
              globeOffset={{ x: 0.66, y: 0.38 }}
              theme={theme}
            />
          </motion.div>

          {/* Hero Content - Split Layout */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full pointer-events-none">
            <div className="flex flex-col lg:flex-row items-center lg:items-center">
              {/* Left side - Text content (narrower for asymmetry) */}
              <div
                className="w-full lg:w-[38%] text-center lg:text-left pointer-events-auto transition-all duration-300"
                style={{
                  opacity: textOpacity,
                  transform: textTransform
                }}
              >
                <motion.h1
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-slate-900 dark:text-white mb-5 leading-[1.1] tracking-tight dark:drop-shadow-2xl transition-colors duration-300"
                >
                  Practice Interviews,
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-indigo-400">
                    Real Results
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-base sm:text-lg text-slate-500 dark:text-slate-300 mb-8 leading-relaxed max-w-md mx-auto lg:mx-0 transition-colors duration-300"
                >
                  Master simulated interviews just like the real thing and land your dream job with AI-powered feedback.
                </motion.p>

                <motion.div
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="flex justify-center lg:justify-start gap-3"
                >
                  <Link
                    to="/register"
                    className="px-7 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-base font-semibold rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.03] transition-all duration-300"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    to="/demo"
                    className="px-7 py-3.5 border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white text-base font-medium rounded-full hover:bg-white/60 dark:hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
                  >
                    Watch Demo
                  </Link>
                </motion.div>
              </div>

              {/* Right side - Spacer for globe canvas (bigger area) */}
              <div className="hidden lg:block w-[62%]" />
            </div>
          </div>
        </section>
      </div>

      {/* Scrolling Content - positioned to scroll over fixed hero */}
      <div className="relative z-10 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] dark:shadow-none" style={{ marginTop: '80vh' }}>

        {/* Gradient Fade to Blend Hero and Content */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-50 dark:to-[#02040a] -mt-32 pointer-events-none transition-colors duration-300" />

        {/* Features Section */}
        <SectionWrapper className="py-28 relative overflow-hidden bg-transparent">
          {/* Ambient Light - Dark mode only */}
          <div className="absolute inset-0 pointer-events-none hidden dark:block">
            <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen" />
            <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen" />
          </div>

          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
            <motion.div variants={fadeInUp} className="text-center mb-16">
              <span className="inline-block text-sm font-semibold tracking-[0.2em] uppercase text-blue-600 dark:text-blue-400 mb-4">
                Features
              </span>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 transition-colors duration-300">
                Why Choose Mockly?
              </h2>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto transition-colors duration-300">
                Everything you need to prepare for interviews
              </p>
            </motion.div>

            <motion.div variants={staggerContainer} className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {/* Feature 1 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:shadow-md dark:hover:bg-white/10 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-300 h-full group">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Behavioral Practice
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300">
                    Master STAR method responses with AI-guided practice sessions tailored to your target company.
                  </p>
                </div>
              </motion.div>

              {/* Feature 2 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:shadow-md dark:hover:bg-white/10 hover:border-purple-200 dark:hover:border-purple-500/30 transition-all duration-300 h-full group">
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Technical Interviews
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300">
                    Practice coding challenges and system design with real-time feedback on your solutions.
                  </p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:shadow-md dark:hover:bg-white/10 hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all duration-300 h-full group">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Track Progress
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300">
                    Monitor your improvement over time with detailed analytics and personalized recommendations.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* Social Proof Section */}
        <SectionWrapper className="py-28 relative overflow-hidden bg-transparent">
          {/* Background Gradient Accents - Dark mode only */}
          <div className="absolute inset-0 pointer-events-none hidden dark:block">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px]" />
          </div>

          <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center relative z-10">
            <div className="mb-12">
              <motion.div variants={fadeInUp}>
                <span className="inline-block text-sm font-semibold tracking-[0.2em] uppercase text-emerald-600 dark:text-emerald-400 mb-4">
                  Trusted
                </span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 transition-colors duration-300">
                  Backed by <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Real Data</span>
                </h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 leading-relaxed max-w-3xl mx-auto transition-colors duration-300">
                  We've analyzed thousands of technical interviews from top tier tech companies to create the most realistic simulation engine available.
                </p>
              </motion.div>

              {/* Scrolling company logos */}
              <motion.div variants={fadeInUp} className="relative w-full overflow-hidden">
                {/* Side Fade Overlays */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 dark:from-[#02040a] to-transparent z-10 transition-colors duration-300" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-50 dark:from-[#02040a] to-transparent z-10 transition-colors duration-300" />

                <div ref={scrollRef} className="flex gap-16 py-8" style={{ willChange: 'transform' }}>
                  {[1, 2, 3, 4].map((setIndex) => (
                    <div key={setIndex} className="flex gap-16 shrink-0 items-center">
                      <img src="https://cdn.simpleicons.org/google" alt="Google"
                        className="h-10 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                      <img src="https://cdn.simpleicons.org/meta/0081FB" alt="Meta"
                        className="h-10 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(0,129,251,0.5)]" />
                      <img src="https://cdn.simpleicons.org/netflix/E50914" alt="Netflix"
                        className="h-8 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(229,9,20,0.5)]" />
                      <img src="https://cdn.simpleicons.org/apple" alt="Apple"
                        className="h-10 w-auto opacity-40 dark:opacity-90 hover:opacity-80 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                      <img src="https://cdn.simpleicons.org/uber" alt="Uber"
                        className="h-8 w-auto opacity-40 dark:opacity-90 hover:opacity-80 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                      <img src="https://cdn.simpleicons.org/spotify/1DB954" alt="Spotify"
                        className="h-10 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(29,185,84,0.5)]" />
                      <img src="https://cdn.simpleicons.org/airbnb/FF5A5F" alt="Airbnb"
                        className="h-10 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(255,90,95,0.5)]" />
                      <img src="https://cdn.simpleicons.org/nvidia/76B900" alt="Nvidia"
                        className="h-8 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]" />
                      <img src="https://cdn.simpleicons.org/intel/0068B5" alt="Intel"
                        className="h-8 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(0,104,181,0.5)]" />
                      <img src="https://cdn.simpleicons.org/tesla/E82127" alt="Tesla"
                        className="h-8 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(232,33,39,0.5)]" />
                      <img src="https://cdn.simpleicons.org/github" alt="GitHub"
                        className="h-10 w-auto opacity-40 dark:opacity-90 hover:opacity-80 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                      <img src="https://cdn.simpleicons.org/stripe/008CDD" alt="Stripe"
                        className="h-10 w-auto opacity-50 dark:opacity-80 hover:opacity-90 transition-all duration-300 dark:drop-shadow-[0_0_8px_rgba(0,140,221,0.5)]" />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Stats row */}
              <motion.div variants={fadeInUp} className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white transition-colors duration-300">10K+</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Practice Sessions</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white transition-colors duration-300">500+</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Interview Questions</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white transition-colors duration-300">95%</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Satisfaction Rate</p>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="mt-14">
                <p className="text-xl font-semibold text-slate-800 dark:text-blue-400 mb-3 transition-colors duration-300">
                  Big companies aren't scary anymore.
                </p>
                <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto transition-colors duration-300">
                  Our AI agent has cracked the code for interviews at Google, Amazon, Meta, and more. Practice with it, and you'll crack it too.
                </p>
              </motion.div>
            </div>
          </div>
        </SectionWrapper>

        {/* CTA Section */}
        <SectionWrapper className="py-28 relative bg-transparent">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
            <motion.div
              variants={fadeInUp}
              className="bg-slate-900 dark:bg-white/5 backdrop-blur-lg rounded-3xl p-12 md:p-16 text-center relative overflow-hidden border border-slate-800 dark:border-white/10"
            >
              {/* Subtle gradient accents */}
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/15 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-[80px] pointer-events-none" />

              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 relative z-10">
                Ready to Start Practicing?
              </h2>
              <p className="text-lg text-slate-300 dark:text-slate-300 mb-10 max-w-2xl mx-auto relative z-10">
                Join thousands of candidates preparing for their dream jobs with our AI-powered interview coach.
              </p>
              <Link
                to="/register"
                className="relative z-10 inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white text-lg font-semibold rounded-full shadow-lg shadow-blue-500/20 hover:shadow-xl hover:scale-[1.03] transition-all duration-300"
              >
                Get Started Now
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* Footer */}
        <footer className="bg-transparent py-16 border-t border-slate-200 dark:border-white/5 transition-colors duration-300 relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-500">
                  Mockly
                </span>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
                  AI-powered interview preparation for your dream job.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Product</h4>
                <ul className="space-y-3">
                  <li><Link to="/register" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Get Started</Link></li>
                  <li><Link to="/dashboard" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Dashboard</Link></li>
                  <li><Link to="/demo" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Watch Demo</Link></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Resources</h4>
                <ul className="space-y-3">
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">Blog</span></li>
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">Interview Tips</span></li>
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">FAQ</span></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Company</h4>
                <ul className="space-y-3">
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">About</span></li>
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">Privacy</span></li>
                  <li><span className="text-sm text-slate-500 dark:text-slate-400">Terms</span></li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                © 2026 Mockly. All rights reserved.
              </p>
              <div className="flex gap-5">
                {/* GitHub */}
                <a href="#" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                </a>
                {/* Twitter/X */}
                <a href="#" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                {/* LinkedIn */}
                <a href="#" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
