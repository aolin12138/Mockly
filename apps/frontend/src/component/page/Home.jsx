import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './Header';
import ParticleText from '../ParticleText';
import SectionWrapper, { fadeInUp, staggerContainer } from '../ui/SectionWrapper';

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef(null);

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
      // Calculate scroll progress from 0 to 1 based on hero height (80vh)
      const scrolled = window.scrollY;
      const maxScroll = window.innerHeight * 0.8; // Complete transition after 80vh
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
    const speed = 0.3; // pixels per frame (slower for smoother appearance)

    const animate = () => {
      position -= speed;

      // Get the width of one complete set (scrollWidth / 4 since we have 4 duplicate sets)
      const singleSetWidth = scrollContainer.scrollWidth / 4;

      // Reset position when one complete set has scrolled past
      if (Math.abs(position) >= singleSetWidth) {
        position = position + singleSetWidth;
      }

      scrollContainer.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Calculate opacity for hero text (fade out)
  const textOpacity = 1 - scrollProgress * 1.5; // Fade faster
  const textTransform = `translateY(${scrollProgress * -50}px)`; // Move up slightly

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-emerald-500/30 transition-colors duration-300">
      <Header />

      {/* Fixed Hero Section */}
      <div className="fixed inset-0 z-0 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300" style={{ height: '100vh', paddingBottom: '20vh' }}>
        <section className="relative h-full flex items-center overflow-hidden">
          {/* Deep Space Background - Dark Mode Only */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-[#000000] hidden dark:block" />

          {/* Light Mode Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-emerald-50 dark:hidden opacity-50" />

          {/* Noise Texture Overlay */}
          <div className="absolute inset-0 bg-noise opacity-10 dark:opacity-30 pointer-events-none mix-blend-overlay" />

          {/* Perspective Grid for Tech Feel */}
          <div className="absolute inset-0 perspective-grid opacity-5 dark:opacity-20 pointer-events-none mix-blend-screen" />

          {/* Ambient Texture Light - Weak light across website to remove boring black */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/30 via-transparent to-emerald-100/30 dark:from-transparent dark:via-transparent dark:to-emerald-950/30 opacity-60 pointer-events-none" />

          {/* Top Green/Blue Light (Blue/Green Mix) */}
          <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-blue-500/10 via-emerald-500/10 to-transparent blur-3xl dark:from-blue-900/20 dark:via-emerald-900/10 dark:to-transparent" />
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
            className="absolute -top-32 left-1/4 right-1/4 h-[400px] bg-gradient-to-r from-blue-400/20 to-emerald-400/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none"
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

          {/* Particle Background - receives scroll progress */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            <ParticleText scrollProgress={scrollProgress} />
          </motion.div>

          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pointer-events-none">
            <div
              className={`text-center max-w-4xl mx-auto pointer-events-auto transition-all duration-300`}
              style={{
                opacity: textOpacity,
                transform: textTransform
              }}
            >
              <motion.h1
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight drop-shadow-sm dark:drop-shadow-2xl transition-colors duration-300"
              >
                Practice Interviews,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-indigo-400 filter drop-shadow-lg">
                  Real Results
                </span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-2xl mx-auto font-light transition-colors duration-300"
              >
                Master simulated interviews just like the real thing and land your dream job with AI-powered feedback.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-center gap-4"
              >
                <Link
                  to="/register"
                  className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-bold rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition duration-200"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/demo"
                  className="px-8 py-4 bg-transparent border border-slate-200 dark:border-white/20 text-slate-700 dark:text-white text-lg font-semibold rounded-full hover:bg-slate-100 dark:hover:bg-white/10 backdrop-blur-sm transition duration-200"
                >
                  Watch Demo
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      {/* Scrolling Content - positioned to scroll over fixed hero */}
      <div className="relative z-10 bg-slate-50 dark:bg-[#02040a] transition-colors duration-300 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] dark:shadow-none" style={{ marginTop: '80vh' }}>

        {/* Gradient Fade to Blend Hero and Content */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-50 dark:to-[#02040a] -mt-32 pointer-events-none" />

        {/* Features Section */}
        <SectionWrapper className="py-24 relative overflow-hidden bg-transparent">

          {/* Ambient Light Texture */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen" />
            <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-emerald-500/5 dark:bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div variants={fadeInUp} className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 transition-colors duration-300">
                Why Choose Mockly?
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 transition-colors duration-300">
                Everything you need to prepare for interviews
              </p>
            </motion.div>

            <motion.div variants={staggerContainer} className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none hover:border-blue-500/50 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer h-full group">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Behavioral Practice
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light transition-colors duration-300">
                    Master STAR method responses with AI-guided practice sessions tailored to your target company.
                  </p>
                </div>
              </motion.div>

              {/* Feature 2 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none hover:border-purple-500/50 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer h-full group">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Technical Interviews
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light transition-colors duration-300">
                    Practice coding challenges and system design with real-time feedback on your solutions.
                  </p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div variants={fadeInUp} className="h-full">
                <div className="p-8 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none hover:border-emerald-500/50 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer h-full group">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 transition-colors duration-300">
                    Track Progress
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light transition-colors duration-300">
                    Monitor your improvement over time with detailed analytics and personalized recommendations.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* Research & Preparation Section */}
        <SectionWrapper className="py-24 relative overflow-hidden bg-transparent">
          {/* Background Gradient Accents */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-500/5 rounded-full blur-[100px]" />
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="mb-12">
              <motion.div variants={fadeInUp}>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-slate-200 dark:border-white/5 shadow-lg dark:shadow-none">
                  <svg className="w-8 h-8 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 transition-colors duration-300">
                  Backed by <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Real Data</span>
                </h2>
                <p className="text-xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed max-w-3xl mx-auto font-light transition-colors duration-300">
                  We've analyzed thousands of technical interviews from top tier tech companies to create the most realistic simulation engine available.
                </p>
              </motion.div>

              {/* Scrolling company logos */}
              <motion.div variants={fadeInUp} className="relative w-full overflow-hidden mask-linear-fade">
                {/* Side Fade Overlays */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 dark:from-[#02040a] to-transparent z-10 transition-colors duration-300" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-50 dark:from-[#02040a] to-transparent z-10 transition-colors duration-300" />

                <div ref={scrollRef} className="flex gap-16 py-8" style={{ willChange: 'transform' }}>
                  {[1, 2, 3, 4].map((setIndex) => (
                    <div key={setIndex} className="flex gap-16 shrink-0 items-center">
                      <img
                        src="https://cdn.simpleicons.org/google"
                        alt="Google"
                        className="h-10 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/meta/0081FB"
                        alt="Meta"
                        className="h-10 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(0,129,251,0.5)]"
                      />
                      {/* Removed Amazon as requested */}
                      <img
                        src="https://cdn.simpleicons.org/netflix/E50914"
                        alt="Netflix"
                        className="h-8 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(229,9,20,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/apple"
                        alt="Apple"
                        className="h-10 w-auto opacity-60 dark:opacity-90 hover:opacity-100 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      />
                      {/* Removed Microsoft as requested */}
                      <img
                        src="https://cdn.simpleicons.org/uber"
                        alt="Uber"
                        className="h-8 w-auto opacity-60 dark:opacity-90 hover:opacity-100 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/spotify/1DB954"
                        alt="Spotify"
                        className="h-10 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(29,185,84,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/airbnb/FF5A5F"
                        alt="Airbnb"
                        className="h-10 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(255,90,95,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/nvidia/76B900"
                        alt="Nvidia"
                        className="h-8 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/intel/0068B5"
                        alt="Intel"
                        className="h-8 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(0,104,181,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/tesla/E82127"
                        alt="Tesla"
                        className="h-8 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(232,33,39,0.5)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/github"
                        alt="GitHub"
                        className="h-10 w-auto opacity-60 dark:opacity-90 hover:opacity-100 transition-all duration-300 dark:invert dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                      />
                      <img
                        src="https://cdn.simpleicons.org/stripe/008CDD"
                        alt="Stripe"
                        className="h-10 w-auto opacity-60 dark:opacity-80 hover:opacity-100 transition-all duration-300 grayscale dark:grayscale-0 dark:drop-shadow-[0_0_8px_rgba(0,140,221,0.5)]"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="mt-16">
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4 transition-colors duration-300">
                  Big companies aren't scary anymore.
                </p>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto font-light transition-colors duration-300">
                  Our AI agent has cracked the code for interviews at Google, Amazon, Meta, and more. Practice with it, and you'll crack it too.
                </p>
              </motion.div>
            </div>
          </div>
        </SectionWrapper>


        {/* CTA Section */}
        <SectionWrapper className="py-24 relative bg-transparent">
          {/* Subtle glow instead of full gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-blue-500/5 dark:from-emerald-900/5 dark:to-blue-900/5 pointer-events-none transition-colors duration-300" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              variants={fadeInUp}
              className="bg-white/10 dark:bg-white/5 backdrop-blur-lg rounded-3xl p-12 text-center border border-white/20 dark:border-white/10 relative overflow-hidden shadow-2xl dark:shadow-none"
            >
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 dark:bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-emerald-500/20 dark:bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />

              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 transition-colors duration-300">
                Ready to Start Practicing?
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto transition-colors duration-300">
                Join thousands of candidates preparing for their dream jobs with our AI-powered interview coach.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-4 bg-slate-900 dark:bg-gradient-to-r dark:from-blue-500 dark:to-emerald-500 hover:scale-105 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform"
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
        <footer className="bg-transparent text-slate-600 dark:text-slate-500 py-12 border-t border-slate-200 dark:border-white/5 transition-colors duration-300 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-500">
                Mockly
              </span>
            </div>
            <p className="text-sm">
              © 2026 Mockly. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
