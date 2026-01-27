import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import ParticleText from '../ParticleText';

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

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

  // Calculate opacity for hero text (fade out)
  const textOpacity = 1 - scrollProgress * 1.5; // Fade faster
  const textTransform = `translateY(${scrollProgress * -50}px)`; // Move up slightly

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Fixed Hero Section */}
      <div className="fixed inset-0 z-0" style={{ height: '80vh' }}>
        <Header />
        <section className="relative overflow-hidden h-full flex items-center" style={{
          background: 'radial-gradient(ellipse at center, #1a0b2e 0%, #0a0515 50%, #000000 100%)'
        }}>
          {/* Animated stars background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(2px 2px at 20px 30px, white, transparent),
                radial-gradient(2px 2px at 60px 70px, white, transparent),
                radial-gradient(1px 1px at 50px 50px, white, transparent),
                radial-gradient(1px 1px at 130px 80px, white, transparent),
                radial-gradient(2px 2px at 90px 10px, white, transparent),
                radial-gradient(1px 1px at 150px 120px, white, transparent),
                radial-gradient(2px 2px at 180px 40px, white, transparent),
                radial-gradient(1px 1px at 30px 150px, white, transparent),
                radial-gradient(1px 1px at 100px 180px, white, transparent),
                radial-gradient(2px 2px at 170px 150px, white, transparent)
              `,
              backgroundSize: '200px 200px',
              opacity: 0.6
            }}></div>
          </div>
          
          {/* Purple nebula glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[100px]"></div>
          
          {/* Particle Background - receives scroll progress */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <ParticleText scrollProgress={scrollProgress} />
          </div>
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pointer-events-none">
            <div 
              className="text-center max-w-4xl mx-auto pointer-events-auto transition-all duration-300"
              style={{ 
                opacity: textOpacity,
                transform: textTransform
              }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                Practice Interviews,
                <br />
                <span className="text-blue-400">Real Results</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed">
                Master simulated interviews just like the real thing and land your dream job
              </p>
              <div className="flex justify-center">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition duration-200"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Scrolling Content - positioned to scroll over fixed hero */}
      <div className="relative z-10" style={{ marginTop: '80vh' }}>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Why Choose Mockly?
            </h2>
            <p className="text-xl text-slate-600">
              Everything you need to prepare for interviews
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Behavioral Practice
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Master STAR method responses with AI-guided practice sessions tailored to your target company.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Technical Interviews
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Practice coding challenges and system design with real-time feedback on your solutions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Track Progress
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Monitor your improvement over time with detailed analytics and personalized recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Research & Preparation Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white mb-6">
              We've Done the Research for You
            </h2>
            <p className="text-xl text-slate-300 mb-6 leading-relaxed">
              Interview preparation requires extensive research and practice. We've analyzed thousands of interviews from top companies to create the most realistic simulation.
            </p>
            
            {/* Scrolling company logos */}
            <div className="relative overflow-hidden py-12 mb-8">
              <div className="flex animate-scroll-seamless">
                {/* Repeat 4 times for seamless loop */}
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex space-x-16 items-center shrink-0 pr-16">
                    <img src="https://cdn.simpleicons.org/apple/white" alt="Apple" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/google" alt="Google" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/meta" alt="Meta" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/nvidia" alt="NVIDIA" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/tesla/white" alt="Tesla" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/netflix" alt="Netflix" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/spotify" alt="Spotify" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/uber/white" alt="Uber" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                    <img src="https://cdn.simpleicons.org/airbnb" alt="Airbnb" className="h-12 w-12 object-contain shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
            
            <p className="text-2xl font-semibold text-blue-400 mb-4">
              Big companies aren't scary anymore.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              Our AI agent has cracked the code for interviews at Google, Amazon, Meta, and more. Practice with it, and you'll crack it too.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Practicing?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join thousands of candidates preparing for their dream jobs
          </p>
          <Link
            to="/register"
            className="inline-block px-8 py-4 bg-white hover:bg-slate-50 text-blue-600 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition duration-200"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
