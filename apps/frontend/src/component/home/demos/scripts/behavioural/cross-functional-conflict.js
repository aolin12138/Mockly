// Behavioural script: cross-functional conflict resolution.
// Reuses the hero typewriter question for page continuity:
//   "Describe a difficult cross-functional conflict you resolved."
//
// Timeline (ms):
//   0     panel chrome visible; orb idle
//   800   orb -> speaking; AI question starts typing
//   4000  orb -> listening; waveform active (user response)
//   7200  waveform damps; orb -> thinking briefly, then -> speaking
//         AI follow-up types in: "How did you get both sides to agree?"
//   10000 orb -> idle pause
//   11500 fade-out begins; cycle wraps at 12000
//
export default {
  id: 'cross-functional-conflict',
  demo: 'behavioural',
  duration: 12000,
  tags: ['conflict', 'phase-1'],
  frames: [
    { t: 800, type: 'orb_state', state: 'speaking' },
    {
      t: 800,
      type: 'typewrite',
      target: 'ai_question',
      text: 'Describe a difficult cross-functional conflict you resolved.',
    },
    { t: 4000, type: 'orb_state', state: 'listening' },
    { t: 4000, type: 'waveform', level: 0.65 },
    { t: 7000, type: 'waveform', level: 0.25 },
    { t: 7200, type: 'orb_state', state: 'thinking' },
    { t: 7400, type: 'orb_state', state: 'speaking' },
    {
      t: 7400,
      type: 'typewrite',
      target: 'ai_followup',
      text: 'How did you get both sides to agree?',
    },
    { t: 10000, type: 'orb_state', state: 'idle' },
    { t: 10000, type: 'waveform', level: 0 },
  ],
  captions: [
    { t: 0, text: 'Navigating tension between competing teams' },
    { t: 4000, text: 'Finding common ground under pressure' },
    { t: 7500, text: 'Turning disagreement into shared ownership' },
  ],
};
