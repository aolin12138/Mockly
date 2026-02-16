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

// Session route to create session + call n8n webhook (NO DB SAVE)
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

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  // Add userId + sessionId to the config
  interviewConfig.userId = userId;
  interviewConfig.session_id = tempSessionId;

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
    console.log(`Webhook triggered for temporary session ${tempSessionId}`);
  }).catch(error => {
    console.error(`Webhook error for session ${tempSessionId}:`, error.message);
  });

  // Persist a pending session so callback data can be stored reliably
  try {
    await prisma.session.create({
      data: {
        id: tempSessionId,
        userId: userId,
        interviewType: 'Behavioural',
        status: 'pending'
      }
    });
    console.log(`Pending behavioral session created: ${tempSessionId}`);
  } catch (error) {
    console.warn(`Failed to create pending session ${tempSessionId}:`, error?.message || error);
  }

  // Return temp session ID immediately
  res.json({
    sessionId: tempSessionId
  });
});

// Technical session route - creates temporary session (NOT saved to DB)
router.post('/technical/session', async (req, res) => {
  console.log("Request received at /technical/session");

  const interviewConfig = req.body;
  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

  const userId = req.userId; // From authMiddleware
  console.log("User ID from auth middleware:", userId);

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`Created temporary technical session ${tempSessionId} for user ${userId}`);
  console.log("Session config:", JSON.stringify(interviewConfig, null, 2));

  // Return session ID immediately - NO DATABASE SAVE, NO WEBHOOK
  res.json({
    sessionId: tempSessionId
  });
});

// Save technical session with feedback to database
router.post('/technical/save', async (req, res) => {
  console.log("Request received at /technical/save");

  const { conversationId, executionSummary, feedback, duration } = req.body;
  const userId = req.userId; // From authMiddleware

  if (!feedback) {
    return res.status(400).json({ error: 'No feedback provided' });
  }

  try {
    // Create session in database with feedback
    const session = await prisma.session.create({
      data: {
        userId: userId,
        interviewType: 'Technical',
        feedback: feedback,
        agentId: conversationId || null,
        status: 'completed',
        duration: duration || null, // Duration in seconds
        // Store execution summary in interviewPlan field (repurposed for technical)
        interviewPlan: executionSummary ? JSON.stringify(executionSummary) : null,
      }
    });

    console.log(`Technical session saved to database: ${session.id}`);
    console.log("Session details:", JSON.stringify({ id: session.id, userId, conversationId }, null, 2));

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error saving technical session:', error);
    res.status(500).json({ error: 'Failed to save session', details: error.message });
  }
});

// Save behavioral session with feedback to database
router.post('/behavioral/save', async (req, res) => {
  console.log("Request received at /behavioral/save");

  const { agentId, interviewPlan, interviewPrompt, feedbackPrompt, feedback, duration } = req.body;
  const userId = req.userId; // From authMiddleware

  if (!feedback) {
    return res.status(400).json({ error: 'No feedback provided' });
  }

  try {
    // Create session in database with all callback data
    const session = await prisma.session.create({
      data: {
        userId: userId,
        interviewType: 'Behavioural',
        feedback: feedback,
        agentId: agentId || null,
        interviewPlan: interviewPlan || null,
        interviewPrompt: interviewPrompt || null,
        feedbackPrompt: feedbackPrompt || null,
        status: 'completed',
        duration: duration || null, // Duration in seconds
      }
    });

    console.log(`Behavioral session saved to database: ${session.id}`);
    console.log("Session details:", JSON.stringify({ id: session.id, userId, agentId }, null, 2));

    // Create agent record if agent_id is provided and doesn't already exist
    if (agentId) {
      const existingAgent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!existingAgent) {
        await prisma.agent.create({
          data: {
            id: agentId,
            userId: userId
          }
        });
        console.log(`Agent created: ${agentId}`);
      }
    }

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error saving behavioral session:', error);
    res.status(500).json({ error: 'Failed to save session', details: error.message });
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

// Update session duration route
router.post('/session/:sessionId/duration', async (req, res) => {
  const { sessionId } = req.params;
  const { duration } = req.body;
  const userId = req.userId;

  if (!duration || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Invalid duration provided' });
  }

  try {
    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        duration: duration
      }
    });

    console.log(`Session ${sessionId} duration updated to ${duration} seconds by user ${userId}`);
    res.json({ success: true, sessionId: session.id, duration: session.duration });
  } catch (error) {
    console.error('Error updating session duration:', error);
    res.status(500).json({ error: 'Failed to update session duration', details: error.message });
  }
});

// Get last agent for user (quick-start)
router.get('/agent/last', async (req, res) => {
  const userId = req.userId;
  console.log(`Fetching last agent for user ${userId}`);

  try {
    const agent = await prisma.agent.findFirst({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!agent) {
      return res.json({ agent: null });
    }

    res.json({
      agent: {
        id: agent.id,
        name: agent.name
      }
    });
  } catch (error) {
    console.error('Error fetching last agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent', details: error.message });
  }
});

// Quick-start session with last agent setup
router.post('/session/quick-start', async (req, res) => {
  console.log("Request received at /session/quick-start");

  const userId = req.userId;
  console.log("User ID from auth middleware:", userId);

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Fetch last agent
    const agent = await prisma.agent.findFirst({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!agent) {
      return res.status(400).json({ error: 'No previous agent setup found. Please configure a new session.' });
    }

    console.log(`Quick-start: Using agent ${agent.id} for user ${userId}`);

    // Prepare quick-start config
    const quickStartConfig = {
      userId: userId,
      session_id: tempSessionId,
      agent_id: agent.id,
      interview_mode: 'behavioral',
      quick_start: true,
      timestamp: new Date().toISOString()
    };

    console.log("----- QUICK-START SESSION INITIATED -----");
    console.log(JSON.stringify(quickStartConfig, null, 2));
    console.log("----------------------------------------");

    // Trigger webhook for quick-start
    fetch('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quickStartConfig)
    }).then(() => {
      console.log(`Quick-start webhook triggered for session ${tempSessionId}`);
    }).catch(error => {
      console.error(`Webhook error for quick-start session ${tempSessionId}:`, error.message);
    });

    // Persist a pending session for quick-start
    try {
      await prisma.session.create({
        data: {
          id: tempSessionId,
          userId: userId,
          interviewType: 'Behavioural',
          agentId: agent.id,
          status: 'pending'
        }
      });
      console.log(`Pending quick-start session created: ${tempSessionId}`);
    } catch (error) {
      console.warn(`Failed to create pending quick-start session ${tempSessionId}:`, error?.message || error);
    }

    // Return temp session ID immediately
    res.json({
      sessionId: tempSessionId,
      agentId: agent.id,
      quick_start: true
    });
  } catch (error) {
    console.error('Error creating quick-start session:', error);
    res.status(500).json({ error: 'Failed to create quick-start session', details: error.message });
  }
});

export default router;
