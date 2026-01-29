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

// Prompt route to fetch prompts from n8n webhook
router.post('/prompt', async (req, res) => {
  console.log("Request received at /prompt");

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

  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

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
    // Add userId to the config
    interviewConfig.userId = userId;

    console.log("----- SENDING JSON PAYLOAD TO WEBHOOK -----");
    console.log(JSON.stringify(interviewConfig, null, 2));
    console.log("-------------------------------------------");

    const response = await fetch('https://aolin12138.app.n8n.cloud/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(interviewConfig),
    });

    if (!response.ok) {
      throw new Error(`External webhook failed with status: ${response.status}`);
    }

    const data = await response.json();

    // Handle agent creation if webhook returned an agent ID
    if (!interviewConfig.agent_id && data.agent_id) {
      try {
        agent = await prisma.agent.create({
          data: {
            id: data.agent_id, // Use the agent ID returned from ElevenLabs
            userId: userId
          }
        });
        console.log(`Created new agent record with ID: ${agent.id} for user: ${userId}`);
        interviewConfig.agent_id = data.agent_id;
      } catch (error) {
        console.error("Error creating agent record after webhook response:", error);
        return res.status(500).json({ error: 'Failed to create agent session', details: error.message });
      }
    }

    // We expect to receive two prompts.
    console.log("----- WEHOOK RESPONSE (PROMPTS) -----");
    console.log(JSON.stringify(data, null, 2));
    console.log("-------------------------------------");

    res.json(data);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts', details: error.message });
  }
});

export default router;
