export const mockDashboardData = {
  user: {
    name: "Alex",
    title: "Software Engineer",
    level: "Mid-Senior",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
  },
  overview: {
    totalInterviews: 12,
    averageScore: 78,
    hoursPracticed: 24,
    streakDays: 3
  },
  recentActivity: [
    {
      id: 1,
      type: "Technical",
      topic: "React Hooks & Performance",
      date: "2023-10-24",
      score: 85,
      duration: "45m",
      status: "Completed",
      feedback: "Strong understanding of useMemo, but struggled slightly with custom hooks implementation.",
      summary: "Great job on optimization concepts. Focus on practical implementation of custom hooks."
    },
    {
      id: 2,
      type: "Behavioral",
      topic: "Leadership Principles",
      date: "2023-10-22",
      score: 72,
      duration: "30m",
      status: "Completed",
      feedback: "Good use of STAR method, but needs more emphasis on the 'Result' component.",
      summary: "Stories were clear but lacked quantifiable impact metrics."
    },
    {
      id: 3,
      type: "System Design",
      topic: "Designing Twitter",
      date: "2023-10-20",
      score: 65,
      duration: "60m",
      status: "Reviewed",
      feedback: "High-level architecture was sound. Database schema needed more normalization consideration.",
      summary: "Good grasp of load balancing. Data modeling needs revision."
    }
  ],
  performance: [
    { subject: 'Technical', A: 120, B: 110, fullMark: 150 },
    { subject: 'Behavioral', A: 98, B: 130, fullMark: 150 },
    { subject: 'System Design', A: 86, B: 130, fullMark: 150 },
    { subject: 'Communication', A: 99, B: 100, fullMark: 150 },
    { subject: 'Problem Solving', A: 85, B: 90, fullMark: 150 },
    { subject: 'Coding Speed', A: 65, B: 85, fullMark: 150 }
  ],
  progressHistory: [
    { name: 'Week 1', score: 65 },
    { name: 'Week 2', score: 68 },
    { name: 'Week 3', score: 75 },
    { name: 'Week 4', score: 72 },
    { name: 'Week 5', score: 82 },
    { name: 'Week 6', score: 88 },
  ],
  improvements: [
    {
      id: 1,
      category: "System Design",
      task: "Review Database Sharding concepts",
      priority: "High"
    },
    {
      id: 2,
      category: "Behavioral",
      task: "Structure answers using STAR method",
      priority: "Medium"
    },
    {
      id: 3,
      category: "Technical",
      task: "Practice Dynamic Programming problems",
      priority: "High"
    }
  ]
};
