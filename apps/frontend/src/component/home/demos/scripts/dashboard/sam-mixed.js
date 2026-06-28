// Demo script variant: Sam, mixed behavioural+technical practice.
// Per spec §7.4 — same frame schedule as canonical, different mock data.
export default {
  id: 'sam-mixed',
  demo: 'dashboard',
  duration: 12000,
  tags: ['mixed'],
  user: {
    name: 'Sam',
    initial: 'S',
  },
  sessions: [
    { topic: 'Behavioural: project prioritisation', score: 80 },
    { topic: 'Technical: system design basics', score: 77 },
    { topic: 'Behavioural: conflict resolution', score: 72 },
  ],
  goal: { label: 'Weekly practice goal', from: 4, to: 5, total: 5 },
  frames: [
    { t: 600, type: 'materialize', target: 'score-card' },
    { t: 600, type: 'score_arc', to: 80 },
    { t: 2200, type: 'materialize', target: 'session-row' },
    { t: 4500, type: 'cursor_to', x: 48, y: 78 },
    { t: 5200, type: 'card_hover', index: 1 },
    { t: 7800, type: 'cursor_to', x: 82, y: 30 },
    { t: 7800, type: 'goal_progress' },
  ],
  captions: [
    { t: 0, text: 'Behavioural and technical, side by side' },
    { t: 4000, text: 'Mixed practice builds a complete profile' },
    { t: 7800, text: 'Weekly goal complete, time for the real thing' },
  ],
};
