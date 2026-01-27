import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <header className="bg-white border-b border-slate-200 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
        <div className="flex justify-between items-center h-16 pointer-events-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">Mockly</h1>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            {token ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-slate-600 hover:text-slate-900 font-medium transition"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="text-slate-600 hover:text-slate-900 font-medium transition"
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-slate-600 hover:text-slate-900 font-medium transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
