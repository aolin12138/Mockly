export const SAMPLE_FEEDBACK = {
  feedback: {
    meta: {
      session_mode: 'practice',
      confidence_level: 'high',
      questions_asked: 3,
      domains_covered: ['strategic_influence', 'cross_functional_leadership', 'conflict_resolution'],
    },
    summary: {
      overall_score: 74,
      one_liner: 'Strong storytelling with clear structure. Tighten examples with concrete metrics and close with sharper results.',
      recommendation: 'hire',
      readiness: 'nearly_ready',
    },
    dimension_scores: [
      {
        dimension: 'communication',
        score: 8,
        evidence: [
          { observation: 'Used clear, structured language throughout', reasoning: 'Maintained logical flow across all three answers without losing the interviewer' },
          { observation: 'Adapted vocabulary for a non-technical audience', reasoning: 'Showed awareness of the interviewer context when describing system changes' },
        ],
      },
      {
        dimension: 'leadership',
        score: 7,
        evidence: [
          { observation: 'Described delegating work and aligning stakeholders', reasoning: 'Demonstrated ownership of the outcome while enabling the team' },
        ],
      },
      {
        dimension: 'problem_solving',
        score: 8,
        evidence: [
          { observation: 'Broke down a complex problem into prioritised steps', reasoning: 'Showed systematic thinking under time pressure' },
        ],
      },
      {
        dimension: 'collaboration',
        score: 6,
        evidence: [
          { observation: 'Mentioned team involvement but focused heavily on personal contribution', reasoning: 'Could strengthen answers by crediting specific team members and their roles' },
        ],
      },
      {
        dimension: 'adaptability',
        score: 7,
        evidence: [
          { observation: 'Pivoted approach mid-project when requirements changed', reasoning: 'Showed flexibility without losing sight of the goal' },
        ],
      },
    ],
    answer_breakdown: [
      {
        question: 'Tell me about a time you influenced a team to adopt a new process without having direct authority.',
        domain: 'strategic_influence',
        star: { situation: true, task: true, action: true, result: true },
        quality: 'strong',
        observation: 'Excellent use of the STAR framework. The situation was clear, the action steps were specific, and the result included measurable impact.',
      },
      {
        question: 'Describe a situation where you had to coordinate across multiple departments to deliver a project.',
        domain: 'cross_functional_leadership',
        star: { situation: true, task: true, action: true, result: false },
        quality: 'adequate',
        observation: 'Good setup and actions, but the result lacked specific metrics. Consider quantifying the project outcome next time.',
      },
      {
        question: 'Tell me about a time you had to resolve a conflict between team members.',
        domain: 'conflict_resolution',
        star: { situation: true, task: false, action: true, result: true },
        quality: 'weak',
        observation: 'The task was unclear — it blended into the situation. Separate what you were specifically responsible for from the background context.',
      },
    ],
    patterns: [
      { type: 'strength', description: 'Consistently opens with strong situation framing that gives the interviewer context quickly', impact: 'high' },
      { type: 'strength', description: 'Uses specific actions rather than vague descriptions of what the team did', impact: 'medium' },
      { type: 'gap', description: 'Results section often lacks quantified business impact', impact: 'high' },
      { type: 'gap', description: 'Tends to under-credit team contributions, which may signal low collaboration awareness', impact: 'medium' },
    ],
    highlights: {
      best_moment: {
        context: 'Q1: Influencing team to adopt new process',
        observation: 'You described building a small proof-of-concept over a weekend to de-risk the proposal before presenting it. This showed initiative and reduced stakeholder resistance effectively.',
      },
      growth_moment: {
        context: 'Q3: Resolving team conflict',
        observation: 'When describing the conflict resolution, you jumped straight to your actions without explaining your specific mandate or responsibility. Anchoring the task makes the action more impressive.',
      },
    },
    cv_interview_alignment: {
      available: true,
      overall: 'understated',
      summary: 'Your interview answers generally undersold your experience. Your CV claims strong leadership and strategic impact, but your answers focused more on execution details than strategic thinking.',
      claims: [
        {
          cv_claim: 'Led cross-functional team of 12 to deliver platform migration on time and under budget',
          what_you_showed: 'Described coordinating across departments but focused on individual contributions rather than leadership of 12 people',
          assessment: 'understated',
          gap: 'Your answer made this sound like a coordination role rather than a leadership role. Emphasise the scope and your decision-making authority.',
          coaching: {
            how_to_answer: 'Start with the scale: "I led a team of 12 across engineering, design, and product." Then describe a key decision YOU made that shaped the outcome.',
            cv_suggestion: 'Your CV claim is strong — make sure your interview stories match this level of ownership.',
          },
        },
        {
          cv_claim: 'Improved system performance by 40% through code-splitting and optimisation',
          what_you_showed: 'Described the technical approach clearly with specific metrics and before/after comparison',
          assessment: 'consistent',
          gap: '',
          coaching: {
            how_to_answer: 'This was well-aligned. Keep using the before/after framing with specific numbers.',
            cv_suggestion: '',
          },
        },
        {
          cv_claim: 'Mentored 5 junior engineers, with 3 promoted within 18 months',
          what_you_showed: 'Did not reference mentoring in any answers',
          assessment: 'not_tested',
          gap: 'This is a strong claim that was never tested. If asked about people development, have this story ready.',
          coaching: {
            how_to_answer: 'Prepare a STAR story about a specific mentee: their challenge, your approach, their growth, and the promotion outcome.',
            cv_suggestion: 'Consider adding a specific example of the mentoring methodology you used.',
          },
        },
      ],
    },
    strengths: [
      { dimension: 'Communication', description: 'Clear, well-structured responses that are easy to follow' },
      { dimension: 'Problem Solving', description: 'Demonstrates systematic thinking and prioritisation under pressure' },
      { dimension: 'Leadership', description: 'Takes ownership of outcomes and drives initiatives forward' },
    ],
    areas_for_improvement: [
      {
        dimension: 'Collaboration',
        priority: 'high',
        suggestion: 'Credit team members more explicitly and describe your role within the team dynamic',
        example_better_response: 'Instead of "I implemented the solution", try "I proposed the approach and paired with our senior backend engineer to implement it, while our designer ran user testing in parallel."',
      },
      {
        dimension: 'Results',
        priority: 'high',
        suggestion: 'Always close with quantified business impact, not just what was delivered',
        example_better_response: 'Instead of "We shipped the feature on time", try "We shipped 2 weeks early, which contributed to a 6% lift in conversion during the holiday period."',
      },
      {
        dimension: 'Task Framing',
        priority: 'medium',
        suggestion: 'Clearly separate the task (your specific responsibility) from the situation (the background context)',
      },
    ],
    next_steps: [
      { focus: 'Quantify Results', action: 'For each STAR story in your bank, write down 2-3 specific metrics that demonstrate business impact.' },
      { focus: 'Team Framing', action: 'Revisit your top 5 stories and add at least one sentence crediting a specific team member or cross-functional partner.' },
      { focus: 'CV Alignment', action: 'For each CV bullet point, prepare a matching STAR story that demonstrates the same level of scope and ownership.' },
    ],
  },
  transcript: [
    { role: 'assistant', text: 'Tell me about a time you influenced a team to adopt a new process without having direct authority.', timestart: 2 },
    { role: 'user', text: 'Sure. Last year, our deploy process was manual and error-prone. I proposed we adopt CI/CD...', timestart: 8 },
    { role: 'assistant', text: 'What was the biggest resistance you faced?', timestart: 45 },
    { role: 'user', text: 'The senior engineers were comfortable with the existing flow. I built a small proof-of-concept over a weekend...', timestart: 52 },
    { role: 'assistant', text: 'How did that turn out?', timestart: 90 },
    { role: 'user', text: 'Within a month, the whole team adopted it. Deploy failures dropped by 80% and we saved about 4 hours per week.', timestart: 95 },
  ],
  audio: null,
};
