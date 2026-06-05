import { Prisma } from '@prisma/client';

export const TECHNICAL_SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;

const TECHNICAL_EXPIRABLE_STATUSES = ['pending', 'not_started'];

export const shouldExpireTechnicalSession = (session) => {
  if (!session || session.interviewType !== 'Technical') return false;
  if (session.feedback != null) return false;
  return TECHNICAL_EXPIRABLE_STATUSES.includes(session.status || 'pending');
};

export const getAbandonedSessionStatus = (session) => (
  shouldExpireTechnicalSession(session) ? 'expired' : 'cancelled'
);

export const expireStaleTechnicalSessions = async (prisma, { userId } = {}) => {
  const where = {
    interviewType: 'Technical',
    feedback: {
      equals: Prisma.AnyNull
    },
    status: {
      in: TECHNICAL_EXPIRABLE_STATUSES
    },
    createdAt: {
      lt: new Date(Date.now() - TECHNICAL_SESSION_EXPIRY_MS)
    }
  };

  if (userId) {
    where.userId = userId;
  }

  return prisma.session.updateMany({
    where,
    data: {
      status: 'expired'
    }
  });
};
