// Canonical Dashboard script. Per spec §7.1 storyboard.
// User: Alex, behavioural-heavy practice, latest score 78.
//
// Layout map (percentages of demo panel):
//   score card     ~ x:25 y:38  (cursor target)
//   session cards  ~ x:[28,48,68] y:78
//   goal panel     ~ x:82 y:30
//
// Frame schedule (ms from demo start):
//   0     panel chrome already visible (renders by default)
//   600   score card materializes, arc animates 0 → 78 over ~1200ms
//   2200  session row materializes (3 cards stagger 80ms apart)
//   4500  cursor enters and glides to session card #2 (middle)
//   5200  card #2 lifts, STAR bars expand over 800ms
//   7800  cursor glides to goal panel; goal animates 3 → 4 over 800ms
//   10000 idle pause
//   11500 cycle wraps via onComplete at 12000
//
export default {
  id: 'alex-leadership',
  demo: 'dashboard',
  duration: 12000,
  tags: ['canonical', 'behavioural-heavy'],
  user: {
    name: 'Alex',
    initial: 'A',
  },
  sessions: [
    { topic: 'Influence without authority', score: 82 },
    { topic: 'Cross-functional conflict', score: 74 },
    { topic: 'Two-pointer optimization', score: 71 },
  ],
  goal: { label: 'Practice 5 behavioural this week', from: 3, to: 4, total: 5 },
  frames: [
    { t: 600, type: 'materialize', target: 'score-card' },
    { t: 600, type: 'score_arc', to: 78 },
    { t: 2200, type: 'materialize', target: 'session-row' },
    { t: 4500, type: 'cursor_to', x: 48, y: 78 },
    { t: 5200, type: 'card_hover', index: 1 },
    { t: 7800, type: 'cursor_to', x: 82, y: 30 },
    { t: 7800, type: 'goal_progress' },
  ],
  captions: [
    { t: 0, text: 'Your interview practice, tracked' },
    { t: 4000, text: 'STAR breakdown on every answer' },
    { t: 7800, text: 'Set goals, watch yourself improve' },
  ],
};
