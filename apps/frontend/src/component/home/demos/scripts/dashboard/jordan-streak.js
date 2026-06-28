// Demo script variant: Jordan, 7-day practice streak, modest scores climbing.
// Per spec §7.4 — same frame schedule as canonical, different mock data.
export default {
  id: 'jordan-streak',
  demo: 'dashboard',
  duration: 12000,
  tags: ['streak'],
  user: {
    name: 'Jordan',
    initial: 'J',
  },
  sessions: [
    { topic: 'Dynamic programming basics', score: 71 },
    { topic: 'Behavioural: ownership stories', score: 69 },
    { topic: 'Technical: time complexity', score: 66 },
  ],
  goal: { label: 'Keep your 7-day streak', from: 6, to: 7, total: 7 },
  frames: [
    { t: 600, type: 'materialize', target: 'score-card' },
    { t: 600, type: 'score_arc', to: 71 },
    { t: 2200, type: 'materialize', target: 'session-row' },
    { t: 4500, type: 'cursor_to', x: 48, y: 78 },
    { t: 5200, type: 'card_hover', index: 1 },
    { t: 7800, type: 'cursor_to', x: 82, y: 30 },
    { t: 7800, type: 'goal_progress' },
  ],
  captions: [
    { t: 0, text: 'Day 7 of your practice streak, keep going' },
    { t: 4000, text: 'Small gains add up over a week' },
    { t: 7800, text: 'Consistency beats cramming, every time' },
  ],
};
