import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
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
  Activity,
  Code2,
  Clock,
  Key,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/Toast';

const MotionButton = motion.button;
const MotionDiv = motion.div;

const Spinner = ({ size = 16, className = '' }) => (
  <motion.span
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    className={`inline-flex ${className}`}
  >
    <RefreshCw size={size} />
  </motion.span>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }) => {
  const IconComponent = Icon;
  return (
    <MotionButton
      onClick={onClick}
      whileHover={{ x: 5, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
      whileTap={{ scale: 0.95 }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors duration-200 group relative overflow-hidden cursor-pointer ${active ? 'text-emerald-400' : 'text-slate-400'
        }`}
    >
      {active && (
        <MotionDiv
          layoutId="activeTab"
          className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center space-x-3">
        <IconComponent size={20} className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300'} />
        <span className="font-medium">{label}</span>
      </span>
    </MotionButton>
  );
};

const Card = ({ children, className = '', delay = 0 }) => (
  <MotionDiv
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    transition={{ duration: 0.5, delay }}
    className={`relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden ${className}`}
  >
    {children}
  </MotionDiv>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [userData, setUserData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [historyWindow, setHistoryWindow] = useState('6');
  const [historyType, setHistoryType] = useState('all');

  // BYOK state
  const [elevenLabsStatus, setElevenLabsStatus] = useState(null); // null = loading, object = loaded
  const [byokLoading, setByokLoading] = useState(true);
  const [connectKey, setConnectKey] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [showReplaceInput, setShowReplaceInput] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch user data and sessions
  const fetchUserDataAndSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      console.log('Fetching user profile...');
      // Profile
      const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Profile response status:', profileResponse.status);

      if (profileResponse.ok) {
        const user = await profileResponse.json();
        console.log('User data fetched:', user);
        setUserData(user);
      } else if (profileResponse.status === 401) {
        // Token expired or invalid
        console.log('Token expired or invalid, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      } else {
        console.error('Failed to fetch profile:', profileResponse.status);
      }

      console.log('Fetching user sessions...');
      // Sessions
      const sessionsResponse = await fetch('http://localhost:3000/api/user/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Sessions response status:', sessionsResponse.status);

      if (sessionsResponse.ok) {
        const sessionsList = await sessionsResponse.json();
        console.log('Sessions fetched:', sessionsList.length, 'sessions');
        setSessions(sessionsList);
      } else if (sessionsResponse.status === 401) {
        // Token expired or invalid
        console.log('Token expired or invalid, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      } else {
        console.error('Failed to fetch sessions:', sessionsResponse.status);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // If there's a network error or the server is down
      if (error.message?.includes('Failed to fetch')) {
        console.error('Network error - check if backend is running');
      }
    }
  }, [navigate]);

  // Fetch ElevenLabs integration status
  const fetchElevenLabsStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      setByokLoading(true);
      const response = await fetch('http://localhost:3000/api/integrations/elevenlabs/status', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setElevenLabsStatus(data);
      }
    } catch (error) {
      console.error('Error fetching ElevenLabs status:', error);
      setElevenLabsStatus({ connected: false });
    } finally {
      setByokLoading(false);
    }
  }, []);

  // Connect ElevenLabs API key
  const handleConnectKey = async () => {
    if (!connectKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    setConnectLoading(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/integrations/elevenlabs/connect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: connectKey.trim() })
      });
      const data = await response.json();
      if (data.ok) {
        toast.success('API key verified and connected!', { title: 'Connected' });
        setConnectKey('');
        setShowReplaceInput(false);
        setShowKeyInput(false);
        setConnectSuccess('');
        setConnectError('');
        await fetchElevenLabsStatus();
      } else {
        toast.error(data.message || 'Failed to verify API key');
        setConnectError(data.message || 'Failed to verify API key');
      }
    } catch (error) {
      toast.error('Network error — please try again');
      setConnectError('Network error — please try again');
    } finally {
      setConnectLoading(false);
    }
  };

  // Disconnect ElevenLabs API key
  const handleDisconnect = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/integrations/elevenlabs', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setElevenLabsStatus({ connected: false });
      setConnectSuccess('');
      setConnectError('');
      setShowReplaceInput(false);
      toast.success('API key disconnected', { title: 'Disconnected' });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect — please try again');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUserDataAndSessions();
      fetchElevenLabsStatus();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchUserDataAndSessions, fetchElevenLabsStatus]);

  const stats = useMemo(() => {
    if (!sessions.length) {
      return {
        averageScore: 0,
        totalInterviews: 0,
        recentSessions: [],
        improvements: [],
        totalTime: 0,
        progressHistory: []
      };
    }

    const sortedSessions = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentThree = sortedSessions.slice(0, 3);

    // Detect if feedback is technical or behavioural based on structure
    const isTechnicalFeedback = (feedback) => {
      if (!feedback) return false;
      // Technical feedback has: outcome, dimensions (array with label/key), codeAssessment, actionPlan
      // Behavioural feedback has: overall_score, dimension_scores, areas_for_improvement
      return (
        feedback.outcome !== undefined ||
        feedback.codeAssessment !== undefined ||
        feedback.actionPlan !== undefined ||
        (Array.isArray(feedback.dimensions) && feedback.dimensions.some(d => d.label || d.key))
      );
    };

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
        } catch {
          return null;
        }
      }

      // If feedback.feedback exists and is an object, unwrap it (for technical feedback from n8n)
      if (feedback && typeof feedback === 'object' && feedback.feedback && typeof feedback.feedback === 'object') {
        feedback = feedback.feedback;
      }

      return feedback;
    };

    // Normalize dimension scores for BEHAVIOURAL feedback
    // Normalize dimension scores for BEHAVIOURAL feedback
    // Behavioural scores can be 0-5, 0-10, or 0-100, we normalize to 0-5 for radar chart
    const normalizeBehaviouralDimensionScores = (feedback) => {
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

      // Detect the scale and normalize to 0-5 for display, keep original for calculations
      const maxScore = Math.max(...rawDimensions.map((item) => item.score || 0), 0);
      let originalScale = 100; // Default assumption
      if (maxScore <= 5) originalScale = 5;
      else if (maxScore <= 10) originalScale = 10;

      return rawDimensions.map((item) => {
        const normalizedTo100 = (item.score / originalScale) * 100;
        return {
          label: item.label,
          score: Math.round((normalizedTo100 / 100) * 5 * 10) / 10, // Scale to 0-5 with one decimal
          originalScore: Math.round(normalizedTo100) // Store as 0-100 for calculations
        };
      });
    };

    // Normalize dimension scores for TECHNICAL feedback
    // Technical scores could be 0-10 or 0-100, we normalize to 0-100 for calculations
    // and provide a 0-5 scale version for radar chart display
    const normalizeTechnicalDimensionScores = (feedback) => {
      // Technical feedback has dimensions array with: { key, label, score, ... }
      const rawDimensions = Array.isArray(feedback?.dimensions)
        ? feedback.dimensions.map((dim) => ({
          label: dim?.label || dim?.key || dim?.name || 'General',
          score: Number(dim?.score || 0)
        }))
        : [];

      if (!rawDimensions.length) return [];

      // Detect scale: if max score <= 10, assume 0-10 scale and multiply by 10
      const maxScore = Math.max(...rawDimensions.map((item) => item.score || 0), 0);
      const isScaleTen = maxScore <= 10;

      return rawDimensions.map((item) => {
        // Normalize to 0-100
        const normalizedTo100 = isScaleTen ? item.score * 10 : item.score;
        return {
          label: item.label,
          score: Math.round((normalizedTo100 / 100) * 5 * 10) / 10, // Scale to 0-5 with one decimal
          originalScore: Math.round(normalizedTo100) // Keep as 0-100 for calculations
        };
      });
    };

    const getScoreFromFeedback = (feedback, isTechnical) => {
      if (isTechnical) {
        // Technical feedback: check outcome.score, overall.score, or average dimensions
        // Scores could be 0-10 or 0-100, normalize to 0-100
        const outcomeScore = feedback?.outcome?.score;
        const overallScore = feedback?.overall?.score;
        if (Number.isFinite(Number(outcomeScore))) {
          const score = Number(outcomeScore);
          // If score is <= 10, assume it's on 0-10 scale and multiply by 10
          if (score <= 10) return Math.round(score * 10);
          return Math.round(score);
        }
        if (Number.isFinite(Number(overallScore))) {
          const score = Number(overallScore);
          // If score is <= 10, assume it's on 0-10 scale and multiply by 10
          if (score <= 10) return Math.round(score * 10);
          return Math.round(score);
        }
        // Fall back to average of dimensions (use originalScore which is 0-100)
        const normalizedDimensions = normalizeTechnicalDimensionScores(feedback);
        if (normalizedDimensions.length) {
          const sum = normalizedDimensions.reduce((total, item) => total + (item.originalScore || 0), 0);
          return Math.round(sum / normalizedDimensions.length);
        }
        return 0;
      } else {
        // Behavioural feedback
        const directScore = feedback?.overall_score ?? feedback?.overallScore ?? feedback?.score;
        if (Number.isFinite(Number(directScore))) {
          // Normalize to 0-100 if needed
          const score = Number(directScore);
          if (score <= 5) return Math.round(score * 20);
          if (score <= 10) return Math.round(score * 10);
          return Math.round(score);
        }

        const normalizedDimensions = normalizeBehaviouralDimensionScores(feedback);
        if (normalizedDimensions.length) {
          const sum = normalizedDimensions.reduce((total, item) => total + (item.originalScore || 0), 0);
          return Math.round(sum / normalizedDimensions.length);
        }

        return 0;
      }
    };

    const parseSession = (s) => {
      const feedback = normalizeFeedback(s.feedback);
      const isTechnical = s.interviewType === 'Technical' || (feedback && isTechnicalFeedback(feedback));
      const sessionStatus = (s.status || (feedback ? 'completed' : 'pending')).toLowerCase();
      const isPending = sessionStatus === 'pending';
      const isCancelled = sessionStatus === 'cancelled';
      const isIncomplete = sessionStatus === 'incomplete';

      if (!feedback) {
        return {
          ...s,
          feedback: null,
          normalizedDimensions: [],
          computedScore: null,
          isPending,
          isCancelled,
          isIncomplete,
          sessionStatus,
          isTechnical
        };
      }

      const normalizedDimensions = isTechnical
        ? normalizeTechnicalDimensionScores(feedback)
        : normalizeBehaviouralDimensionScores(feedback);
      const computedScore = getScoreFromFeedback(feedback, isTechnical);

      return { ...s, feedback, normalizedDimensions, computedScore, isPending, isCancelled, isIncomplete, sessionStatus, isTechnical };
    };

    const parsedRecent = recentThree.map(parseSession);

    // Calculate average only from sessions with valid scores
    const sessionsWithScores = parsedRecent.filter(s => s.computedScore !== null && s.computedScore > 0);
    const averageScore =
      sessionsWithScores.length > 0
        ? Math.round(sessionsWithScores.reduce((sum, s) => sum + (s.computedScore || 0), 0) / sessionsWithScores.length)
        : 0;

    const totalTime = sortedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const progressHistoryAll = sortedSessions
      .map(parseSession)
      .filter((s) => Number.isFinite(s.computedScore))
      .map((s) => ({
        name: new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: s.computedScore,
        interviewType: s.interviewType
      }))
      .reverse();

    // Improvements - handle both behavioural and technical
    const improvements = [];
    parsedRecent.forEach(session => {
      if (session.isTechnical) {
        // Technical feedback: use actionPlan
        const actionPlan = session.feedback?.actionPlan || [];
        actionPlan.forEach((item, idx) => {
          const title = item?.title || item?.suggestion || 'Improvement area';
          const category = item?.category || 'Technical';
          const id = `${session.id}-tech-${idx}`.replace(/\s+/g, '_');
          if (!improvements.find(i => i.id === id)) {
            improvements.push({
              id,
              category,
              task: title,
              priority: item?.priority === 1 ? 'High' : item?.priority === 2 ? 'Medium' : 'Low'
            });
          }
        });
      } else {
        // Behavioural feedback: use areas_for_improvement
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
      }
    });

    return {
      averageScore,
      totalInterviews: sessions.length,
      recentSessions: parsedRecent,
      improvements: improvements.slice(0, 5),
      totalTime,
      progressHistory: progressHistoryAll
    };
  }, [sessions]);

  const historyWindowSize = historyWindow === '12' ? 12 : 6;
  const filteredHistory = historyType === 'all'
    ? stats.progressHistory
    : stats.progressHistory.filter((item) =>
      historyType === 'technical'
        ? item.interviewType === 'Technical'
        : item.interviewType === 'Behavioural'
    );
  const historyDataRaw = filteredHistory.slice(-historyWindowSize);
  const paddingCount = Math.max(0, historyWindowSize - historyDataRaw.length);
  const historyData = historyDataRaw.concat(
    Array.from({ length: paddingCount }, () => ({ name: '', score: null }))
  );
  const averageHistoryScore = historyDataRaw.length
    ? Math.round(historyDataRaw.reduce((sum, item) => sum + (item.score || 0), 0) / historyDataRaw.length)
    : null;

  const displayUserName = userData?.name || userData?.email || 'User';


  const handleSignOut = () => {
    // Clear authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Navigate to home/login
    navigate('/');
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
          <SidebarItem icon={History} label="History" active={activeTab === 'history'} onClick={() => navigate('/history')} />
          <SidebarItem icon={TrendingUp} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <SidebarItem icon={BookOpen} label="Improve" active={activeTab === 'improve'} onClick={() => setActiveTab('improve')} />
        </nav>

        <div className="pt-6 border-t border-slate-800/60 space-y-2">
          <SidebarItem icon={Key} label="API Key" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <SidebarItem icon={LogOut} label="Sign Out" onClick={handleSignOut} />
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

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" className="flex flex-col xl:flex-row gap-8" variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                {/* Left column */}
                <motion.div className="flex-1 space-y-8" variants={containerVariants}>
                  {/* Stats Row */}
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" variants={containerVariants}>
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
                        {stats.totalTime >= 3600 ? (
                          <>
                            <p className="text-5xl font-bold text-white">{Math.floor(stats.totalTime / 3600)}</p>
                            <span className="text-lg text-slate-500 font-medium mb-1.5">hr {Math.floor((stats.totalTime % 3600) / 60)}m</span>
                          </>
                        ) : (
                          <>
                            <p className="text-5xl font-bold text-white">{Math.floor(stats.totalTime / 60)}</p>
                            <span className="text-lg text-slate-500 font-medium mb-1.5">mins</span>
                          </>
                        )}
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

                    {/* BYOK Status Card */}
                    <Card className="group cursor-pointer" onClick={() => setActiveTab('settings')}>
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Key size={100} />
                      </div>
                      {byokLoading ? (
                        <>
                          <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">ElevenLabs</h3>
                          <div className="flex items-center space-x-2">
                            <Spinner size={16} className="text-slate-500" />
                            <span className="text-slate-500">Loading...</span>
                          </div>
                        </>
                      ) : elevenLabsStatus?.connected ? (
                        <>
                          <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider flex items-center gap-2">
                            ElevenLabs
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </h3>
                          <div className="flex items-end space-x-2 mb-3">
                            <span className="text-sm font-semibold text-emerald-400 uppercase px-2 py-0.5 rounded-md bg-emerald-500/10">
                              {elevenLabsStatus.tier || 'Connected'}
                            </span>
                          </div>
                          {elevenLabsStatus.minutesLimit > 0 && (
                            <div>
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>{elevenLabsStatus.minutesUsed ?? 0} min used</span>
                                <span>{elevenLabsStatus.minutesLimit} min limit</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) > 0.9
                                    ? 'bg-red-500'
                                    : ((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) > 0.7
                                      ? 'bg-yellow-500'
                                      : 'bg-emerald-500'
                                    }`}
                                  style={{ width: `${Math.min(100, ((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) * 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                ~{elevenLabsStatus.estimatedSessions ?? 0} sessions remaining
                              </p>
                            </div>
                          )}
                          {elevenLabsStatus.error && (
                            <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                              <AlertTriangle size={12} /> {elevenLabsStatus.error}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider flex items-center gap-2">
                            ElevenLabs
                            <span className="w-2 h-2 rounded-full bg-yellow-400" />
                          </h3>
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertTriangle size={18} className="text-yellow-400" />
                            <span className="text-yellow-400 font-semibold text-sm">Not Verified</span>
                          </div>
                          <p className="text-xs text-slate-500">Connect your API key to start interviews</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveTab('settings'); }}
                            className="mt-3 w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:from-emerald-500/30 hover:to-cyan-500/30 transition-all cursor-pointer"
                          >
                            Get Verified →
                          </button>
                        </>
                      )}
                    </Card>
                  </motion.div>

                  {/* Performance Chart */}
                  <Card className="h-[400px]">
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-xl font-bold text-white flex items-center">
                        <TrendingUp size={24} className="mr-3 text-emerald-400" /> Performance History
                      </h2>
                      <div className="flex items-center gap-2">
                        <select
                          value={historyType}
                          onChange={(event) => setHistoryType(event.target.value)}
                          className="bg-slate-950/50 border border-white/10 text-slate-400 text-sm rounded-lg px-3 py-1 outline-none focus:border-emerald-500/50"
                        >
                          <option value="all">All Types</option>
                          <option value="behavioural">Behavioural</option>
                          <option value="technical">Technical</option>
                        </select>
                        <select
                          value={historyWindow}
                          onChange={(event) => setHistoryWindow(event.target.value)}
                          className="bg-slate-950/50 border border-white/10 text-slate-400 text-sm rounded-lg px-3 py-1 outline-none focus:border-emerald-500/50"
                        >
                          <option value="6">Last 6 Sessions</option>
                          <option value="12">Last 12 Sessions</option>
                        </select>
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={historyData} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                            padding={{ left: 0, right: 0 }}
                          />
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
                          {Number.isFinite(averageHistoryScore) && (
                            <ReferenceLine
                              y={averageHistoryScore}
                              stroke="#94a3b8"
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Avg ${averageHistoryScore}`, position: 'left', fill: '#cbd5e1', fontSize: 11 }}
                            />
                          )}
                          <Bar dataKey="score" barSize={28} fill="rgba(16,185,129,0.35)" stroke="#10b981" strokeWidth={1} />
                          <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Recent Sessions */}
                  <Card>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-white flex items-center">
                        <History size={24} className="mr-3 text-purple-400" /> Recent Sessions
                      </h2>
                      <button onClick={() => navigate('/history')} className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">View all history</button>
                    </div>

                    <div className="space-y-4">
                      {stats.recentSessions.length > 0 ? (
                        stats.recentSessions.map(session => {
                          const feedback = session.feedback || {};
                          const feedbackScore = session.computedScore || 0;
                          const isTechnical = session.isTechnical;

                          // Determine session type and display info based on feedback structure
                          let sessionType, sessionTopic, assessment;

                          if (isTechnical) {
                            // Technical interview feedback
                            sessionType = 'Technical';
                            sessionTopic = feedback?.meta?.questionTitle || feedback?.outcome?.verdict || 'Technical Interview';
                            assessment = session.sessionStatus === 'incomplete'
                              ? 'Session ended too early to generate a complete assessment.'
                              : session.sessionStatus === 'pending'
                                ? 'Feedback is still being prepared.'
                                : feedback?.overall?.summary || feedback?.outcome?.summary || 'Technical interview session completed.';
                          } else {
                            // Behavioural interview feedback
                            sessionType = feedback?.interview_type || 'Behavioral';
                            sessionTopic = feedback?.position_title || 'Interview';
                            assessment = session.sessionStatus === 'incomplete'
                              ? 'Session ended too early to generate a complete assessment.'
                              : session.sessionStatus === 'pending'
                                ? 'Feedback is still being prepared.'
                                : feedback?.overall_assessment?.summary || 'Interview session completed.';
                          }

                          // Navigate to correct results page based on type
                          const handleSessionClick = () => {
                            if (isTechnical) {
                              navigate(`/results/technical/${session.id}`);
                            } else {
                              navigate(`/results/${session.id}`);
                            }
                          };

                          return (
                            <div
                              key={session.id}
                              onClick={handleSessionClick}
                              className="p-5 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 hover:bg-slate-800/50 hover:border-emerald-500/30 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isTechnical ? 'bg-cyan-500/15 text-cyan-400 shadow-cyan-500/10' : 'bg-purple-500/15 text-purple-400 shadow-purple-500/10'}`}>
                                    {isTechnical ? <Code2 size={18} /> : <User size={18} />}
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{sessionTopic}</h4>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${isTechnical ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                        {sessionType}
                                      </span>
                                      <span className="text-xs text-slate-600 flex items-center gap-1">
                                        <Clock size={11} />
                                        {new Date(session.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </span>
                                      {session.duration > 0 && (
                                        <span className="text-xs text-slate-600">
                                          {Math.floor(session.duration / 60)}m {session.duration % 60}s
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {session.sessionStatus === 'incomplete' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      Incomplete
                                    </span>
                                  ) : session.isCancelled ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      Cancelled
                                    </span>
                                  ) : session.isPending ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                      Pending
                                    </span>
                                  ) : (
                                    <div className="inline-flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        Completed
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${feedbackScore >= 80
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                          : feedbackScore >= 60
                                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                          }`}
                                      >
                                        <Award size={12} />
                                        {feedbackScore}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <p className="text-sm text-slate-500 pl-14 pr-4 line-clamp-2 leading-relaxed group-hover:text-slate-400 transition-colors">{assessment}</p>
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
                    onClick={() => navigate('/setup')}
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
                        <span className="text-xs text-slate-400">Scale: 0-5</span>
                      </div>
                      <div className="h-[330px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={330}>
                          <RadarChart data={stats.recentSessions[0].normalizedDimensions}>
                            <PolarGrid stroke="#334155" opacity={0.4} />
                            <PolarAngleAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                            <PolarRadiusAxis domain={[0, 5]} tickCount={6} stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} domain={[0, 5]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                backdropFilter: 'blur(10px)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: '#fff'
                              }}
                              itemStyle={{ color: '#06b6d4' }}
                              formatter={(value, name, props) => {
                                const originalScore = props.payload?.originalScore;
                                if (originalScore !== undefined) {
                                  return [`${value.toFixed(1)} / 5 (${originalScore}/100)`, name];
                                }
                                return [`${value.toFixed(0)}%`, name];
                              }}
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
            )}

            {/* Settings Panel - shown when settings tab is active */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut', staggerChildren: 0.08 } }
                }}
                className="mt-8"
              >
                <Card>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                      <Shield size={28} className="mr-3 text-emerald-400" /> ElevenLabs Integration
                    </h2>
                    <button
                      onClick={fetchElevenLabsStatus}
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Refresh status"
                    >
                      {byokLoading ? <Spinner size={18} /> : <RefreshCw size={18} />}
                    </button>
                  </div>

                  {byokLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size={24} className="text-emerald-400 mr-3" />
                      <span className="text-slate-400">Loading integration status...</span>
                    </div>
                  ) : elevenLabsStatus?.connected ? (
                    /* Connected State */
                    <div className="space-y-6">
                      {/* Connection Info */}
                      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                              <CheckCircle size={20} className="text-emerald-400" />
                            </div>
                            <div>
                              <h3 className="text-white font-semibold">Connected</h3>
                              <p className="text-xs text-slate-500">
                                Key ending in ••••{elevenLabsStatus.last4} · Verified {new Date(elevenLabsStatus.verifiedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-emerald-400 uppercase px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            {elevenLabsStatus.tier || 'Active'}
                          </span>
                        </div>

                        {/* Agent Minutes Usage */}
                        {elevenLabsStatus.minutesLimit > 0 && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">Agent Minutes</span>
                                <span className="text-white font-medium">
                                  {elevenLabsStatus.minutesUsed ?? 0} / {elevenLabsStatus.minutesLimit} min
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) > 0.9
                                    ? 'bg-gradient-to-r from-red-500 to-red-400'
                                    : ((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) > 0.7
                                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                                    }`}
                                  style={{ width: `${Math.min(100, ((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) * 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>{Math.round(((elevenLabsStatus.minutesUsed || 0) / elevenLabsStatus.minutesLimit) * 100)}% used</span>
                                <span>{elevenLabsStatus.minutesRemaining ?? 0} min remaining</span>
                              </div>
                            </div>

                            {/* Character / Token Usage */}
                            {(elevenLabsStatus.characterCount != null || elevenLabsStatus.characterLimit != null) && (
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-slate-400">Characters (Tokens)</span>
                                  <span className="text-white font-medium">
                                    {(elevenLabsStatus.characterCount ?? 0).toLocaleString()} / {(elevenLabsStatus.characterLimit ?? 0).toLocaleString()}
                                  </span>
                                </div>
                                {elevenLabsStatus.characterLimit > 0 && (
                                  <>
                                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${((elevenLabsStatus.characterCount || 0) / elevenLabsStatus.characterLimit) > 0.9
                                          ? 'bg-gradient-to-r from-red-500 to-red-400'
                                          : ((elevenLabsStatus.characterCount || 0) / elevenLabsStatus.characterLimit) > 0.7
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                                            : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                          }`}
                                        style={{ width: `${Math.min(100, ((elevenLabsStatus.characterCount || 0) / elevenLabsStatus.characterLimit) * 100)}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                      <span>{Math.round(((elevenLabsStatus.characterCount || 0) / elevenLabsStatus.characterLimit) * 100)}% used</span>
                                      <span>{(Math.max(0, (elevenLabsStatus.characterLimit || 0) - (elevenLabsStatus.characterCount || 0))).toLocaleString()} remaining</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Estimated Sessions + Reset */}
                            <div className="flex gap-4">
                              <div className="flex-1 p-3 rounded-xl bg-slate-800/40 border border-white/5">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Est. Sessions Left</p>
                                <p className="text-2xl font-bold text-white">{elevenLabsStatus.estimatedSessions ?? 0}</p>
                                <p className="text-xs text-slate-500">~25 min each</p>
                              </div>
                              {elevenLabsStatus.nextResetUnix && (
                                <div className="flex-1 p-3 rounded-xl bg-slate-800/40 border border-white/5">
                                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Resets On</p>
                                  <p className="text-lg font-bold text-white">
                                    {new Date(elevenLabsStatus.nextResetUnix * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {Math.max(0, Math.ceil((elevenLabsStatus.nextResetUnix * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))} days left
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {elevenLabsStatus.error && (
                          <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                            <p className="text-sm text-yellow-400">{elevenLabsStatus.error}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setShowReplaceInput(!showReplaceInput); setConnectError(''); setConnectSuccess(''); }}
                          className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:bg-slate-800/50 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Key size={16} /> Replace Key
                        </button>
                        <button
                          onClick={handleDisconnect}
                          className="flex-1 py-3 rounded-xl border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <XCircle size={16} /> Disconnect
                        </button>
                      </div>

                      {/* Replace Key Input */}
                      {showReplaceInput && (
                        <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5 space-y-4">
                          <h4 className="text-white font-medium">Replace API Key</h4>
                          <p className="text-xs text-slate-500">Enter your new ElevenLabs API key. The old key will be overwritten.</p>
                          <div className="flex gap-3">
                            <input
                              type="password"
                              value={connectKey}
                              onChange={(e) => setConnectKey(e.target.value)}
                              placeholder="Paste your new ElevenLabs API key"
                              className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 transition-colors"
                              onKeyDown={(e) => e.key === 'Enter' && handleConnectKey()}
                            />
                            <button
                              onClick={handleConnectKey}
                              disabled={connectLoading}
                              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                            >
                              {connectLoading ? <Spinner size={16} /> : <CheckCircle size={16} />}
                              {connectLoading ? 'Verifying...' : 'Verify & Save'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Status Messages */}
                      {connectError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                          <XCircle size={16} className="text-red-400 flex-shrink-0" />
                          <p className="text-sm text-red-400">{connectError}</p>
                        </div>
                      )}
                      {connectSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                          <p className="text-sm text-emerald-400">{connectSuccess}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Not Connected State */
                    <div className="space-y-6">
                      {/* Warning Banner */}
                      <div className="p-5 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
                            <AlertTriangle size={20} className="text-yellow-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">ElevenLabs Not Connected</h3>
                            <p className="text-xs text-slate-500">Connect your API key to use voice-powered interviews</p>
                          </div>
                        </div>
                      </div>

                      {/* Connect Form */}
                      <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5 space-y-4">
                        <h4 className="text-white font-medium flex items-center gap-2"><Key size={18} className="text-emerald-400" /> Connect Your API Key</h4>
                        <div className="flex gap-3">
                          <input
                            type="password"
                            value={connectKey}
                            onChange={(e) => setConnectKey(e.target.value)}
                            placeholder="Paste your ElevenLabs API key"
                            className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleConnectKey()}
                          />
                          <button
                            onClick={handleConnectKey}
                            disabled={connectLoading}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                          >
                            {connectLoading ? <Spinner size={16} /> : <Shield size={16} />}
                            {connectLoading ? 'Verifying...' : 'Verify & Save'}
                          </button>
                        </div>

                        {connectError && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                            <XCircle size={16} className="text-red-400 flex-shrink-0" />
                            <p className="text-sm text-red-400">{connectError}</p>
                          </div>
                        )}
                        {connectSuccess && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                            <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                            <p className="text-sm text-emerald-400">{connectSuccess}</p>
                          </div>
                        )}
                      </div>

                      {/* Tutorial Steps */}
                      <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                          <BookOpen size={18} className="text-cyan-400" /> How to Get Your API Key
                        </h4>
                        <div className="space-y-3">
                          {[
                            { step: 1, text: 'Create an ElevenLabs account', link: 'https://elevenlabs.io' },
                            { step: 2, text: 'Click the "Developers" button at the bottom of the left navbar' },
                            { step: 3, text: 'Click "Create API Key"' },
                            { step: 4, text: 'Copy the generated key' },
                            { step: 5, text: 'Paste it above and click "Verify & Save"' }
                          ].map((item) => (
                            <div key={item.step} className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                                {item.step}
                              </span>
                              <span className="text-sm text-slate-400">{item.text}</span>
                              {item.link && (
                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                          <p className="text-xs text-yellow-400 flex items-start gap-2">
                            <Shield size={14} className="flex-shrink-0 mt-0.5" />
                            Treat your API key like a password. It's encrypted at rest and never stored in your browser. You can revoke it anytime from your ElevenLabs dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
