import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  LineChart,
  Line
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
import { motion, AnimatePresence } from 'framer-motion';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 5, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
    whileTap={{ scale: 0.95 }}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors duration-200 group relative overflow-hidden cursor-pointer ${active
      ? 'text-emerald-400'
      : 'text-slate-400'
      }`}
  >
    {active && (
      <motion.div
        layoutId="activeTab"
        className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl"
        initial={false}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    )}
    <span className="relative z-10 flex items-center space-x-3">
      <Icon size={20} className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300'} />
      <span className="font-medium">{label}</span>
    </span>
  </motion.button>
);

const Card = ({ children, className = "", delay = 0 }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    transition={{ duration: 0.5, delay }}
    className={`relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
    {children}
  </motion.div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // navigate('/login'); 
    }
  }, [navigate]);

  const handleStartInterview = () => {
    navigate('/setup');
  };

  const lastSession = mockDashboardData.recentActivity[0];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
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
          <SidebarItem icon={Settings} label="Settings" />
          <SidebarItem icon={LogOut} label="Sign Out" onClick={() => navigate('/')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-8 h-screen overflow-y-auto no-scrollbar z-10 relative">
        <motion.div
          className="max-w-[1600px] mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >

          {/* Header */}
          <motion.header
            variants={{ hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } }}
            className="flex justify-between items-center mb-10"
          >
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{mockDashboardData.user.name}</span>
              </h1>
              <p className="text-slate-400 text-lg">Your interview prep headquarters</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="bg-slate-800/40 p-2 rounded-xl backdrop-blur-md border border-white/5 hidden sm:flex items-center space-x-4 pr-6">
                <img src={mockDashboardData.user.avatar} alt="Profile" className="w-12 h-12 rounded-lg" />
                <div className="text-left">
                  <p className="text-sm font-bold text-white">{mockDashboardData.user.title}</p>
                  <p className="text-xs text-emerald-400 font-medium">{mockDashboardData.user.level}</p>
                </div>
              </div>
            </div>
          </motion.header>

          <motion.div className="flex flex-col xl:flex-row gap-8" variants={containerVariants}>
            {/* Left Content Column */}
            <motion.div className="flex-1 space-y-8" variants={containerVariants}>

              {/* Stats Row */}
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={containerVariants}>
                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Award size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Average Score</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{mockDashboardData.overview.averageScore}</p>
                    <span className="text-lg text-emerald-400 font-medium mb-1.5">+2.4%</span>
                  </div>
                </Card>

                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Current Streak</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{mockDashboardData.overview.streakDays}</p>
                    <span className="text-lg text-slate-500 font-medium mb-1.5">days</span>
                  </div>
                </Card>

                <Card className="group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <History size={100} />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Sessions</h3>
                  <div className="flex items-end space-x-3">
                    <p className="text-5xl font-bold text-white">{mockDashboardData.overview.totalInterviews}</p>
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
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(10px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#34d399' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Recent History Extended */}
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <History size={24} className="mr-3 text-purple-400" /> Recent Sessions
                  </h2>
                  <button className="text-sm text-slate-400 hover:text-white transition-colors">View all history</button>
                </div>
                <div className="space-y-4">
                  {mockDashboardData.recentActivity.map((session) => (
                    <div key={session.id} className="p-4 rounded-2xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 hover:border-white/10 transition-all cursor-pointer group">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${session.type === 'Technical' ? 'bg-blue-500/10 text-blue-400' :
                            session.type === 'Behavioral' ? 'bg-purple-500/10 text-purple-400' :
                              'bg-orange-500/10 text-orange-400'
                            }`}>
                            {session.type === 'Technical' ? <Zap size={18} /> :
                              session.type === 'Behavioral' ? <User size={18} /> : <LayoutDashboard size={18} />}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{session.topic}</h4>
                            <p className="text-xs text-slate-500">{session.type} • {session.duration}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${session.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            session.score >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {session.score}% Score
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 pl-14 pr-4 line-clamp-2 leading-relaxed">
                        {session.summary || "No summary available for this session."}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Right Panel (Desktop) */}
            <motion.div className="w-full xl:w-[400px] space-y-8" variants={containerVariants}>

              {/* Start Interview CTA - Distant from Module Look */}
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

              {/* Last Session Summary - New Module */}
              {lastSession && (
                <Card className="border-emerald-500/20 bg-emerald-900/5">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Activity size={20} />
                    </div>
                    <h3 className="font-bold text-white">Last Session Insight</h3>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Topic</span>
                      <span className="text-slate-200 font-medium">{lastSession.topic}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Score</span>
                      <span className={`font-bold ${lastSession.score >= 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{lastSession.score}%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-800/30 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      "{lastSession.feedback || lastSession.summary}"
                    </p>
                  </div>
                  <button className="w-full mt-4 text-xs font-bold text-emerald-400 text-center hover:text-emerald-300 transition-colors uppercase tracking-wide">
                    View Full Report
                  </button>
                </Card>
              )}

              {/* Skill Radar */}
              <Card>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Award size={24} className="mr-3 text-cyan-400" /> Skill Breakdown
                </h2>
                <div className="h-[300px] w-full relative -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mockDashboardData.performance}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                      <Radar
                        name="Skills"
                        dataKey="A"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="#06b6d4"
                        fillOpacity={0.4}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(10px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#06b6d4' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Focus Areas */}
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <BookOpen size={24} className="mr-3 text-orange-400" /> Focus Areas
                  </h2>
                </div>

                <div className="space-y-3">
                  {mockDashboardData.improvements.map((item) => (
                    <div key={item.id} className="flex items-start p-4 rounded-xl border border-white/5 bg-slate-800/10 hover:bg-slate-800/30 transition-colors group">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className={`w-2 h-2 rounded-full mr-2 ${item.priority === 'High' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]' :
                            item.priority === 'Medium' ? 'bg-yellow-400' : 'bg-blue-400'
                            }`} />
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{item.category}</span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium group-hover:text-white transition-colors">{item.task}</p>
                      </div>
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors -mr-2">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  ))}

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
