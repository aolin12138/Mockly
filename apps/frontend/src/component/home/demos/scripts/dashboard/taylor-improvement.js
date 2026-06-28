// Demo script variant: Taylor, 3-week score trend 62 → 78 → 85.
// Per spec §7.4 — same frame schedule as canonical, different mock data.
export default {
  id: 'taylor-improvement',
  demo: 'dashboard',
  duration: 12000,
  tags: ['improvement'],
  user: {
    name: 'Taylor',
    initial: 'T',
  },
  sessions: [
    { topic: 'System design deep dive', score: 85 },
    { topic: 'Data structures review', score: 78 },
    { topic: 'Behavioural: leadership scenarios', score: 62 },
  ],
  goal: { label: 'Practice consistency, 5 of 6 weeks', from: 4, to: 5, total: 6 },
  frames: [
    { t: 600, type: 'materialize', target: 'score-card' },
    { t: 600, type: 'score_arc', to: 85 },
    { t: 2200, type: 'materialize', target: 'session-row' },
    { t: 4500, type: 'cursor_to', x: 48, y: 78 },
    { t: 5200, type: 'card_hover', index: 1 },
    { t: 7800, type: 'cursor_to', x: 82, y: 30 },
    { t: 7800, type: 'goal_progress' },
  ],
  captions: [
    { t: 0, text: 'From 62 to 85 in three weeks' },
    { t: 4000, text: 'Every mock sharpens your approach' },
    { t: 7800, text: 'Measurable growth you can see at a glance' },
  ],
};
