import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import {
  Play,
  History,
  TrendingUp,
  Award,
  ChevronRight,
  Zap,
  BookOpen,
  LayoutDashboard,
  Settings,
  LogOut,
  User,
  Activity
} from 'lucide-react';
import { mockDashboardData } from '../../data/mockDashboardData';
import { motion } from 'framer-motion';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 5, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
    whileTap={{ scale: 0.95 }}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors duration-200 group relative overflow-hidden cursor-pointer ${active ? 'text-emerald-400' : 'text-slate-400'
      }`}
  >
    {active && (
      <motion.div
        layoutId="activeTab"
        className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl"
        initial={false}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    )}
    <span className="relative z-10 flex items-center space-x-3">
      <Icon size={20} className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300'} />
      <span className="font-medium">{label}</span>
    </span>
  </motion.button>
);

const Card = ({ children, className = '', delay = 0 }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    transition={{ duration: 0.5, delay }}
    className={`relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [userData, setUserData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth guard (optional)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // navigate('/login');
    }
  }, [navigate]);

  // Fetch user data and sessions
  const fetchUserDataAndSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Profile
      const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const user = await profileResponse.json();
        setUserData(user);
      } else if (profileResponse.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      // Sessions
      const sessionsResponse = await fetch('http://localhost:3000/api/user/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (sessionsResponse.ok) {
        const sessionsList = await sessionsResponse.json();
        setSessions(sessionsList);
      } else if (sessionsResponse.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserDataAndSessions();
  }, [fetchUserDataAndSessions]);

  const stats = useMemo(() => {
    if (!sessions.length) {
      return {
        averageScore: 0,
        totalInterviews: 0,
        recentSessions: [],
        improvements: [],
        totalTime: 0
      };
    }

    const sortedSessions = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentThree = sortedSessions.slice(0, 3);

    const normalizeFeedback = (rawFeedback) => {
      if (!rawFeedback) return null;

      let feedback = rawFeedback;

      // If it's an array, get the first element
      if (Array.isArray(feedback)) {
        if (feedback.length === 0) return null;
        feedback = feedback[0];
      }

      if (typeof feedback === 'object' && Object.keys(feedback).length === 0) return null;

      // If it's a string, try to parse it
      if (typeof feedback === 'string') {
        try {
          feedback = JSON.parse(feedback);
        } catch (e) {
          return null;
        }
      }

      // If feedback.feedback exists and is an object, unwrap it
      if (feedback && typeof feedback === 'object' && feedback.feedback && typeof feedback.feedback === 'object') {
        feedback = feedback.feedback;
      }

      // Verify it has actual feedback data
      const hasScore = feedback?.overall_score !== undefined || feedback?.overallScore !== undefined;
      const hasDimensions = Array.isArray(feedback?.dimension_scores) || Array.isArray(feedback?.dimensions) || Array.isArray(feedback?.metrics);

      if (!hasScore && !hasDimensions) {
        return null;
      }

      return feedback;
    };

    const normalizeDimensionScores = (feedback) => {
      const rawDimensions = Array.isArray(feedback?.dimension_scores)
        ? feedback.dimension_scores.map((dim) => ({
          label: dim?.dimension || dim?.label || dim?.name || 'General',
          score: Number(dim?.score || 0)
        }))
        : Array.isArray(feedback?.metrics)
          ? feedback.metrics.map((metric) => ({
            label: metric?.label || metric?.id || 'General',
            score: Number(metric?.score || 0)
          }))
          : [];

      if (!rawDimensions.length) return [];

      const maxScore = Math.max(...rawDimensions.map((item) => item.score || 0), 0);
      const scale = maxScore <= 5 ? 20 : maxScore <= 10 ? 10 : 1;

      return rawDimensions.map((item) => ({
        label: item.label,
        score: Math.round(item.score * scale)
      }));
    };

    const getScoreFromFeedback = (feedback) => {
      const directScore = feedback?.overall_score ?? feedback?.overallScore ?? feedback?.score;
      if (Number.isFinite(Number(directScore))) {
        return Math.round(Number(directScore));
      }

      const normalizedDimensions = normalizeDimensionScores(feedback);
      if (normalizedDimensions.length) {
        const sum = normalizedDimensions.reduce((total, item) => total + (item.score || 0), 0);
        return Math.round(sum / normalizedDimensions.length);
      }

      return 0;
    };

    const parsedRecent = recentThree.map(s => {
      const feedback = normalizeFeedback(s.feedback);
      // Only process if feedback is valid
      if (!feedback) {
        return { ...s, feedback: null, normalizedDimensions: [], computedScore: null, isPending: true };
      }
      const normalizedDimensions = normalizeDimensionScores(feedback);
      const computedScore = getScoreFromFeedback(feedback);
      return { ...s, feedback, normalizedDimensions, computedScore, isPending: false };
    });

    const averageScore =
      parsedRecent.length > 0
        ? Math.round(parsedRecent.reduce((sum, s) => sum + (s.computedScore || 0), 0) / parsedRecent.length)
        : 0;

    const totalTime = sortedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    // Improvements (from areas_for_improvement)
    const improvements = [];
    parsedRecent.forEach(session => {
      const areas = session.feedback?.areas_for_improvement || [];
      areas.forEach(area => {
        const dimension = area?.dimension || 'general';
        const task = area?.suggestion || dimension;

        const id = `${session.id}-${dimension}-${task}`.replace(/\s+/g, '_');
        if (!improvements.find(i => i.id === id)) {
          improvements.push({
            id,
            category: dimension,
            task,
            priority: 'Medium'
          });
        }
      });
    });

    return {
      averageScore,
      totalInterviews: sessions.length,
      recentSessions: parsedRecent,
      improvements: improvements.slice(0, 5),
      totalTime
    };
  }, [sessions]);

  const displayUserName = userData?.name || userData?.email || 'User';

  const handleStartInterview = () => {
    navigate('/setup');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside className="w-72 fixed h-full border-r border-white/5 bg-slate-900/50 backdrop-blur-xl hidden md:flex flex-col p-6 z-20 shadow-2xl">
        <button
          onClick={() => navigate('/')}
          className="mb-10 flex items-center space-x-3 px-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="font-bold text-slate-900">M</span>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Mockly
          </span>
        </button>

        <nav className="space-y-2 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={History} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem icon={TrendingUp} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <SidebarItem icon={BookOpen} label="Improve" active={activeTab === 'improve'} onClick={() => setActiveTab('improve')} />
        </nav>

        <div className="pt-6 border-t border-slate-800/60 space-y-2">
          <SidebarItem icon={Settings} label="Settings" onClick={() => setActiveTab('settings')} />
          <SidebarItem icon={LogOut} label="Sign Out" onClick={() => navigate('/')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-8 h-screen overflow-y-auto no-scrollbar z-10 relative">
        <motion.div className="max-w-[1600px] mx-auto" variants={containerVariants} initial="hidden" animate="visible">
          {/* Header */}
          <motion.header
            variants={{ hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } }}
            className="flex justify-between items-center mb-10"
          >
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Welcome back,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {displayUserName}
                </span>
              </h1>
              <p className="text-slate-400 text-lg">Your interview prep headquarters</p>
            </div>
          </motion.header>

          <motion.div className="flex flex-col xl:flex-row gap-8" variants={containerVariants}>
            {/* Left column */}
            <motion.div className="flex-1 space-y-8" variants={containerVariants}>
              {/* Stats Row */}
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={containerVariants}>
                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Award size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Average Score</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{stats.averageScore}</p>
                    <span className="text-lg text-emerald-400 font-medium mb-1.5">/100</span>
                  </div>
                </Card>

                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Total Practice Time</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{Math.round(stats.totalTime / 60)}</p>
                    <span className="text-lg text-slate-500 font-medium mb-1.5">mins</span>
                  </div>
                </Card>

                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <History size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Sessions</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{stats.totalInterviews}</p>
                    <span className="text-lg text-slate-500 font-medium mb-1.5">total</span>
                  </div>
                </Card>
              </motion.div>

              {/* Performance Chart */}
              <Card className="h-[400px]">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <TrendingUp size={24} className="mr-3 text-emerald-400" /> Performance History
                  </h2>
                  <select className="bg-slate-950/50 border border-white/10 text-slate-400 text-sm rounded-lg px-3 py-1 outline-none focus:border-emerald-500/50">
                    <option>Last 6 Weeks</option>
                    <option>Last 3 Months</option>
                  </select>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockDashboardData.progressHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          backdropFilter: 'blur(10px)',
                          borderColor: 'rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Recent Sessions */}
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <History size={24} className="mr-3 text-purple-400" /> Recent Sessions
                  </h2>
                  <button className="text-sm text-slate-400 hover:text-white transition-colors">View all history</button>
                </div>

                <div className="space-y-4">
                  {stats.recentSessions.length > 0 ? (
                    stats.recentSessions.map(session => {
                      const feedback = session.feedback || {};
                      const feedbackScore = session.computedScore || feedback?.overall_score || 0;
                      const sessionType = feedback?.interview_type || 'Interview';
                      const sessionTopic = feedback?.position_title || 'Interview';
                      const assessment = feedback?.overall_assessment?.summary || 'Interview session completed.';

                      return (
                        <div
                          key={session.id}
                          onClick={() => navigate(`/results/${session.id}`)}
                          className="p-4 rounded-2xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 hover:border-emerald-500/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800/50 text-slate-300">
                                {sessionType === 'Technical' ? <Zap size={18} /> : sessionType === 'Behavioral' ? <User size={18} /> : <LayoutDashboard size={18} />}
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{sessionTopic}</h4>
                                <p className="text-xs text-slate-500">
                                  {sessionType} • {new Date(session.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${feedbackScore >= 80
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : feedbackScore >= 60
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}
                              >
                                {feedbackScore} Score
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-slate-400 pl-14 pr-4 line-clamp-2 leading-relaxed">{assessment}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No sessions yet. Start your first interview!</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Right column */}
            <motion.div className="w-full xl:w-[400px] space-y-8" variants={containerVariants}>
              {/* Start Interview CTA */}
              <motion.button
                variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
                transition={{ duration: 0.5 }}
                onClick={handleStartInterview}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full relative overflow-hidden rounded-2xl p-1 group shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] mb-2 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-gradient-xy" />
                <div className="relative bg-slate-900/90 rounded-xl p-6 flex items-center justify-between border border-white/10 backdrop-blur-xl group-hover:bg-slate-900/80 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform">
                      <Play size={24} className="text-white fill-current ml-1" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-white">Start New Interview</h3>
                      <p className="text-xs text-emerald-200">Mock up a fresh session</p>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-slate-400 group-hover:text-white transition-colors group-hover:translate-x-1" />
                </div>
              </motion.button>

              {/* Latest Performance Radar Chart */}
              {stats.recentSessions.length > 0 && stats.recentSessions[0]?.normalizedDimensions?.length > 0 ? (
                <Card className="h-[420px]">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-bold text-white flex items-center">
                      <Award size={24} className="mr-3 text-cyan-400" /> Latest Performance
                    </h2>
                  </div>
                  <div className="h-[330px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={stats.recentSessions[0].normalizedDimensions}>
                        <PolarGrid stroke="#334155" opacity={0.4} />
                        <PolarAngleAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                        <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(30, 41, 59, 0.9)',
                            backdropFilter: 'blur(10px)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            color: '#fff'
                          }}
                          itemStyle={{ color: '#06b6d4' }}
                          formatter={(value) => `${value.toFixed(0)}%`}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ) : (
                <Card>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Award size={24} className="mr-3 text-cyan-400" /> Latest Performance
                  </h2>
                  <div className="text-sm text-slate-400">No dimension scores yet for the latest session.</div>
                </Card>
              )}

              {/* Focus Areas */}
              <Card>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <BookOpen size={24} className="mr-3 text-orange-400" /> Focus Areas
                </h2>

                <div className="space-y-3">
                  {stats.improvements && stats.improvements.length > 0 ? (
                    stats.improvements.map(item => (
                      <div
                        key={item.id}
                        className="flex items-start p-4 rounded-xl border border-white/5 bg-slate-800/10 hover:bg-slate-800/30 transition-colors group"
                      >
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <span className="w-2 h-2 rounded-full mr-2 bg-yellow-400" />
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{item.category}</span>
                          </div>
                          <p className="text-sm text-slate-200 font-medium group-hover:text-white transition-colors">{item.task}</p>
                        </div>
                        <button className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors -mr-2">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No improvement areas yet. Keep practicing!</p>
                    </div>
                  )}

                  <button className="w-full mt-2 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800/50 hover:text-white hover:border-slate-500 transition-all flex items-center justify-center">
                    + Add Custom Goal
                  </button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
