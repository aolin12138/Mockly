# Mockly - AI-Powered Mock Interview Platform

Mockly is a full-stack web application that enables users to practice behavioural and technical coding interviews through AI-powered mock sessions. It uses Google Gemini agents for behavioural interview conversations, ElevenLabs for real-time voice synthesis, and Judge0 for sandboxed code execution during technical interviews.

---

## Tech Stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Frontend   | React 19, Vite 7, Tailwind CSS 4, React Router, Three.js, Recharts |
| Backend    | Node.js (Express 5), Prisma ORM 7                                 |
| Database   | PostgreSQL 16 (via Docker)                                        |
| AI/Agents  | Google Gemini (conversational agents), ElevenLabs (voice TTS)     |
| Code Exec  | Judge0 CE (sandboxed code runner via RapidAPI)                    |
| Infra      | Docker Compose (database), Vite dev server (frontend)             |

---

## Project Structure

```
Mockly/
+-- apps/
|   +-- backend/                  # Express API server
|   |   +-- lib/                  # Utilities (encryption, Judge0 client, code harnesses)
|   |   |   +-- harness/          # Language-specific test harnesses (JS, Python, Java)
|   |   +-- middleware/           # JWT auth middleware
|   |   +-- prisma/               # Prisma schema, migrations, seed data
|   |   +-- prompts/              # Company profiles & role rubrics (JSON)
|   |   +-- routes/               # API route handlers
|   |   +-- server.js             # Express app entry point
|   |   +-- package.json          # Backend-specific dependencies
|   +-- frontend/                 # React SPA
|       +-- src/
|           +-- component/
|           |   +-- page/         # Page components (Home, Dashboard, Interview, Results...)
|           |   +-- results/      # Results sub-components (radar charts, audio player...)
|           |   +-- ui/           # Shared UI components (Modal, Toast, Waveform, Orb...)
|           +-- context/          # React context (ThemeContext)
|           +-- data/             # Mock data for dashboard
|           +-- lib/              # Auth helpers, utility functions
|           +-- main.jsx          # App entry point & route definitions
|           +-- App.jsx           # Interview setup flow component
|           +-- index.css         # Global styles (Tailwind)
+-- Mockly/                       # Prompt engineering & test artifacts
|   +-- prompts/                  # System prompt templates for all interview modes
|   +-- test/                     # Generated test outputs & evaluation reports
|   +-- presets.company_profile.json
|   +-- presets.role_rubric.json
+-- design-system/                # Design documentation
|   +-- BYOK.md                   # Bring-Your-Own-Key workflow plan
|   +-- mockly-setup/             # Setup plans & master design doc
+-- public/                       # Static assets (favicon)
+-- .github/                      # Issue & PR templates
+-- docker-compose.yaml           # PostgreSQL database container
+-- package.json                  # Root dependencies & scripts
+-- vite.config.js                # Vite configuration with path aliases & proxy
+-- index.html                    # HTML entry point
+-- .env.example                  # Environment variable template
+-- technical_plan.md             # Technical interview feature specification
```

---

## Prerequisites

- **Node.js** >= 22.12.0
- **npm** (comes with Node.js)
- **Docker** & **Docker Compose** (for PostgreSQL database)
- **Git**

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable                        | Required | Description                                         |
|---------------------------------|----------|-----------------------------------------------------|
| `DATABASE_URL`                  | Yes      | PostgreSQL connection string (see below)             |
| `JWT_SECRET`                    | Yes      | Secret key for JWT token signing                     |
| `VITE_GEMINI_API_KEY`           | Yes      | Google Gemini API key for behavioural interviews     |
| `VITE_GOOGLE_AGENT_ID`          | Yes      | Google AI agent ID for behavioural interview agent   |
| `VITE_ELEVENLABS_API_KEY`       | Optional | ElevenLabs API key (for voice features)              |
| `VITE_API_BASE_URL`             | Yes      | Backend API URL (default: `http://localhost:3000`)   |
| `RAPIDAPI_KEY`                  | Yes*     | RapidAPI key for Judge0 (technical interviews)       |
| `RAPIDAPI_HOST`                 | Yes*     | RapidAPI host for Judge0                             |
| `TECHNICAL_INTERVIEW_AGENT_ID`  | Optional | Agent ID for technical interview AI                  |
| `FEEDBACK_WEBHOOK_URL`          | Optional | n8n webhook URL for feedback processing              |
| `FEEDBACK_CALLBACK_BASE_URL`    | Optional | Callback base URL for feedback                       |
| `FEEDBACK_CALLBACK_SECRET`      | Optional | Secret for feedback callback auth                    |

*Required only for technical interview code execution features.

If using the Docker Compose database setup, use:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mockly
```

---

## Setup & Installation

### 1. Start the Database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432 with database `mockly`.

### 2. Install Dependencies

```bash
# Install root (frontend) dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install
cd ../..
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This applies all Prisma migrations to create the database schema (Users, Agents, Sessions, Questions, ElevenLabsIntegration tables).

### 4. Seed the Database (Optional)

```bash
npm run db:seed
```

Seeds the database with sample technical interview questions.

### 5. Start the Application

Open **two terminals**:

**Terminal 1 - Backend API server:**
```bash
npm start
```
Starts the Express server on `http://localhost:3000`.

**Terminal 2 - Frontend dev server:**
```bash
npm run dev
```
Starts the Vite dev server on `http://localhost:5173`.

Open `http://localhost:5173` in your browser.

---

## Key Features

### Behavioural Interviews
- AI-powered conversational mock interviews using Google Gemini agents
- Real-time voice interaction via ElevenLabs TTS
- Company-specific interview prompts (Google, Meta, etc.)
- Role-specific rubrics and evaluation criteria
- Detailed feedback with dimension radar charts, claim verification, and CV alignment analysis

### Technical Interviews
- Coding challenges with Monaco Editor (in-browser IDE)
- Multi-language support: JavaScript, Python, Java
- Sandboxed code execution via Judge0
- Visible test cases with detailed pass/fail results
- Hidden test cases for comprehensive evaluation (results not leaked to candidate)
- AI-powered hint system and feedback

### User Management
- Registration and JWT-based authentication
- Session history and performance tracking
- Dashboard with interview statistics
- BYOK (Bring Your Own Key) for ElevenLabs integration

---

## API Routes

| Method | Endpoint                              | Auth | Description                          |
|--------|---------------------------------------|------|--------------------------------------|
| POST   | `/api/auth/register`                  | No   | Register new user                    |
| POST   | `/api/auth/login`                     | No   | Login and receive JWT                |
| GET    | `/api/user/profile`                   | Yes  | Get user profile                     |
| POST   | `/api/interview/prepare`              | Yes  | Prepare a behavioural interview      |
| POST   | `/api/interview/callback/*`           | No   | Webhook callbacks from agents        |
| GET    | `/api/questions/random`               | No   | Get a random technical question       |
| POST   | `/api/code/run`                       | No   | Execute code against test cases      |
| GET    | `/api/integrations/elevenlabs/status` | Yes  | Check ElevenLabs key status          |
| POST   | `/api/integrations/elevenlabs/connect`| Yes  | Store & verify ElevenLabs API key    |

---

## Frontend Routes

| Path                                    | Page                        |
|-----------------------------------------|-----------------------------|
| `/`                                     | Landing / Home page         |
| `/login`                                | Login                       |
| `/register`                             | Registration                |
| `/dashboard`                            | User dashboard              |
| `/profile`                              | User profile                |
| `/history`                              | Interview history           |
| `/setup`                                | Interview setup wizard      |
| `/loading`                              | Loading / preparation page  |
| `/interview/session/:id/waiting`        | Session waiting room        |
| `/behavioural/:sessionId`               | Behavioural interview room  |
| `/technical/:sessionId`                 | Technical interview room    |
| `/results/:sessionId`                   | Behavioural results         |
| `/results/technical/:sessionId`         | Technical results           |

---

## Database Schema (Prisma)

- **User** - email, password hash, demo credits
- **Agent** - per-user agent configuration with custom prompts
- **Session** - interview session with type, status, feedback, score, duration
- **Question** - technical coding questions with test cases, hints, solutions
- **ElevenLabsIntegration** - encrypted BYOK API key storage (AES-256-GCM)

---

## Troubleshooting

- **Database connection error**: Ensure Docker is running and `DATABASE_URL` in `.env` is correct.
- **Prisma client not generated**: Run `cd apps/backend && npx prisma generate`.
- **Port conflicts**: Backend defaults to 3000, frontend to 5173. Change via `PORT` env var or Vite config.
- **Missing API keys**: Behavioural interviews require `VITE_GEMINI_API_KEY` and `VITE_GOOGLE_AGENT_ID`. Technical interviews require `RAPIDAPI_KEY` and `RAPIDAPI_HOST`.
