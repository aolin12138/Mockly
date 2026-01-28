import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

const Profile = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-4xl font-bold text-blue-600">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{user.name || 'User'}</h1>
              <p className="text-slate-600">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Profile Sections */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Interview Stats */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Interview Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Interviews</span>
                <span className="text-2xl font-bold text-blue-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Behavioral</span>
                <span className="text-2xl font-bold text-purple-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Technical</span>
                <span className="text-2xl font-bold text-green-600">0</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Activity</h2>
            <div className="text-center py-8">
              <p className="text-slate-500">No recent activity</p>
              <p className="text-sm text-slate-400 mt-2">Start your first interview to see your progress</p>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Account Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                value={user.name || ''}
                disabled
                className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
