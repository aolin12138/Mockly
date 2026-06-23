---
title: "Mockly — Project Overview"
type: concept
updated: 2026-05-31
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/README.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/mcp_plan.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/design-system/BYOK.md
tags: [mockly, overview, interview, ai]
---

# Mockly — Project Overview

A web app that allows people to practice interviews through mocked sessions powered by AI agents.

## Quick facts

| Attribute | Value |
|-----------|-------|
| Repository | `E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/` |
| Goal | AI-powered interview practice with mocked agent sessions |
| Version | 0.0.0 (private) |
| Type | Monorepo (frontend + backend) |
| Last modified | May 30, 2026 |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, Framer Motion |
| Backend | Express 5, Prisma 7, PostgreSQL |
| 3D | Three.js, React Three Fiber |
| Voice | ElevenLabs (JS SDK + React components) |
| Code execution | Monaco editor, Judge0 |
| Charts | Recharts |
| Document parsing | mammoth (DOCX), pdf-parse |
| Auth | bcrypt, jsonwebtoken |
| AI tooling | Claude (.claude/), OpenCode (.opencode/, opencode/) |
| Container | Docker Compose |

## Key features (from codebase evidence)

| Feature | Evidence |
|---------|----------|
| Interview simulation | README: "practice interview through mocked sessions powered by agents" |
| ElevenLabs voice with BYOK | `design-system/BYOK.md` — full workflow for user-provided API keys with AES-256-GCM encryption |
| Company profiles & role rubrics | `Mockly/presets.company_profile.json` (5.7KB), `Mockly/presets.role_rubric.json` (17.6KB) |
| MCP server for interview tools | `mcp_plan.md` (11.4KB) — detailed plan for tool-calling during interviews |
| Code interview support | Monaco editor dependency, Judge0 for code execution |
| Resume/ doc upload | mammoth + pdf-parse + multer dependencies |
| Analytics dashboard | Recharts dependency |
| AI prompt templates | `Mockly/prompts/` and `apps/backend/prompts/` directories |

## Pi session history

Only 2 Pi sessions recorded, both from Apr 22, 2026 — neither involved Mockly development. The project was built outside of Pi (Claude, OpenCode). See [build history](build-history.md).

## See also

- [architecture](architecture.md)
- [status](status.md)
- [requirements](requirements.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [test-suite](test-suite.md)
