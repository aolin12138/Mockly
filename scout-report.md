# Mockly Security Vulnerability Audit Report

**Date:** 2026-07-06  
**Auditor:** Automated security scout  
**Scope:** Full-stack review of Mockly (React 19 + Express 5 + Prisma/PostgreSQL + n8n + ElevenLabs + Judge0)  
**Methodology:** OWASP Top 10 lens applied to 18 source files across frontend, backend, infrastructure

---

## 1. Objective

Perform a security vulnerability audit of the Mockly AI-powered interview practice application, identifying vulnerabilities by severity with concrete file:line references, explanations, and fix recommendations.

## 2. Scope & Method

**Files audited (all 18 specified):**
- `apps/backend/server.js` — entry point, CORS, middleware
- `apps/backend/middleware/authMiddleware.js` — JWT verification
- `apps/backend/routes/authRoutes.js` — login/register
- `apps/backend/routes/interviewRoutes.js` — main session logic (2118 lines)
- `apps/backend/routes/interviewCallbackRoutes.js` — n8n webhook callbacks + SSE (564 lines)
- `apps/backend/routes/integrationRoutes.js` — ElevenLabs key management
- `apps/backend/routes/userRoutes.js` — user profile/sessions
- `apps/backend/routes/codeRunRoutes.js` — Judge0 code execution
- `apps/backend/routes/codeSyncRoutes.js` — code sync
- `apps/backend/routes/testRoutes.js` — test harness endpoints
- `apps/backend/routes/technicalRoutes.js` — technical questions
- `apps/backend/lib/encryption.js` — AES-256-GCM encryption
- `apps/backend/lib/mcp/auth.js` — MCP server auth
- `apps/backend/lib/judge0.js` — Judge0 client
- `apps/backend/prismaClient.js` — Prisma connection
- `apps/backend/prisma/schema.prisma` — DB schema
- `apps/frontend/src/lib/auth.js` — frontend auth helpers
- `apps/frontend/src/component/page/Login.jsx` — login page
- `apps/frontend/src/component/page/Register.jsx` — register page
- `.env.example` — secrets template
- `.env` (discovered, read) — active secrets file
- `apps/backend/.env` (discovered, read) — backend-specific secrets
- `docker-compose.yaml` — container config
- `vite.config.js` — frontend proxy
- `.gitignore` — verified `.env` is excluded

**Key observation:** A real `.env` file with live credentials exists on disk. It IS gitignored (verified via `.gitignore`) and IS flagged as gitignored by `git check-ignore`. However, the `.env.example` template is complete and correct — no secrets are checked into the repo.

---

## 3. Key Findings — Prioritized by Severity

### CRITICAL (5 findings)

#### C1: Weak JWT secret with insecure code-level fallback
- **File:line:** `apps/backend/middleware/authMiddleware.js:17`, `apps/backend/routes/authRoutes.js:48,91`
- **Type:** Weak cryptographic secret / Insecure default
- **Description:** JWT verification uses `process.env.JWT_SECRET || 'your-secret-key'` as a hardcoded fallback. The actual secret in `.env` is `mockly12138` — a 12-character dictionary-word secret trivially brute-forceable. If `JWT_SECRET` is ever unset or misconfigured, the system silently falls back to `'your-secret-key'`, which an attacker would guess immediately. Additionally, `interviewCallbackRoutes.js:36` calls `jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')` for its own token verification path.
- **Impact:** Complete authentication bypass. Any attacker who discovers the secret (or brute-forces it) can forge valid JWTs for any user.
- **Fix:**
  1. Remove the hardcoded fallback — crash at startup if `JWT_SECRET` is not set.
  2. Replace the current secret with a cryptographically random 256+ bit value (e.g., `openssl rand -base64 32`).
  3. Add a startup check: `if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { throw new Error('JWT_SECRET must be at least 32 characters'); }`

#### C2: Database credentials logged in plaintext at startup
- **File:line:** `apps/backend/server.js:27`, `apps/backend/prismaClient.js:12`
- **Type:** Information leakage / Hardcoded secret exposure
- **Description:** Both files log the full `DATABASE_URL` to console at startup. The connection string contains `postgresql://postgres:postgres@localhost:5432/mockly` — username and password in plaintext. These appear in container logs, CI output, and any log aggregation system.
- **Impact:** Anyone with access to server logs (dev, ops, or via log aggregation systems) obtains database credentials.
- **Fix:** Remove the `console.log('DATABASE_URL:', ...)` and `console.log('PrismaClient - DATABASE_URL:', ...)` lines entirely. If connection debugging is needed, log only the host/port, never the full URL. Alternatively, mask the password: `connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')`.

#### C3: Weak/default PostgreSQL credentials in Docker Compose
- **File:line:** `docker-compose.yaml:8-9`
- **Type:** Insecure defaults / Infrastructure misconfiguration
- **Description:** The Docker Compose file hardcodes `POSTGRES_USER=postgres` and `POSTGRES_PASSWORD=postgres`. The database port `5432` is exposed to the host (`ports: "5432:5432"`), meaning anyone on the host network can connect to the database.
- **Impact:** If the Docker host is accessible from a network, the database is open with well-known credentials. An attacker on the same network can connect directly, bypassing application-layer auth entirely.
- **Fix:**
  1. Use environment variable substitution: `POSTGRES_PASSWORD=${DB_PASSWORD}` (read from `.env`).
  2. Remove the port mapping (`ports: "5432:5432"`) — the backend can connect via Docker network without exposing the port.
  3. If local access is needed, bind only to localhost: `"127.0.0.1:5432:5432"`.

#### C4: ElevenLabs platform key and client API keys in `.env` on disk
- **File:line:** `.env:5,11`, `apps/backend/.env:5,11` (identical files)
- **Type:** Hardcoded secret / Secret sprawl
- **Description:** Both `.env` files contain real ElevenLabs API keys (`sk_ada2839...` and platform key `fdb1ed...`), a Gemini API key (`AIzaSyB...`), DeepSeek API key (`sk-c5ae...`), ngrok auth token, n8n API JWT, Judge0 RapidAPI key, and encryption key (`ELEVENLABS_KEY_ENC_KEY`). Any developer with filesystem access, any backup system, and any process running as the user can read these. If the user's machine is ever compromised or an IDE extension exfiltrates files, all keys are exposed.
- **Impact:** Complete compromise of all third-party integrations. An attacker could use ElevenLabs credits (billed to the account), access the Gemini API, use ngrok tunnels, interact with n8n, and run code via Judge0 — all charged to the user.
- **Fix:**
  1. This is an immediate remediation priority — rotate all keys exposed in these files.
  2. Use a secrets manager (e.g., `dotenv-vault`, Doppler, 1Password CLI) or OS-level keychain for local development.
  3. The encryption key (`ELEVENLABS_KEY_ENC_KEY`) should never be stored in the same file as the encrypted data — it defeats the purpose of encryption-at-rest.

#### C5: ElevenLabs encryption key stored alongside encrypted data
- **File:line:** `.env:19` (`ELEVENLABS_KEY_ENC_KEY`), `apps/backend/lib/encryption.js:14`
- **Type:** Cryptographic design flaw
- **Description:** User API keys are encrypted with AES-256-GCM at rest using a key stored in `ELEVENLABS_KEY_ENC_KEY` — the same `.env` file as the encrypted database. An attacker who dumps the database ALSO needs the encryption key, but since the key is in the environment file on the same machine, the encryption adds no real security against server compromise. The `encrypt()` and `decrypt()` functions (`encryption.js:26-59`) are correctly implemented cryptographically (proper IV, auth tag), but the key management undermines them.
- **Impact:** Encryption-at-rest provides no additional protection against a breach of the application server. The defense-in-depth value is zero if the key lives next to the data.
- **Fix:** Use a dedicated key management service (KMS) like AWS KMS, GCP Cloud KMS, or Azure Key Vault. At minimum, store the encryption key in an OS-level secret store, not in the application environment file.

---

### HIGH (7 findings)

#### H1: No rate limiting on authentication endpoints
- **File:line:** `apps/backend/routes/authRoutes.js:10,72`
- **Type:** Missing brute-force protection / OWASP A2
- **Description:** Both `/api/auth/login` and `/api/auth/register` have no rate limiting. An attacker can attempt unlimited login requests per second, brute-forcing passwords or enumerating valid emails (the register endpoint returns a different error for "User already exists" vs. success).
- **Impact:** Credential brute-force, account enumeration. A script can try thousands of passwords per minute. The register endpoint reveals whether an email is already registered (`res.status(409)`).
- **Fix:**
  1. Add `express-rate-limit` middleware: `rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts' })` specifically on auth routes.
  2. Use consistent error messages for login (`"Invalid email or password"` regardless of which is wrong — already done, good).
  3. For register, return a generic success message even if the user exists, but send a verification email instead. If the user already exists, don't reveal that.

#### H2: No server-side password complexity enforcement
- **File:line:** `apps/backend/routes/authRoutes.js:31-33` (password accepted as-is), `apps/frontend/src/component/page/Register.jsx:36-40` (frontend-only check)
- **Type:** Weak password policy / OWASP A2
- **Description:** Password validation happens only in the browser: minimum 8 characters (`Register.jsx:37`) and password confirmation match (`Register.jsx:31-35`). The backend (`authRoutes.js:13-15`) only checks `!email || !password`. An attacker bypassing the frontend (curl, Postman, or a script) can register with a 1-character password. No checks for common passwords, password strength, or character diversity.
- **Impact:** Users can set trivially weak passwords. An attacker registering via API directly can set `"password": "a"`.
- **Fix:**
  1. Add server-side validation in `authRoutes.js` register handler:
     - Minimum 8 characters
     - At least one uppercase, one lowercase, one digit
     - Reject common passwords (check against a top-1000 list)
  2. Consider adding `zxcvbn` password strength estimation.

#### H3: Feedback callback secret has weak default and empty-string fallback
- **File:line:** `apps/backend/routes/interviewRoutes.js:65-66`, `apps/backend/routes/interviewCallbackRoutes.js:421-425`
- **Type:** Insufficient authentication / OWASP A2
- **Description:** The feedback callback endpoint (`POST /session/:sessionId/feedback-callback`) checks `req.get('x-feedback-callback-secret')` against `FEEDBACK_CALLBACK_SECRET`, but `FEEDBACK_CALLBACK_SECRET` defaults to `''` (empty string). If the env var is not set, the check becomes `if ('')` (truthy check passes for the empty string) — any request with a non-empty secret header passes. The actual secret `mockly-feedback-callback-secret` is weak.
- **Impact:** An attacker who discovers the callback URL can inject forged feedback into any session's database by guessing or brute-forcing the weak secret. With the empty-string fallback, if misconfigured, no secret is needed at all.
- **Fix:**
  1. Change logic to: `if (!FEEDBACK_CALLBACK_SECRET) { return res.status(500).json({ error: 'Server not configured' }); }` — refuse to operate without a secret.
  2. Generate a cryptographically random secret (≥32 chars).
  3. Consider using HMAC-signed payloads so the secret isn't sent over the wire.

#### H4: JWT tokens stored in localStorage (XSS-vulnerable)
- **File:line:** `apps/frontend/src/lib/auth.js:21`, `apps/frontend/src/component/page/Login.jsx:47-48`, `apps/frontend/src/component/page/Register.jsx:63-64`
- **Type:** Insecure token storage / OWASP A2
- **Description:** JWT tokens are stored in `localStorage` (`localStorage.setItem('token', data.token)`). localStorage is accessible to any JavaScript running on the same origin, including injected scripts from XSS attacks (e.g., via a compromised npm dependency in the React build).
- **Impact:** Any XSS vulnerability anywhere in the application gives an attacker immediate access to the user's JWT, which is valid for 24 hours. The attacker can make authenticated requests, access all interview data, and potentially read ElevenLabs API keys (exposed via `/api/integrations/elevenlabs/status` which decrypts the key).
- **Fix:**
  1. Use httpOnly, Secure, SameSite cookies for JWT storage instead of localStorage.
  2. Set shorter token lifetimes (15-60 min) with silent refresh via refresh tokens.
  3. Implement token rotation.

#### H5: No security headers set (no Helmet)
- **File:line:** `apps/backend/server.js:1-6` (imports — no Helmet anywhere), `apps/backend/routes/interviewCallbackRoutes.js:293` (SSE with `Access-Control-Allow-Origin: *`)
- **Type:** Missing security headers / OWASP A5
- **Description:** The Express app does not use `helmet` middleware. This means no `X-Content-Type-Options`, no `X-Frame-Options`, no `Strict-Transport-Security`, no `Content-Security-Policy`, no `X-XSS-Protection`, no `Referrer-Policy`. Additionally, SSE endpoints in `interviewCallbackRoutes.js` set `Access-Control-Allow-Origin: *` (line 293, 338), bypassing the main CORS configuration.
- **Impact:** Increased attack surface for clickjacking, MIME-type sniffing, XSS via CSP bypass, MITM downgrade attacks. The SSE endpoints with wildcard CORS allow any website to subscribe to interview session progress/feedback streams.
- **Fix:**
  1. Add `npm install helmet` and `app.use(helmet())` early in the middleware chain.
  2. Configure `helmet()` appropriately for the app (CSP may need tuning for ElevenLabs iframes/scripts).
  3. Replace `Access-Control-Allow-Origin: *` on SSE endpoints with the specific allowed origins from the CORS config, or use `req.headers.origin` validation.

#### H6: CORS SSE bypass with wildcard origin
- **File:line:** `apps/backend/routes/interviewCallbackRoutes.js:293,338`
- **Type:** CORS misconfiguration
- **Description:** The SSE stream endpoints (`/session/:sessionId/stream` and `/session/:sessionId/feedback-stream`) hardcode `'Access-Control-Allow-Origin': '*'` in `res.writeHead()`, bypassing the main CORS configuration in `server.js` which only allows `localhost:5173` and `localhost:5174`. Any website can open an EventSource to these endpoints and receive real-time session data (agent IDs, interview progress, feedback callbacks).
- **Impact:** Cross-origin data leakage. A malicious website can subscribe to SSE streams and capture agent IDs, session progress, and feedback data for any session ID it knows.
- **Fix:** Use the same `allowedOrigins` list as the main CORS config. Read the `Origin` header from the incoming request and validate it against the allowed list before writing the CORS header. Do NOT use `*`.

#### H7: ElevenLabs API key exposure via integration status endpoint
- **File:line:** `apps/backend/routes/integrationRoutes.js:28-52`
- **Type:** Sensitive data exposure via API
- **Description:** The `GET /api/integrations/elevenlabs/status` endpoint decrypts the user's ElevenLabs API key in memory to call the ElevenLabs subscription API. While the key itself isn't returned in the response, any compromise of the server process (memory dump, debugger, logging) exposes the decrypted key. Furthermore, the endpoint makes an authenticated API call on behalf of the user — if the endpoint could be tricked into calling a different endpoint (parameter injection), it could expose more data.
- **Impact:** Medium — the key is only decrypted server-side, but the decryption happens at all. No direct exposure path found, but defense-in-depth recommends minimizing plaintext key lifetime.
- **Fix:** Cache subscription data for 5-15 minutes rather than decrypting and calling ElevenLabs on every dashboard load. This reduces plaintext key exposure and API call volume.

---

### MEDIUM (8 findings)

#### M1: Detailed error messages returned to clients
- **File:line:** `apps/backend/routes/authRoutes.js:69` (`details: error.message`), `apps/backend/routes/interviewRoutes.js:1216` (`details: error.message`), `apps/backend/routes/codeRunRoutes.js:190` (`message: error.message`), and ~15 other locations
- **Type:** Information leakage / OWASP A4
- **Description:** Nearly every error response includes `details: error.message` or `message: error.message`. This can expose internal server details, database errors, file paths, stack traces, and library internals to the client.
- **Impact:** An attacker probing the API can gather intelligence about the server environment, database structure, and internal paths, aiding targeted attacks.
- **Fix:** In production, return generic error messages to clients. Log detailed errors server-side only. Add a production check: `details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'`.

#### M2: Potential SQL injection via `$executeRawUnsafe` with template literals
- **File:line:** `apps/backend/routes/interviewRoutes.js:873-884`
- **Type:** Potential SQL injection (appears currently safe, but fragile pattern)
- **Description:** The temp-to-persisted session promotion uses `prisma.$executeRawUnsafe()` with a template string containing `$1` through `$11` positional parameters. The function IS actually safe because values are passed as parameterized arguments, not interpolated into the SQL string. However, the `Unsafe` suffix in Prisma's API name is a code smell — developers unfamiliar with the pattern might later modify it to use `${}` interpolation, creating a real injection vector.
- **Impact:** Currently LOW (safe use of parameterized query). Future HIGH risk if modified without understanding the parameterization contract.
- **Fix:** Replace with Prisma's typed `prisma.session.update()` — the `temp_` session promotion logic should use Prisma's standard update API instead of raw SQL. If raw SQL is truly needed, use `$queryRaw` with template literal parameters (recommended by Prisma over `$executeRawUnsafe`).

#### M3: No email validation on backend
- **File:line:** `apps/backend/routes/authRoutes.js:13-15`
- **Type:** Weak input validation
- **Description:** The register and login endpoints only check `!email || !password` — no format validation for email. While the frontend uses `<input type="email">` and HTML5 validation, the backend accepts any string as an email. Invalid emails are stored in the database and used for login.
- **Impact:** Low immediate risk (Prisma's `@unique` constraint prevents duplicates), but storing invalid data degrades data quality and could complicate future email-based features.
- **Fix:** Add basic email regex validation on the server: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Consider using a library like `validator` for more thorough validation.

#### M4: No CSRF protection
- **File:line:** `apps/backend/server.js:1-49` (no CSRF middleware), all mutation endpoints
- **Type:** Missing CSRF protection / OWASP A2
- **Description:** The application uses JWT stored in localStorage and sends tokens via `Authorization: Bearer` header. This pattern is inherently CSRF-safe because the browser doesn't automatically attach `Authorization` headers to cross-origin form submissions. HOWEVER, if the app ever transitions to cookie-based auth (recommended for security), CSRF protection would need to be added.
- **Impact:** Currently LOW (JWT in Authorization header is CSRF-safe). Becomes HIGH if auth changes to cookies without adding CSRF tokens.
- **Fix:** If adopting httpOnly cookies for JWT (recommended fix for H4), also add CSRF protection: `csurf` middleware or double-submit cookie pattern.

#### M5: Express body parser set to 50MB — DoS risk
- **File:line:** `apps/backend/server.js:30`
- **Type:** Resource exhaustion / DoS
- **Description:** `express.json({ limit: '50mb' })` allows 50MB request bodies on all routes, including unauthenticated ones (`/api/auth/login`, `/api/auth/register`). An attacker can send many 50MB JSON payloads to exhaust server memory.
- **Impact:** Server memory exhaustion under attack. The auth endpoints (no auth required) are the most vulnerable surface.
- **Fix:**
  1. Reduce the limit to a reasonable size (1-5MB for most endpoints).
  2. Apply per-route body limits where large uploads aren't needed. Auth endpoints should use the Express default (100KB).
  3. Consider streaming-based parsing for the routes that genuinely need large payloads.

#### M6: Full Prisma query logging enabled in development — could leak in production
- **File:line:** `apps/backend/prismaClient.js:15`
- **Type:** Sensitive data in logs
- **Description:** `log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']` — this is correctly gated on `NODE_ENV`. However, if `NODE_ENV` is accidentally set to 'development' in production, all SQL queries (including those with user email addresses, password hashes, and API keys in parameterized values) are logged.
- **Impact:** DATA exposure in log files if deployed with wrong NODE_ENV.
- **Fix:** Add an explicit check at startup: `if (process.env.NODE_ENV !== 'production') { console.warn('Running in non-production mode — queries will be logged'); }`. Additionally, never log full query parameters — use Prisma's `['query']` level carefully.

#### M7: Gemini API key prefixed with `VITE_` — exposed to frontend bundle
- **File:line:** `.env:1` (`VITE_GEMINI_API_KEY`), `.env.example:1`
- **Type:** Accidental secret exposure to browser
- **Description:** `VITE_GEMINI_API_KEY` is prefixed with `VITE_`, which Vite automatically includes in the frontend build (any `VITE_*` env var is embedded in the JavaScript bundle). This means the Gemini API key is shipped to every user's browser. Similarly, `VITE_GOOGLE_AGENT_ID` and `VITE_ELEVENLABS_API_KEY` are exposed.
- **Impact:** Any user can extract the Gemini API key, ElevenLabs API key, and Google Agent ID from the browser's developer tools (Sources tab, or just `console.log(import.meta.env)`). These keys can be used for unauthorized API access, incurring costs to the account holder.
- **Fix:**
  1. Remove the `VITE_` prefix from sensitive keys that should only be server-side.
  2. If the frontend genuinely needs these (e.g., for direct ElevenLabs widget embedding), route through the backend proxy instead.
  3. Never prefix sensitive keys with `VITE_` — this is a well-known footgun in the Vite ecosystem.

#### M8: Hardcoded webhook URLs with UUIDs in source code
- **File:line:** `apps/backend/routes/interviewRoutes.js:43-48`, `apps/backend/routes/interviewCallbackRoutes.js:23`
- **Type:** Configuration in code / OWASP A5
- **Description:** Multiple n8n webhook URLs with UUIDs are hardcoded in the source:
  - `PROMPT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/a24ea15d-...'`
  - `AGENT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/9b19cc19-...'`
  - `TECHNICAL_AGENT_WEBHOOK_URL = 'http://localhost:5678/webhook/84281349-...'`
  These UUIDs represent n8n webhook endpoints. If the n8n instance is ever exposed or the UUIDs are guessable, attackers can trigger webhook calls.
- **Impact:** Any exposure of the UUIDs (e.g., through leaked source code, git history, or client-side error messages) allows unauthorized triggering of webhook workflows. The webhooks use internal localhost URLs, so direct external access is unlikely in current config, but the UUIDs should still be protected.
- **Fix:** Move all webhook URLs (especially the UUID portions) to environment variables. The pattern `FEEDBACK_WEBHOOK_URL` already does this — extend to all webhook URLs.

---

### LOW (5 findings)

#### L1: CORS allows `localhost:5174` — likely dev leftover
- **File:line:** `apps/backend/server.js:20`
- **Type:** Overly permissive CORS
- **Description:** `const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];` — the second origin (5174) is likely a legacy dev port. If deployed to production, this array should only contain the actual production frontend URL.
- **Impact:** Minimal (localhost only), but indicates a pattern of not cleaning up config for deployment.
- **Fix:** Use environment variable for allowed origins: `const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];`

#### L2: No password attempt tracking or account lockout
- **File:line:** `apps/backend/routes/authRoutes.js:72-107` (login) — no attempt counting
- **Type:** Missing brute-force mitigation
- **Description:** After implementing rate limiting (H1), account-level lockout provides additional defense. Currently, even with IP-based rate limiting, a distributed attack can circumvent IP limits.
- **Impact:** Combined with the weak JWT secret (C1), distributed brute-force attacks remain possible.
- **Fix:** Add `failedLoginAttempts` and `lockedUntil` fields to the User model. After 5 consecutive failed attempts, lock the account for 15 minutes.

#### L3: JWT expiry is 24 hours with no refresh mechanism
- **File:line:** `apps/backend/routes/authRoutes.js:50,93` (`expiresIn: '24h'`)
- **Type:** Long-lived token without rotation
- **Description:** JWTs are issued with 24-hour expiry and no refresh token. Once issued, a token cannot be revoked until it expires (24 hours later). If a token is stolen, the attacker has a full day of access.
- **Impact:** Extended attack window after token theft.
- **Fix:** Implement refresh token flow: access tokens expire in 15 minutes, refresh tokens (stored in DB, httpOnly cookie) allow silent renewal.

#### L4: No timeout on SSE connections — potential resource leak
- **File:line:** `apps/backend/routes/interviewCallbackRoutes.js:285-325` (SSE stream), `apps/backend/routes/interviewCallbackRoutes.js:327-370` (feedback stream)
- **Type:** Resource management
- **Description:** SSE connections have keep-alive pings every 15 seconds but no absolute timeout. A client that stays connected indefinitely holds a connection and the associated `res` object in memory. The `sseClients` and `feedbackSseClients` Maps could accumulate disconnected clients.
- **Impact:** Memory leak over long periods. Eventual server slowdown.
- **Fix:** Add a 5-minute absolute timeout after which SSE connections are closed with an appropriate event. Also implement a periodic cleanup of stale clients in the Map.

#### L5: Console-based logging throughout production code
- **File:line:** Throughout all backend files — 50+ `console.log()` calls
- **Type:** Logging hygiene
- **Description:** All logging uses `console.log()` and `console.error()` with no structured logging, log levels, or production filtering. Sensitive data (user IDs, session IDs, configuration values) appears in logs.
- **Impact:** Debugging is harder in production. Sensitive data in unstructured logs is harder to audit and redact.
- **Fix:** Adopt a structured logging library (e.g., `pino` or `winston`). Configure log levels by environment. Redact PII/sensitive fields in log output.

---

## 4. Codebase Structure Notes

| Component | Tech | Auth Mechanism |
|-----------|------|---------------|
| Backend | Express 5 | JWT in `Authorization: Bearer` header (authMiddleware.js) |
| Frontend | React 19 + Vite | localStorage token (auth.js), redirect on 401 |
| Database | PostgreSQL 16 via Prisma | Connection string in DATABASE_URL |
| External: ElevenLabs | REST API | User-provided key, encrypted at rest (AES-256-GCM) |
| External: Judge0 | RapidAPI | API key in server env |
| External: n8n | Webhook calls | No auth on webhooks (UUID-based), shared secret on feedback callback |
| MCP Server | Custom | X-MCP-Shared-Secret header (shared secret) |
| Test Harness | Custom | X-Test-API-Key header (shared secret) |

**Auth flow:** Register/Login → JWT returned → stored in localStorage → sent as `Bearer` header → `authMiddleware` verifies.

**Trust boundaries:**
1. Browser ↔ Backend API (JWT, HTTPS)
2. Backend ↔ n8n (webhook calls, localhost — trusted)
3. Backend ↔ ElevenLabs (API key, HTTPS)
4. Backend ↔ Judge0 (RapidAPI key, HTTPS)
5. n8n ↔ Backend (feedback callback, shared secret)
6. ElevenLabs Agent ↔ MCP Server (shared secret, ngrok tunnel)

## 5. Code That Is Well-Implemented

To avoid a purely negative report, these security practices ARE correctly implemented:

1. **AES-256-GCM encryption (`encryption.js`):** Cryptographically correct — random IV per encryption, auth tag verification, proper buffer handling. The implementation is sound; the key management (C5) is the problem.

2. **Login error message consistency (`authRoutes.js:83,93`):** Both "user not found" and "wrong password" return the same `"Invalid email or password"` error, preventing user enumeration.

3. **Prisma parameterized queries:** With one exception (the `$executeRawUnsafe` noted in M2), all database queries use Prisma's type-safe API, eliminating SQL injection risk.

4. **Interview session ownership verification:** `codeSyncRoutes.js:38-41` explicitly checks `sessionId` + `userId` to ensure users can only update their own sessions.

5. **Feedback callback secret verification:** The feedback callback endpoint (`interviewCallbackRoutes.js:421-425`) validates a shared secret header — specifically excluding the auth middleware that would require JWT — which is appropriate for server-to-server callbacks.

6. **Proper `.gitignore` configuration:** `.env` and `.env.*` are correctly excluded from version control. `.env.example` is explicitly included.

7. **JWT token verification validates `decoded.userId` existence:** `authMiddleware.js:22-25` checks `!decoded?.userId` and rejects tokens missing the userId claim.

---

## 6. Risks, Unknowns, and Open Questions

1. **n8n security posture unknown:** n8n is assumed to run on localhost and is treated as trusted. If n8n were ever exposed to the internet or compromised, all webhook endpoints become attack vectors. There is no input validation on data received FROM n8n webhook responses (parse errors are silently caught).

2. **ngrok tunnel security:** The MCP public URL uses ngrok (`bobcat-nacho-sustainer.ngrok-free.dev`). The ngrok auth token is in `.env`. ngrok free tier tunnels have no authentication beyond the shared secret header, and ngrok itself sees all traffic. Consider Cloudflare Tunnel or a proper reverse proxy for production.

3. **ElevenLabs conversation data:** The application fetches full conversation transcripts and audio from ElevenLabs (`interviewRoutes.js:1460-1485`). These are stored in the database as JSON and forwarded to n8n for feedback generation. Privacy implications for interview candidates — is this disclosed?

4. **Judge0 code execution sandboxing:** Code submitted to Judge0 is executed on a third-party service. While Judge0 is designed for code execution, there's no server-side validation of the code content before submission. Users could potentially use the service for cryptocurrency mining or other abuse.

5. **No WebSocket auth validation:** Noted that `Access-Control-Allow-Origin: *` on SSE endpoints could be extended to WebSocket connections. Verify that any WebSocket endpoints (if added later) implement proper origin/auth checks.

6. **Database schema lacks audit trail:** No soft-delete, no modification tracking, no audit log for sensitive operations (ElevenLabs key storage, password changes). GDPR compliance may require this.

---

## 7. Citations

All findings are traceable to specific file:line references in the body of each finding. Key files:

| File | Key Findings |
|------|-------------|
| `apps/backend/.env` | C4 (all hardcoded secrets), M7 (VITE_ prefix exposure) |
| `apps/backend/server.js:27,30` | C2 (DB URL in logs), M5 (50MB body limit), H5 (no Helmet) |
| `apps/backend/middleware/authMiddleware.js:17` | C1 (weak JWT secret fallback) |
| `apps/backend/routes/authRoutes.js:13-15,31-33` | H2 (no password validation), M3 (no email validation) |
| `apps/backend/routes/interviewRoutes.js:65-66` | H3 (weak feedback callback secret) |
| `apps/backend/routes/interviewCallbackRoutes.js:293,338` | H6 (SSE wildcard CORS) |
| `apps/backend/routes/integrationRoutes.js:28-52` | H7 (API key decryption on every status call) |
| `apps/frontend/src/lib/auth.js:21` | H4 (JWT in localStorage) |
| `apps/backend/lib/encryption.js:14` | C5 (encryption key alongside encrypted data) |
| `docker-compose.yaml:8-9` | C3 (default postgres credentials) |
| `apps/backend/prismaClient.js:12` | C2 (DB URL in logs) |

---

## Summary

| Severity | Count | Top Priority |
|----------|-------|-------------|
| CRITICAL | 5 | Rotate all keys, fix JWT secret, remove DB URL logging |
| HIGH | 7 | Rate limiting, password policy, security headers, move JWT to cookies |
| MEDIUM | 8 | Stop leaking internal errors, fix CORS on SSE, remove VITE_ prefix from keys |
| LOW | 5 | Structured logging, SSE timeouts, CORS cleanup |

**Immediate actions (today):**
1. Rotate ALL API keys exposed in `.env` files (Gemini, ElevenLabs, DeepSeek, Judge0, ngrok, n8n)
2. Replace `JWT_SECRET` with a strong random value and remove the `|| 'your-secret-key'` fallback
3. Remove `console.log(DATABASE_URL)` from both `server.js` and `prismaClient.js`
4. Change PostgreSQL password from `postgres` and stop exposing port 5432

**Next actions (this week):**
5. Add `express-rate-limit` on auth routes
6. Add server-side password validation
7. Install and configure `helmet`
8. Move JWTs from localStorage to httpOnly cookies with CSRF protection
9. Remove `VITE_` prefix from sensitive environment variables
