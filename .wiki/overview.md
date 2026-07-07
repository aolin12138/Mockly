---
title: "Mockly — Project Overview"
type: concept
updated: 2026-07-06
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/README.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/feedback/
  - Pi sessions 2026-07-06 (eval harness, question seeding, primary_focus)
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
| Live test suite | `test-suite/live/` — 18 scenarios, WS harness, sim-user, DeepSeek judge |
| Feedback eval harness | `test-suite/feedback/` — 7 fixtures, tier-1/2 checks, ordering + stability gates, report generator |
| Technical question bank | 15 DSA problems with full answer keys (optimal solutions, patterns, mistakes, follow-ups) |
| primary_focus coaching | Single imperative headline rendered as 🎯 callout atop feedback pages |

## Pi session history

7 Pi sessions recorded, 5 in 2026-07-06 (eval harness iteration, live test
run, security review, feedback eval harness, question seeding + primary_focus)
plus 2 from Apr 22, 2026. See [status](status.md), [decisions](decisions.md),
[test-suite](test-suite.md) for session artifacts.

## See also

- [architecture](architecture.md)
- [status](status.md)
- [requirements](requirements.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [test-suite](test-suite.md)
