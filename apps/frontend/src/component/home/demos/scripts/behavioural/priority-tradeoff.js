// Behavioural script: prioritising when everything is urgent.
// Reuses the hero typewriter question for page continuity:
//   "How did you prioritize when everything felt urgent?"
//
// Timeline (ms):
//   0     panel chrome visible; orb idle
//   800   orb -> speaking; AI question starts typing
//   4000  orb -> listening; waveform active (user response)
//   7200  waveform damps; orb -> thinking briefly, then -> speaking
//         AI follow-up types in: "What did you say no to?"
//   10000 orb -> idle pause
//   11500 fade-out begins; cycle wraps at 12000
//
export default {
  id: 'priority-tradeoff',
  demo: 'behavioural',
  duration: 12000,
  tags: ['tradeoffs', 'phase-1'],
  frames: [
    { t: 800, type: 'orb_state', state: 'speaking' },
    {
      t: 800,
      type: 'typewrite',
      target: 'ai_question',
      text: 'How did you prioritize when everything felt urgent?',
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
      text: 'What did you say no to?',
    },
    { t: 10000, type: 'orb_state', state: 'idle' },
    { t: 10000, type: 'waveform', level: 0 },
  ],
  captions: [
    { t: 0, text: 'Making smart tradeoffs when everything is urgent' },
    { t: 4000, text: 'Staying focused on what matters most' },
    { t: 7500, text: 'Knowing what to deprioritise and why' },
  ],
};
