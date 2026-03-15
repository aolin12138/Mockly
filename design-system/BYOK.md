# Mockly BYOK (Bring Your Own ElevenLabs Key) — Overall Workflow Plan

## Objective

Allow users to use their own ElevenLabs API key (BYOK) so:
- Mockly does not pay ongoing usage costs
- Users control their own ElevenLabs limits
- API keys are securely stored and never exposed after initial submission

---

# 0. One-Time System Setup

## Database
Add `ElevenLabsIntegration` (1:1 with User):

- userId (unique)
- apiKeyCiphertext (Bytes)
- apiKeyIv (Bytes)
- apiKeyTag (Bytes)
- apiKeyLast4 (String)
- verifiedAt (DateTime)
- lastUsedAt (DateTime?)
- createdAt / updatedAt

## Environment Variables

Backend:
- ELEVENLABS_KEY_ENC_KEY (32-byte base64 AES-256 key)
- N8N_INTERNAL_SECRET (shared secret for backend → n8n auth)

n8n:
- N8N_INTERNAL_SECRET (same value as backend)

---

# 1. Dashboard Load Flow

## 1.1 User logs in
Frontend → Backend:
GET /api/integrations/elevenlabs/status

Backend logic:
- If integration row exists → return connected=true + last4 + verifiedAt
- Else → return connected=false

Frontend renders:

### If NOT connected:
- Banner: “ElevenLabs not connected”
- Allow 1 demo behavioural session
- Show “Connect ElevenLabs” button

### If connected:
- Banner: “Connected (••••AB12)”
- Buttons: Replace key / Disconnect

---

# 2. Connect Key Flow (Atomic Verify + Save)

## 2.1 User pastes API key

Frontend:
POST /api/integrations/elevenlabs/connect
Body: { apiKey }

Show spinner: “Verifying…”

## 2.2 Backend logic

1. Validate non-empty key
2. Call lightweight ElevenLabs endpoint with:
   Header: xi-api-key: apiKey
3. If response 200:
   - Encrypt apiKey using AES-256-GCM
   - Store ciphertext + iv + tag
   - Store last4
   - Set verifiedAt = now
   - Return { ok: true, last4, verifiedAt }
4. If fail:
   - Do NOT store
   - Return { ok: false, message }

## 2.3 Frontend result

If success:
- Show “Connected (••••AB12)”
- Hide input

If fail:
- Show inline error
- Provide link to tutorial page

---

# 3. Tutorial Page Flow

Steps shown to user:

1. Create ElevenLabs account
2. Go to API Keys page
3. Generate restricted API key
4. Copy key
5. Paste into Mockly
6. Click “Verify & Save”

Warnings:
- “Treat API key like a password”
- “You can revoke it anytime in ElevenLabs”

---

# 4. Start Interview Flow (Verified User)

## 4.1 User clicks “Start Interview”

Frontend:
POST /api/interviews/prepare
Body: { interviewType, questionId?, config }

## 4.2 Backend logic

1. Authenticate user
2. Check ElevenLabsIntegration:
   - If exists → proceed
   - If not:
       - If behavioural + demoCredits > 0 → allow demo
       - Else → return 403 (require connection)

3. If verified:
   - Decrypt api key in memory
   - Call n8n webhook

Backend → n8n:
Headers:
- X-INTERNAL-SECRET: <shared secret>
- X-ELEVENLABS-KEY: <decrypted key>

Body:
- userId
- interviewType
- promptSpec
- sessionId

## 4.3 n8n workflow

1. Verify X-INTERNAL-SECRET
2. Read key from header:
   {{$headers["x-elevenlabs-key"]}}
3. Use key in ElevenLabs API calls:
   Header: xi-api-key: <value>
4. Configure agent / update prompt
5. Return { agentId }

IMPORTANT:
- Do NOT copy key into $json
- Do NOT log headers
- Minimize execution data retention

## 4.4 Backend receives response

- Save session with agentId
- Return { agentId, sessionId }

## 4.5 Frontend

Call:
startConversation({ agentId })

---

# 5. Demo Behavioural Session Flow (No Key)

If no integration exists:

Backend logic:
- If interviewType === Behavioural
- AND demoBehaviouralCredits > 0:
    - decrement credit
    - use platform ElevenLabs key
- Else:
    - return error: “Connect ElevenLabs”

Demo enforcement must be server-side.

---

# 6. Disconnect / Replace Flow

## Disconnect
DELETE /api/integrations/elevenlabs
- Delete integration row

## Replace
Same as connect:
- Verify new key
- Overwrite stored encrypted key

---

# 7. Security Model

## Key Security Guarantees

- API key never stored in plaintext
- API key never returned after save
- API key never stored in browser
- API key only decrypted in backend memory during prepare step
- Key sent to n8n server-to-server only

## Risk Acknowledgement (n8n Cloud)

- Execution logs may store request metadata
- Minimize logging and data retention
- Future improvement: move ElevenLabs API calls to backend entirely

---

# 8. Acceptance Criteria

- User can connect key in <30 seconds
- Invalid keys are rejected and not stored
- Sessions require verified key (except demo)
- Interview preparation works end-to-end
- Key is encrypted at rest
- Key is never exposed to frontend after initial submission

---

# Final System Summary

User → Backend (secure storage + auth)
Backend → n8n (server-to-server)
n8n → ElevenLabs (using user key)
Frontend → ElevenLabs SDK (startConversation)

No secrets ever live in the browser beyond initial paste.
Encrypted at rest.
Decrypted only in backend memory.