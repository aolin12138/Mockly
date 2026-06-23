---
title: "Mockly — Architecture"
type: concept
updated: 2026-05-31
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/ (directory tree)
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/server.js
tags: [mockly, architecture, monorepo]
---

# Mockly — Architecture

## Directory layout

```
Mockly/
├── apps/
│   ├── frontend/           # React 19 + Vite SPA
│   │   ├── src/            # Frontend source
│   │   └── test/           # Frontend tests
│   └── backend/            # Express 5 API server
│       ├── server.js       # Entry point (1.5KB)
│       ├── routes/         # API route handlers
│       ├── middleware/      # Express middleware
│       ├── lib/            # Shared backend libraries
│       ├── prisma/         # Database schema + migrations + seed
│       ├── prompts/        # AI prompt templates
│       └── prismaClient.js # DB client singleton
├── design-system/          # Custom design system
│   ├── BYOK.md             # ElevenLabs BYOK workflow (5.2KB)
│   └── mockly-setup/       # Design system setup
├── Mockly/                 # Interview content presets
│   ├── presets.company_profile.json  # Company profiles (5.7KB)
│   ├── presets.role_rubric.json      # Role rubrics (17.6KB)
│   ├── prompts/            # Interview prompt templates
│   └── test/               # Test fixtures
├── .claude/                # Claude AI integration
├── .opencode/              # OpenCode AI integration
├── opencode/               # OpenCode configuration
├── .github/                # GitHub workflows
├── public/                 # Static assets
├── dist/                   # Build output
├── docker-compose.yaml     # Container orchestration
└── mcp_plan.md             # MCP server plan (11.4KB)
```

## Component architecture

```
Browser (React 19 SPA)
  │
  ├── Tailwind CSS 4 + custom design system
  ├── Framer Motion (animations)
  ├── Three.js / React Three Fiber (3D)
  ├── Monaco Editor (code interviews)
  ├── Recharts (analytics)
  └── ElevenLabs React components (voice)
  │
  ▼ HTTP
Express 5 API Server
  │
  ├── Routes (interview sessions, user auth, integrations)
  ├── Middleware (auth, upload)
  ├── Prisma ORM → PostgreSQL
  ├── ElevenLabs SDK (voice synthesis, agent provisioning)
  ├── Judge0 (code execution for technical interviews)
  └── MCP Server (planned — tool-calling during interviews)
  │
  ▼ External
ElevenLabs API  │  Judge0 API  │  PostgreSQL
```

## Key dependencies

| Dependency | Purpose |
|-----------|---------|
| `@elevenlabs/react`, `elevenlabs-js` | Voice synthesis and agent management |
| `@react-three/fiber`, `@react-three/drei`, `three` | 3D scenes |
| `react-monaco-editor` | In-browser code editor |
| `recharts` | Analytics and performance charts |
| `framer-motion`, `motion` | UI animations |
| `mammoth`, `pdf-parse`, `multer` | Document upload and parsing |
| `bcrypt`, `jsonwebtoken` | Authentication |
| `@prisma/client`, `pg` | Database ORM + PostgreSQL driver |

## AI integration

Three AI tool directories suggest the project uses multiple AI assistants:

| Directory | Tool |
|-----------|------|
| `.claude/` | Claude (Anthropic) |
| `.opencode/` | OpenCode |
| `opencode/` | OpenCode configuration |

The prompts/ directories contain AI prompt templates for interview scenarios.

## See also

- [overview](overview.md)
- [status](status.md)
- [requirements](requirements.md)
