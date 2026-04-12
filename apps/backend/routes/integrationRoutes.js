import express from 'express';
import { prisma } from '../prismaClient.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const router = express.Router();

// Tier → included agent minutes per month
const TIER_MINUTES = {
  free: 15,
  trial: 15,
  starter: 50,
  creator: 250,
  pro: 1100,
  growing_business: 4500,
  scale: 4500,
  scale_2024_08_10: 4500,
  business: 11500,
  enterprise: 99999,
};

/**
 * GET /api/integrations/elevenlabs/status
 * Returns connection status + live subscription data from ElevenLabs.
 * Called on every dashboard load to keep usage data fresh.
 */
router.get('/elevenlabs/status', async (req, res) => {
  const userId = req.userId;

  try {
    const integration = await prisma.elevenLabsIntegration.findUnique({
      where: { userId }
    });

    if (!integration) {
      return res.json({ connected: false });
    }

    // Decrypt the API key in memory
    let apiKey;
    try {
      apiKey = decrypt(integration.apiKeyCiphertext, integration.apiKeyIv, integration.apiKeyTag);
    } catch (err) {
      console.error('Failed to decrypt ElevenLabs API key:', err.message);
      return res.json({
        connected: true,
        last4: integration.apiKeyLast4,
        verifiedAt: integration.verifiedAt,
        error: 'Failed to decrypt stored key'
      });
    }

    // Fetch live subscription data from ElevenLabs
    try {
      const client = new ElevenLabsClient({ apiKey });
      const subscription = await client.user.subscription.get();

      // Debug: log the subscription object keys to verify property names
      console.log('📊 ElevenLabs subscription keys:', Object.keys(subscription));
      console.log('📊 character_count:', subscription.character_count, '| characterCount:', subscription.characterCount);
      console.log('📊 character_limit:', subscription.character_limit, '| characterLimit:', subscription.characterLimit);

      const nextResetUnix = subscription.next_character_count_reset_unix ?? subscription.nextCharacterCountResetUnix;

      const charCount = Number(subscription.character_count ?? subscription.characterCount ?? 0);
      const charLimit = Number(subscription.character_limit ?? subscription.characterLimit ?? 0);

      // Estimate minutes from consumed credits (chars). 14,000 credits ~= 35 mins => 400 chars per minute.
      const CREDITS_PER_MINUTE = 400;
      const tier = subscription.tier;
      const minutesUsed = charCount > 0 ? (charCount / CREDITS_PER_MINUTE) : 0;
      const tierMinutesLimit = TIER_MINUTES[tier] || TIER_MINUTES.free;
      const characterMinutesLimit = charLimit > 0 ? (charLimit / CREDITS_PER_MINUTE) : 0;
      const minutesLimit = Math.max(tierMinutesLimit, characterMinutesLimit);
      const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);
      // Average mock interview is ~20–30 min, use 25 min as estimate
      const estimatedSessions = Math.floor(minutesRemaining / 25);

      // Update lastUsedAt
      await prisma.elevenLabsIntegration.update({
        where: { userId },
        data: { lastUsedAt: new Date() }
      });

      return res.json({
        connected: true,
        last4: integration.apiKeyLast4,
        verifiedAt: integration.verifiedAt,
        tier,
        characterCount: charCount,
        characterLimit: charLimit,
        minutesUsed: Math.round(minutesUsed * 10) / 10,
        minutesLimit,
        minutesRemaining: Math.round(minutesRemaining * 10) / 10,
        estimatedSessions,
        nextResetUnix: nextResetUnix || null,
      });
    } catch (err) {
      console.error('Failed to fetch ElevenLabs subscription:', err.message);
      // Key might have been revoked on ElevenLabs side
      return res.json({
        connected: true,
        last4: integration.apiKeyLast4,
        verifiedAt: integration.verifiedAt,
        error: 'Failed to fetch subscription data — key may be invalid'
      });
    }
  } catch (error) {
    console.error('Error fetching integration status:', error);
    res.status(500).json({ error: 'Failed to fetch integration status', details: error.message });
  }
});

/**
 * POST /api/integrations/elevenlabs/connect
 * Verify an ElevenLabs API key using the SDK, then encrypt and store it.
 * Body: { apiKey: string }
 */
router.post('/elevenlabs/connect', async (req, res) => {
  const userId = req.userId;
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ ok: false, message: 'API key is required' });
  }

  const trimmedKey = apiKey.trim();

  // Verify the key by calling ElevenLabs subscription endpoint
  let subscription;
  try {
    const client = new ElevenLabsClient({ apiKey: trimmedKey });
    subscription = await client.user.subscription.get();
  } catch (err) {
    console.error('ElevenLabs key verification failed:', err.message);
    return res.status(400).json({
      ok: false,
      message: 'Invalid API key — verification with ElevenLabs failed'
    });
  }

  // Key is valid — encrypt and store
  try {
    const { ciphertext, iv, tag } = encrypt(trimmedKey);
    const last4 = trimmedKey.slice(-4);
    const now = new Date();

    await prisma.elevenLabsIntegration.upsert({
      where: { userId },
      update: {
        apiKeyCiphertext: ciphertext,
        apiKeyIv: iv,
        apiKeyTag: tag,
        apiKeyLast4: last4,
        verifiedAt: now
      },
      create: {
        userId,
        apiKeyCiphertext: ciphertext,
        apiKeyIv: iv,
        apiKeyTag: tag,
        apiKeyLast4: last4,
        verifiedAt: now
      }
    });

    return res.json({
      ok: true,
      last4,
      verifiedAt: now,
      tier: subscription.tier,
      characterCount: subscription.character_count ?? subscription.characterCount ?? 0,
      characterLimit: subscription.character_limit ?? subscription.characterLimit ?? 0
    });
  } catch (error) {
    console.error('Error storing ElevenLabs integration:', error);
    return res.status(500).json({ ok: false, message: 'Failed to store API key' });
  }
});

/**
 * DELETE /api/integrations/elevenlabs
 * Disconnect — remove the stored API key entirely.
 */
router.delete('/elevenlabs', async (req, res) => {
  const userId = req.userId;

  try {
    await prisma.elevenLabsIntegration.delete({
      where: { userId }
    });
    return res.json({ ok: true });
  } catch (error) {
    // If row doesn't exist, that's fine
    if (error.code === 'P2025') {
      return res.json({ ok: true });
    }
    console.error('Error deleting integration:', error);
    return res.status(500).json({ ok: false, message: 'Failed to disconnect' });
  }
});

export default router;
