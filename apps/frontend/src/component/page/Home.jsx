import React from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import ParticleText from '../ParticleText';

const Home = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen flex items-center">
        {/* Particle Background */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <ParticleText />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 pointer-events-none">
          <div className="text-center max-w-4xl mx-auto pointer-events-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Ace Your Next
              <span className="text-blue-400"> Interview</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-300 mb-10 leading-relaxed">
              Practice behavioral and technical interviews with AI-powered feedback.
              Get ready for your dream job at top companies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition duration-200"
              >
                Get Started Free
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white text-lg font-semibold rounded-lg border-2 border-white/30 hover:border-white/50 transition duration-200"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

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
  );
};

export default Home;
