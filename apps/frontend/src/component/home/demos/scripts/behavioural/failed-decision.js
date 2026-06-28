// Behavioural script: a decision that did not work out.
// Reuses the hero typewriter question for page continuity:
//   "Walk me through a decision you made that didn't work out."
//
// Timeline (ms):
//   0     panel chrome visible; orb idle
//   800   orb -> speaking; AI question starts typing
//   4000  orb -> listening; waveform active (user response)
//   7200  waveform damps; orb -> thinking briefly, then -> speaking
//         AI follow-up types in: "What would you do differently now?"
//   10000 orb -> idle pause
//   11500 fade-out begins; cycle wraps at 12000
//
export default {
  id: 'failed-decision',
  demo: 'behavioural',
  duration: 12000,
  tags: ['resilience', 'phase-1'],
  frames: [
    { t: 800, type: 'orb_state', state: 'speaking' },
    {
      t: 800,
      type: 'typewrite',
      target: 'ai_question',
      text: "Walk me through a decision you made that didn't work out.",
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
      text: 'What would you do differently now?',
    },
    { t: 10000, type: 'orb_state', state: 'idle' },
    { t: 10000, type: 'waveform', level: 0 },
  ],
  captions: [
    { t: 0, text: 'Owning tough calls that did not land' },
    { t: 4000, text: 'Demonstrating accountability without excuses' },
    { t: 7500, text: 'Learning from failure and adapting quickly' },
  ],
};
