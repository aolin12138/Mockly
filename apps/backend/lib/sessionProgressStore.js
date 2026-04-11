const sessionProgress = new Map();

export const setSessionProgress = (sessionId, message, stage = 'info') => {
  if (!sessionId || !message) return;
  sessionProgress.set(sessionId, {
    message,
    stage,
    updatedAt: new Date().toISOString()
  });
};

export const getSessionProgress = (sessionId) => {
  if (!sessionId) return null;
  return sessionProgress.get(sessionId) || null;
};

export const deleteSessionProgress = (sessionId) => {
  if (!sessionId) return;
  sessionProgress.delete(sessionId);
};
