// Canonical Behavioural script. Per spec §7.2 storyboard.
// Reuses the hero typewriter question for page continuity:
//   "Tell me about a time you led a project through ambiguity and still delivered a measurable outcome."
//
// Timeline (ms):
//   0     panel chrome visible; orb idle
//   800   orb -> speaking; AI question starts typing
//   4000  orb -> listening; waveform active (user response)
//   7200  waveform damps; orb -> thinking briefly, then -> speaking
//         AI follow-up types in: "What was the first thing you did?"
//   10000 orb -> idle pause
//   11500 fade-out begins; cycle wraps at 12000
//
export default {
  id: 'leadership-ambiguity',
  demo: 'behavioural',
  duration: 12000,
  tags: ['canonical', 'leadership', 'phase-1', 'hero-continuity'],
  frames: [
    { t: 800, type: 'orb_state', state: 'speaking' },
    {
      t: 800,
      type: 'typewrite',
      target: 'ai_question',
      text: 'Tell me about a time you led a project through ambiguity and still delivered a measurable outcome.',
    },
    { t: 1800, type: 'callout', id: 'live-callout', x: 55, y: 15, text: 'A live voice interview, just like the real thing', align: 'right' },
    { t: 4000, type: 'orb_state', state: 'listening' },
    { t: 4000, type: 'waveform', level: 0.65 },
    { t: 4100, type: 'callout', id: 'realtime-callout', x: 55, y: 15, text: 'Real-time response, no script reading', align: 'right' },
    {
      t: 4100,
      type: 'typewrite',
      target: 'candidate_response',
      text: 'Last year our checkout flow was dropping users right before Black Friday. I pulled together engineering and design to triage the bottlenecks, starting with Chrome traces.',
    },
    { t: 7000, type: 'waveform', level: 0.25 },
    { t: 7200, type: 'orb_state', state: 'thinking' },
    { t: 7400, type: 'orb_state', state: 'speaking' },
    {
      t: 7400,
      type: 'typewrite',
      target: 'ai_followup',
      text: 'What was the first thing you did?',
    },
    { t: 7800, type: 'callout', id: 'studied-callout', x: 55, y: 15, text: 'Studied behavioural questions, role and company specific', align: 'right' },
    { t: 10000, type: 'orb_state', state: 'idle' },
    { t: 10000, type: 'waveform', level: 0 },
  ],
  captions: [
    { t: 0, text: 'A live voice interview, just like the real thing' },
    { t: 4000, text: 'Real-time response, no script reading' },
    { t: 7500, text: 'Studied behavioural questions, in your role and company' },
  ],
};
