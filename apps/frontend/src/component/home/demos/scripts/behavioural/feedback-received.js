// Behavioural script: feedback received repeatedly.
// Reuses the hero typewriter question for page continuity:
//   "What feedback have you received repeatedly in your career?"
//
// Timeline (ms):
//   0     panel chrome visible; orb idle
//   800   orb -> speaking; AI question starts typing
//   4000  orb -> listening; waveform active (user response)
//   7200  waveform damps; orb -> thinking briefly, then -> speaking
//         AI follow-up types in: "What did you change after hearing it?"
//   10000 orb -> idle pause
//   11500 fade-out begins; cycle wraps at 12000
//
export default {
  id: 'feedback-received',
  demo: 'behavioural',
  duration: 12000,
  tags: ['self-awareness', 'phase-1'],
  frames: [
    { t: 800, type: 'orb_state', state: 'speaking' },
    {
      t: 800,
      type: 'typewrite',
      target: 'ai_question',
      text: 'What feedback have you received repeatedly in your career?',
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
      text: 'What did you change after hearing it?',
    },
    { t: 10000, type: 'orb_state', state: 'idle' },
    { t: 10000, type: 'waveform', level: 0 },
  ],
  captions: [
    { t: 0, text: 'Honest self-reflection in a live conversation' },
    { t: 4000, text: 'Recognising patterns across performance reviews' },
    { t: 7500, text: 'Showing real growth and self-awareness' },
  ],
};
