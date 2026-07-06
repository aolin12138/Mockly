# Mockly — Deployment Security Checklist

> **Goal:** Deploy Mockly with minimal security risk. Every item must be verified before go-live.
> **Generated:** 2026-07-06 | **Based on:** 25 code findings + 18 dependency vulns + OWASP Top 10 2025

---

## Phase 1: Secrets & Credentials (BLOCKS DEPLOYMENT)

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 1.1 | **Rotate all API keys** exposed in `.env` files (Gemini, ElevenLabs, DeepSeek, Judge0 RapidAPI, ngrok, n8n) | You | ☐ |
| 1.2 | **Generate new JWT_SECRET** — `openssl rand -base64 32` — and set in production env | You | ☐ |
| 1.3 | **Generate new FEEDBACK_CALLBACK_SECRET** — `openssl rand -base64 32` | You | ☐ |
| 1.4 | **Generate new MCP_SHARED_SECRET** — `openssl rand -base64 32` | You | ☐ |
| 1.5 | **Generate new ELEVENLABS_KEY_ENC_KEY** — `openssl rand -base64 32` | You | ☐ |
| 1.6 | **Set strong PostgreSQL password** (not `postgres`) | You | ☐ |
| 1.7 | **Remove `|| 'your-secret-key'` fallbacks** from all JWT verification code | Code fix | ☐ |
| 1.8 | **Move webhook UUIDs** to environment variables | Code fix | ☐ |
| 1.9 | **Remove `VITE_` prefix** from `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `GOOGLE_AGENT_ID` | Code fix | ☐ |
| 1.10 | **Verify no `.env` files are tracked in git**: `git ls-files | grep "\.env"` should only show `.env.example` | You | ☐ |

---

## Phase 2: Backend Hardening

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 2.1 | **Remove `console.log(DATABASE_URL)`** from `server.js:27` and `prismaClient.js:12` | Code fix | ☐ |
| 2.2 | **Install and configure `helmet`** for security headers (CSP, HSTS, X-Frame-Options, etc.) | Code fix | ☐ |
| 2.3 | **Add rate limiting** on `/api/auth/login` and `/api/auth/register` (e.g., 10 req/15min) | Code fix | ☐ |
| 2.4 | **Add server-side password validation**: min 8 chars, uppercase, lowercase, digit | Code fix | ☐ |
| 2.5 | **Replace `$executeRawUnsafe`** with Prisma typed update in `interviewRoutes.js` | Code fix | ☐ |
| 2.6 | **Reduce body parser limit**: 50MB → 5MB global, 100KB on unauthenticated routes | Code fix | ☐ |
| 2.7 | **Add email format validation** on backend (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) | Code fix | ☐ |
| 2.8 | **Sanitize error messages**: Don't leak `error.message` to clients in production | Code fix | ☐ |
| 2.9 | **Add `NODE_ENV` startup check**: crash if `production` but secrets are weak/default | Code fix | ☐ |
| 2.10 | **Configure CORS for production domain** (not just localhost) | Code fix | ☐ |

---

## Phase 3: Frontend Hardening

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 3.1 | **Migrate JWT from localStorage to httpOnly cookie** (eliminates XSS token theft) | Code fix | ☐ |
| 3.2 | **Add CSRF protection** (needed after cookie migration — double-submit cookie pattern) | Code fix | ☐ |
| 3.3 | **Add Content-Security-Policy** to restrict script sources | Code fix | ☐ |
| 3.4 | **Remove hardcoded `localhost:3000`** from Login.jsx — use `VITE_API_BASE_URL` or relative URL | Code fix | ☐ |
| 3.5 | **Configure `VITE_API_BASE_URL`** for production | You | ☐ |

---

## Phase 4: Database & Infrastructure

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 4.1 | **PostgreSQL**: Use strong password via env var, not `postgres:postgres` | You | ☐ |
| 4.2 | **PostgreSQL**: Do NOT expose port 5432 to the internet. Bind to `127.0.0.1` or Docker network only | You | ☐ |
| 4.3 | **PostgreSQL**: Enable SSL/TLS for database connections (`?sslmode=require` in DATABASE_URL) | You | ☐ |
| 4.4 | **Docker**: Don't run containers as root — add `user: "1000:1000"` or similar | You | ☐ |
| 4.5 | **Docker**: Use read-only root filesystem where possible (`read_only: true`) | You | ☐ |
| 4.6 | **nginx/reverse proxy**: Terminate TLS with Let's Encrypt. Redirect HTTP → HTTPS | You | ☐ |
| 4.7 | **nginx/reverse proxy**: Set `X-Forwarded-For`, rate limit, and request size limits | You | ☐ |
| 4.8 | **nginx/reverse proxy**: Block access to `/mcp`, `/api/test` from public internet (internal only) | You | ☐ |

---

## Phase 5: n8n Workflow Security

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 5.1 | **Enable n8n authentication**: Require login (not open access) | You | ☐ |
| 5.2 | **Move n8n webhook UUIDs** to environment variables | Code fix | ☐ |
| 5.3 | **Add authentication to n8n webhooks**: Use `FEEDBACK_CALLBACK_SECRET` pattern for ALL webhooks | Code fix | ☐ |
| 5.4 | **Use HTTPS for all n8n communication** (no `http://localhost`) | You | ☐ |
| 5.5 | **Review n8n workflows** for hardcoded credentials in webhook nodes | You | ☐ |
| 5.6 | **Enable n8n execution timeouts** to prevent runaway workflows | You | ☐ |

---

## Phase 6: Monitoring & Observability

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 6.1 | **Set up structured logging** (pino/winston) with log levels | Code fix | ☐ |
| 6.2 | **Configure production log level** (info+, no debug/query logs in production) | You | ☐ |
| 6.3 | **Set up alerting** for: failed login spikes, 5xx error rate spikes, unusual API usage | You | ☐ |
| 6.4 | **Configure health check endpoint** (`/health`) for load balancer/monitoring | Code fix | ☐ |
| 6.5 | **Set up database backups** with encryption at rest | You | ☐ |

---

## Phase 7: Dependency Security

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 7.1 | **Run `npm audit fix`** to auto-patch non-breaking vulnerabilities | Code fix | ☐ |
| 7.2 | **Review remaining `npm audit` findings** — accept risk or manually fix | You | ☐ |
| 7.3 | **Run `npm audit` in CI/CD** on every PR | You | ☐ |
| 7.4 | **Pin dependency versions** (`package-lock.json` is committed — verify) | You | ☐ |

---

## Phase 8: Pre-Launch Verification

| # | Item | Owner | Verified |
|---|------|-------|----------|
| 8.1 | **Run test suite** (18 scenarios) — all passing? | You | ☐ |
| 8.2 | **Smoke test auth flow**: register → login → start interview → get feedback | You | ☐ |
| 8.3 | **Verify rate limiting works**: 11 login attempts in 15 min → blocked | You | ☐ |
| 8.4 | **Verify security headers present**: Check with https://securityheaders.com | You | ☐ |
| 8.5 | **Verify HTTPS enforced**: HTTP requests redirect to HTTPS | You | ☐ |
| 8.6 | **Verify CORS**: Requests from unauthorized origins are rejected | You | ☐ |
| 8.7 | **Scan with Mozilla Observatory**: https://observatory.mozilla.org | You | ☐ |

---

## OWASP Top 10 2025 Coverage

| OWASP Risk | Status | Covered By |
|-----------|--------|-----------|
| A01: Broken Access Control | ✅ Protected | JWT auth middleware on all API routes, session ownership checks |
| A02: Cryptographic Failures | 🔧 Fixing | Strengthening JWT secret, proper password hashing, KMS for encryption keys |
| A03: Injection | ✅ Protected | Prisma ORM (parameterized), replacing `$executeRawUnsafe` |
| A04: Insecure Design | 🔧 Fixing | Rate limiting, password policy, n8n webhook auth |
| A05: Security Misconfiguration | 🔧 Fixing | Helmet, CSP, CORS hardening, body limits, error sanitization |
| A06: Vulnerable Components | 🔧 Fixing | npm audit fix, dependency pinning |
| A07: Auth Failures | 🔧 Fixing | JWT hardening, password validation, account lockout |
| A08: Software/Data Integrity | ✅ OK | package-lock.json committed |
| A09: Logging & Monitoring | 🔧 Adding | Structured logging, alerting |
| A10: SSRF | ⚠️ Review | n8n webhook calls, ElevenLabs API — risk is low (outbound only) |

---

**Legend:** ☐ = Not done | ✅ = Verified | 🔧 = In progress | ⚠️ = Needs review
