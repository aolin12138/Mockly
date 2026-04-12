import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Code2,
  User,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Clock,
  Award,
  Search,
  Key,
  LogOut,
  TrendingUp,
  BookOpen
} from 'lucide-react';

const MotionButton = motion.button;
const MotionDiv = motion.div;

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'duration', label: 'Duration' },
  { value: 'time', label: 'Time' }
];

/* ─── Animation variants ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 }
  }
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const getStatusPill = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'cancelled') {
    return {
      label: 'Cancelled',
      classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };
  }
  if (normalized === 'incomplete') {
    return {
      label: 'Incomplete',
      classes: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    };
  }
  if (normalized === 'pending') {
    return {
      label: 'Pending',
      classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    };
  }
  if (normalized === 'completed') {
    return {
      label: 'Completed',
      classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    };
  }
  return {
    label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown',
    classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  };
};

const getScorePill = (score) => ({
  classes: score >= 80
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : score >= 60
      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'
});

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

/* ─── Skeleton loader card ─── */
const SkeletonCard = () => (
  <MotionDiv
    variants={cardVariants}
    className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 overflow-hidden"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 animate-pulse" />
        <div className="space-y-2">
          <div className="w-40 h-4 rounded-lg bg-slate-800/80 animate-pulse" />
          <div className="w-28 h-3 rounded-lg bg-slate-800/60 animate-pulse" />
        </div>
      </div>
      <div className="w-16 h-7 rounded-full bg-slate-800/80 animate-pulse" />
    </div>
    <div className="pl-14 pr-4 space-y-2">
      <div className="w-full h-3 rounded-lg bg-slate-800/60 animate-pulse" />
      <div className="w-3/4 h-3 rounded-lg bg-slate-800/60 animate-pulse" />
    </div>
  </MotionDiv>
);

/* ─── Spinning loader for infinite scroll ─── */
const SpinnerLoader = () => (
  <MotionDiv
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex items-center justify-center py-8 gap-3"
  >
    <motion.div
      className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
    <span className="text-sm text-slate-500">Loading more interviews…</span>
  </MotionDiv>
);

/* ─── Sidebar item (matching Dashboard) ─── */
const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
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
      <Icon
        size={20}
        className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300'}
      />
      <span className="font-medium">{label}</span>
    </span>
  </MotionButton>
);

/* ─── Main Page ─── */
const HistoryPage = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState('time');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch interviews with pagination and sorting
  const fetchInterviews = useCallback(
    async (reset = false) => {
      if (reset) setInitialLoading(true);
      else setLoadingMore(true);

      const token = localStorage.getItem('token');
      const limit = 10;
      const offset = reset ? 0 : (page - 1) * limit;
      try {
        const res = await fetch(
          `http://localhost:3000/api/interview/user/interviews?limit=${limit}&offset=${offset}&sortBy=${sortBy}&sortDir=${sortDir}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (reset) {
            setInterviews(data.interviews);
          } else {
            setInterviews((prev) => [...prev, ...data.interviews]);
          }
          setHasMore(data.hasMore);
        }
      } catch (e) {
        // Handle error silently
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [page, sortBy, sortDir]
  );

  useEffect(() => {
    fetchInterviews(true);
    // eslint-disable-next-line
  }, [sortBy, sortDir]);

  useEffect(() => {
    if (page > 1) fetchInterviews();
    // eslint-disable-next-line
  }, [page]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || loadingMore || initialLoading) return;
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 200
      ) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, initialLoading]);

  const handleSortChange = (option) => {
    setSortBy(option);
    setPage(1);
  };
  const handleSortDirToggle = () => {
    setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar — matches Dashboard */}
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
          <SidebarItem icon={LayoutDashboard} label="Overview" onClick={() => navigate('/dashboard')} />
          <SidebarItem icon={History} label="History" active onClick={() => { }} />
          <SidebarItem icon={TrendingUp} label="Analytics" onClick={() => navigate('/dashboard')} />
          <SidebarItem icon={BookOpen} label="Improve" onClick={() => navigate('/dashboard')} />
        </nav>

        <div className="pt-6 border-t border-slate-800/60 space-y-2">
          <SidebarItem icon={Key} label="API Key" onClick={() => navigate('/dashboard?tab=settings')} />
          <SidebarItem icon={LogOut} label="Sign Out" onClick={handleSignOut} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-8 h-screen overflow-y-auto no-scrollbar z-10 relative">
        <motion.div
          className="max-w-[1000px] mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.header variants={headerVariants} className="mb-10">
            <div className="flex items-center gap-4 mb-1">
              <MotionButton
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-slate-800/40 border border-white/5 text-slate-400 hover:text-white hover:border-emerald-500/30 transition-all cursor-pointer"
              >
                <ArrowLeft size={18} />
              </MotionButton>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Interview History
                  </span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Review your past performances and track your progress
                </p>
              </div>
            </div>
          </motion.header>

          {/* Sort Controls */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center gap-3 mb-8 flex-wrap"
          >
            <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl px-4 py-2.5">
              <span className="text-slate-500 text-sm">Sort by</span>
              {SORT_OPTIONS.map((opt) => (
                <MotionButton
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${sortBy === opt.value
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                >
                  {opt.label}
                </MotionButton>
              ))}
            </div>
            <MotionButton
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="p-2.5 rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer"
              onClick={handleSortDirToggle}
              aria-label="Toggle sort direction"
            >
              <motion.div
                key={sortDir}
                initial={{ rotate: sortDir === 'asc' ? 180 : 0, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </motion.div>
            </MotionButton>
            <div className="ml-auto text-xs text-slate-600">
              {!initialLoading && `${interviews.length} interview${interviews.length !== 1 ? 's' : ''} shown`}
            </div>
          </motion.div>

          {/* Interview Cards */}
          <motion.div className="space-y-4" variants={containerVariants}>
            <AnimatePresence mode="wait">
              {/* Initial loading — skeleton cards */}
              {initialLoading ? (
                <motion.div
                  key="skeletons"
                  className="space-y-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {[...Array(5)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </motion.div>
              ) : interviews.length === 0 ? (
                /* Empty state */
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-20"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/40 border border-white/5 flex items-center justify-center">
                    <Search size={24} className="text-slate-600" />
                  </div>
                  <p className="text-slate-400 text-lg font-medium">No interviews found</p>
                  <p className="text-slate-600 text-sm mt-1">
                    Complete an interview to see it here
                  </p>
                  <MotionButton
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/interview-setup')}
                    className="mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    Start your first interview
                  </MotionButton>
                </motion.div>
              ) : (
                /* Interview list */
                <motion.div
                  key="list"
                  className="space-y-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {interviews.map((interview) => {
                    const isTechnical = interview.interviewType === 'Technical';
                    const statusPill = getStatusPill(interview.status);
                    const scorePill = getScorePill(interview.score || 0);
                    return (
                      <MotionDiv
                        key={interview.id}
                        variants={cardVariants}
                        whileHover={{
                          y: -2,
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          transition: { duration: 0.2 }
                        }}
                        className="p-5 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        onClick={() =>
                          navigate(
                            isTechnical
                              ? `/results/technical/${interview.id}`
                              : `/results/${interview.id}`
                          )
                        }
                        tabIndex={0}
                        aria-label={`View interview ${interview.topic || interview.id}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isTechnical
                                  ? 'bg-cyan-500/15 text-cyan-400 shadow-cyan-500/10'
                                  : 'bg-purple-500/15 text-purple-400 shadow-purple-500/10'
                                }`}
                            >
                              {isTechnical ? <Code2 size={18} /> : <User size={18} />}
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">
                                {interview.topic || 'Interview'}
                              </h4>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-md ${isTechnical
                                      ? 'bg-cyan-500/10 text-cyan-400'
                                      : 'bg-purple-500/10 text-purple-400'
                                    }`}
                                >
                                  {interview.interviewType}
                                </span>
                                <span className="text-xs text-slate-600 flex items-center gap-1">
                                  <Clock size={11} />
                                  {new Date(interview.createdAt).toLocaleDateString('en-NZ', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                                {interview.duration > 0 && (
                                  <span className="text-xs text-slate-600">
                                    {Math.floor(interview.duration / 60)}m {interview.duration % 60}s
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusPill.classes}`}
                              >
                                {statusPill.label}
                              </span>
                              {statusPill.label === 'Completed' && (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${scorePill.classes}`}
                                >
                                  <Award size={12} />
                                  {interview.score || 0}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 pl-14 pr-4 line-clamp-2 leading-relaxed group-hover:text-slate-400 transition-colors">
                          {interview.assessment || 'Interview session completed.'}
                        </p>
                      </MotionDiv>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading more spinner */}
            <AnimatePresence>
              {loadingMore && <SpinnerLoader />}
            </AnimatePresence>

            {/* End of list */}
            <AnimatePresence>
              {!hasMore && interviews.length > 0 && !initialLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-6"
                >
                  <div className="inline-block w-12 h-px bg-slate-800 mb-3" />
                  <p className="text-xs text-slate-600">You've reached the end</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default HistoryPage;
