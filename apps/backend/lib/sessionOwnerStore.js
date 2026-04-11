const sessionOwners = new Map();

export const setSessionOwner = (sessionId, userId) => {
  if (!sessionId || !userId) return;
  sessionOwners.set(sessionId, userId);
};

export const getSessionOwner = (sessionId) => {
  if (!sessionId) return null;
  return sessionOwners.get(sessionId) || null;
};

export const deleteSessionOwner = (sessionId) => {
  if (!sessionId) return;
  sessionOwners.delete(sessionId);
};
