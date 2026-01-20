export const SAMPLE_FEEDBACK = {
  feedback: {
    overall_feedback: 'Strong storytelling and clear structure. Work on tighter examples and concise endings.',
    metrics: [
      { id: 'communication', label: 'Communication', score: 8.4 },
      { id: 'clarity', label: 'Clarity', score: 7.9 },
      { id: 'leadership', label: 'Leadership', score: 7.3 },
      { id: 'problem-solving', label: 'Problem solving', score: 8.1 },
      { id: 'culture-fit', label: 'Culture fit', score: 7.8 },
      { id: 'collaboration', label: 'Collaboration', score: 8.2 },
    ],
    candidate_answer:
      'I led a small team to reduce page load time by 40% by introducing code-splitting and image compression. I coordinated stakeholders, measured results, and rolled out the fix globally.',
    candidate_star_feedback:
      'Good Situation and Task framing. For Action, add 1–2 concrete steps with metrics. For Result, close with business impact and a brief reflection.',
    rephrased_star_answer:
      'Situation: Our checkout pages were slow, causing drop-offs. Task: Improve performance before holiday traffic. Action: I profiled bundles, implemented code-splitting, compressed hero media, and added performance budgets. Result: First load improved by 40%, conversion lifted 6%, and we kept error rates flat.',
  },
  transcript: [
    { role: 'assistant', text: 'Tell me about a time you improved a system under pressure.', timestart: 2 },
    { role: 'user', text: 'Sure. Last year our checkout was slowing during Black Friday prep…', timestart: 8 },
    { role: 'assistant', text: 'What did you do first to diagnose it?', timestart: 32 },
    { role: 'user', text: 'I pulled Chrome traces and found large hero assets and un-split bundles…', timestart: 40 },
  ],
  audio: null,
};
