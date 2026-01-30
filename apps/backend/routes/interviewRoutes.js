import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const companyProfiles = require('../prompts/company_profile.json');
const roleRubrics = require('../prompts/role_rubrics.json');
import { prisma } from '../prismaClient.js';

const router = express.Router();

// Init interview endpoint (just for logging/setup for now)
router.post('/init', (req, res) => {
  const interviewConfig = req.body;

  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

  // Print the JSON to the terminal as requested
  console.log("----- INTERVIEW CONFIGURATION RECEIVED -----");
  console.log(JSON.stringify(interviewConfig, null, 2));
  console.log("------------------------------------------");

  // TODO: Logic to generate questions or start session would go here

  res.status(200).json({ message: 'Configuration received', config: interviewConfig });
});

// Session route to create session + call n8n webhook
router.post('/session', async (req, res) => {
  console.log("Request received at /session");

  // Parse the interview config from JSON body
  let interviewConfig;
  try {
    interviewConfig = req.body;
    if (!interviewConfig) {
      return res.status(400).json({ error: 'No configuration provided' });
    }
  } catch (error) {
    console.error("Error parsing interview config:", error);
    return res.status(400).json({ error: 'Invalid configuration format', details: error.message });
  }

  const userId = req.userId; // From authMiddleware
  console.log("User ID from auth middleware:", userId);

  // Check if user already has an agent
  let agent;
  try {
    agent = await prisma.agent.findFirst({
      where: {
        userId: userId
      }
    });

    if (agent) {
      console.log(`Found existing agent with ID: ${agent.id} for user: ${userId}`);
      interviewConfig.agent_id = agent.id;
    } else {
      console.log(`No existing agent found for user: ${userId}. Will request agent creation from webhook.`);
      interviewConfig.agent_id = null; // Signal to webhook that agent needs to be created
    }
  } catch (error) {
    console.error("Error checking for existing agent:", error);
    return res.status(500).json({ error: 'Failed to check agent session', details: error.message });
  }

  // Attach Company Profile
  if (interviewConfig.target && interviewConfig.target.company_preset) {
    const profile = companyProfiles[interviewConfig.target.company_preset];
    if (profile) {
      interviewConfig.company_profile = profile;
      console.log(`Attached company profile: ${interviewConfig.target.company_preset}`);
    }
  }

  // Attach Role Rubrics
  if (interviewConfig.session && interviewConfig.session.interview_mode && interviewConfig.target && interviewConfig.target.seniority) {
    let rubricKey = '';
    if (interviewConfig.session.interview_mode === 'behavioral') {
      rubricKey = `behavioral_${interviewConfig.target.seniority}`;
    } else if (interviewConfig.session.interview_mode === 'behavioral_plus_dsa') {
      rubricKey = `behavioral_dsa_${interviewConfig.target.seniority}`;
    }

    const rubric = roleRubrics[rubricKey];
    if (rubric) {
      interviewConfig.role_rubric = rubric;
      console.log(`Attached role rubric: ${rubricKey}`);
    } else {
      console.warn(`Role rubric not found for key: ${rubricKey}`);
    }
  }

  try {
    const session = await prisma.session.create({
      data: {
        userId: userId,
        agentId: interviewConfig.agent_id || null
      }
    });

    // Add userId + sessionId to the config
    interviewConfig.userId = userId;
    interviewConfig.session_id = session.id;

    console.log("----- SENDING JSON PAYLOAD TO WEBHOOK -----");
    console.log(JSON.stringify(interviewConfig, null, 2));
    console.log("-------------------------------------------");

    // Fire webhook asynchronously (don't wait for response)
    fetch('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(interviewConfig)
    }).then(() => {
      console.log(`Webhook triggered for session ${session.id}`);
    }).catch(error => {
      console.error(`Webhook error for session ${session.id}:`, error.message);
    });

    // Immediately return session ID (don't wait for webhook)
    res.json({
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session', details: error.message });
  }
});

// Session status route (polled by frontend)
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const ready = Boolean(session.agentId && session.interviewPrompt && session.interviewPlan && session.feedbackPrompt);

    res.json({
      sessionId: session.id,
      agentId: session.agentId,
      interviewPlan: session.interviewPlan,
      interviewPrompt: session.interviewPrompt,
      feedbackPrompt: session.feedbackPrompt,
      feedback: session.feedback,
      ready
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session', details: error.message });
  }
});

// Cancel session route
router.post('/session/:sessionId/cancel', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        status: 'cancelled'
      }
    });

    console.log(`Session ${sessionId} cancelled by user ${userId}`);
    res.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({ error: 'Failed to cancel session', details: error.message });
  }
});

export default router;
