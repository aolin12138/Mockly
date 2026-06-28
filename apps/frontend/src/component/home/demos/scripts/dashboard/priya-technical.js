// Demo script variant: Priya, technical-heavy practice.
// Per spec §7.4 — same frame schedule as canonical, different mock data.
export default {
  id: 'priya-technical',
  demo: 'dashboard',
  duration: 12000,
  tags: ['technical-heavy'],
  user: {
    name: 'Priya',
    initial: 'P',
  },
  sessions: [
    { topic: 'Two-pointer techniques', score: 84 },
    { topic: 'Hash-map lookups', score: 79 },
    { topic: 'Binary search variants', score: 73 },
  ],
  goal: { label: 'Complete 4 technical mocks', from: 2, to: 3, total: 4 },
  frames: [
    { t: 600, type: 'materialize', target: 'score-card' },
    { t: 600, type: 'score_arc', to: 84 },
    { t: 2200, type: 'materialize', target: 'session-row' },
    { t: 4500, type: 'cursor_to', x: 48, y: 78 },
    { t: 5200, type: 'card_hover', index: 1 },
    { t: 7800, type: 'cursor_to', x: 82, y: 30 },
    { t: 7800, type: 'goal_progress' },
  ],
  captions: [
    { t: 0, text: 'Technical mocks drill down into logic' },
    { t: 4000, text: 'Two-pointer patterns become second nature' },
    { t: 7800, text: 'Track your coding benchmark over time' },
  ],
};
