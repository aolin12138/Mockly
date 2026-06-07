import { Prisma } from '@prisma/client';

export const TECHNICAL_SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;
export const BEHAVIOURAL_INCOMPLETE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const TECHNICAL_PENDING_EXPIRABLE_STATUSES = ['pending', 'not_started'];
const BEHAVIOURAL_EXPIRABLE_STATUSES = ['incomplete'];

export const shouldExpireTechnicalSession = (session) => {
  if (!session || session.interviewType !== 'Technical') return false;
  if (session.feedback != null) return false;
  return TECHNICAL_PENDING_EXPIRABLE_STATUSES.includes(session.status || 'pending') || session.status === 'incomplete';
};

export const shouldExpireBehaviouralSession = (session) => {
  if (!session || session.interviewType !== 'Behavioural') return false;
  if (session.feedback != null) return false;
  return BEHAVIOURAL_EXPIRABLE_STATUSES.includes(session.status || '');
};

export const getAbandonedSessionStatus = (session) => {
  if (!session) return 'cancelled';
  if (session.interviewType === 'Behavioural') return 'incomplete';
  if (session.interviewType === 'Technical') return 'incomplete';
  return 'cancelled';
};

const buildTechnicalExpiryWhere = (userId) => {
  const where = {
    interviewType: 'Technical',
    feedback: {
      equals: Prisma.AnyNull
    },
    OR: [
      {
        status: {
          in: TECHNICAL_PENDING_EXPIRABLE_STATUSES
        },
        createdAt: {
          lt: new Date(Date.now() - TECHNICAL_SESSION_EXPIRY_MS)
        }
      },
      {
        status: 'incomplete',
        updatedAt: {
          lt: new Date(Date.now() - TECHNICAL_SESSION_EXPIRY_MS)
        }
      }
    ]
  };

  if (userId) {
    where.userId = userId;
  }

  return where;
};

const buildBehaviouralExpiryWhere = (userId) => {
  const where = {
    interviewType: 'Behavioural',
    feedback: {
      equals: Prisma.AnyNull
    },
    status: {
      in: BEHAVIOURAL_EXPIRABLE_STATUSES
    },
    updatedAt: {
      lt: new Date(Date.now() - BEHAVIOURAL_INCOMPLETE_EXPIRY_MS)
    }
  };

  if (userId) {
    where.userId = userId;
  }

  return where;
};

export const expireStaleSessions = async (prisma, { userId } = {}) => {
  const [technical, behavioural] = await Promise.all([
    prisma.session.updateMany({
      where: buildTechnicalExpiryWhere(userId),
      data: {
        status: 'expired'
      }
    }),
    prisma.session.updateMany({
      where: buildBehaviouralExpiryWhere(userId),
      data: {
        status: 'expired'
      }
    })
  ]);

  return { technical, behavioural };
};

export const expireStaleTechnicalSessions = (prisma, options = {}) => (
  expireStaleSessions(prisma, options)
);
