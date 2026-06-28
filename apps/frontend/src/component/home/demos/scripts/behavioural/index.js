// Behavioural script bank. M1 ships with 1 canonical; M3 adds 4 variants.
import leadershipAmbiguity from './leadership-ambiguity';
import crossFunctionalConflict from './cross-functional-conflict';
import feedbackReceived from './feedback-received';
import failedDecision from './failed-decision';
import priorityTradeoff from './priority-tradeoff';

export default [
  leadershipAmbiguity,
  crossFunctionalConflict,
  feedbackReceived,
  failedDecision,
  priorityTradeoff,
];
