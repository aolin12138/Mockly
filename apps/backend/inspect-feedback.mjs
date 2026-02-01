import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectFeedback() {
  try {
    // Get all sessions with feedback
    const sessions = await prisma.session.findMany({
      where: {
        feedback: {
          not: null
        }
      },
      select: {
        id: true,
        userId: true,
        feedback: true,
        createdAt: true,
        status: true
      }
    });

    console.log(`\n=== Found ${sessions.length} sessions with feedback ===\n`);

    sessions.forEach((session, index) => {
      console.log(`\n--- Session ${index + 1} ---`);
      console.log(`ID: ${session.id}`);
      console.log(`Created: ${session.createdAt}`);
      console.log(`Status: ${session.status}`);
      console.log(`\nFeedback Type: ${typeof session.feedback}`);
      console.log(`Is Array: ${Array.isArray(session.feedback)}`);

      if (Array.isArray(session.feedback)) {
        console.log(`Array Length: ${session.feedback.length}`);
        if (session.feedback.length > 0) {
          const firstElement = session.feedback[0];
          console.log(`\nFirst Element Type: ${typeof firstElement}`);
          console.log(`First Element Keys: ${Object.keys(firstElement).join(', ')}`);
          console.log(`\nFirst Element Content (full):`);
          console.log(JSON.stringify(firstElement, null, 2));
        }
      } else {
        console.log(`Object Keys: ${Object.keys(session.feedback).join(', ')}`);
        console.log(`\nContent (first 1000 chars):`);
        console.log(JSON.stringify(session.feedback, null, 2).substring(0, 1000));
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectFeedback();
