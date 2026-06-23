---
title: "Mockly — Requirements"
type: reference
updated: 2026-05-31
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/README.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/design-system/BYOK.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/mcp_plan.md
tags: [mockly, requirements, prd]
---

# Mockly — Requirements

Distilled from README, BYOK plan, MCP plan, and codebase evidence.

## Core goal

Allow users to practice interviews through mocked sessions powered by AI agents.

## Functional requirements

| # | Requirement | Source | Status |
|---|------------|--------|--------|
| R1 | AI agent conducts mock interview sessions | README | Likely built |
| R2 | Voice interaction via ElevenLabs | `@elevenlabs/react`, `elevenlabs-js` deps | Likely built |
| R3 | BYOK — users provide their own ElevenLabs key | `design-system/BYOK.md` | Planned/documented |
| R4 | Secure key storage (AES-256-GCM encryption) | BYOK.md §2.2 | Planned |
| R5 | Key verification flow (validate before saving) | BYOK.md §2.2 | Planned |
| R6 | Company-profile-based interview context | `presets.company_profile.json` | Built |
| R7 | Role-rubric-based evaluation criteria | `presets.role_rubric.json` | Built |
| R8 | Technical interview support with code editor | Monaco dependency | Likely built |
| R9 | Code execution during interviews | Judge0 (referenced in mcp_plan.md) | Unclear |
| R10 | Resume/document upload and parsing | mammoth, pdf-parse, multer deps | Likely built |
| R11 | MCP server for interview agent tool-calling | `mcp_plan.md` | Planned |
| R12 | Analytics dashboard for interview performance | Recharts dependency | Likely built |
| R13 | User authentication | bcrypt, jsonwebtoken deps | Likely built |
| R14 | 3D visual elements | Three.js deps | Likely built |

## Non-functional requirements (inferred)

| # | Requirement | Evidence |
|---|------------|----------|
| N1 | HTTPS for all API traffic | MCP plan mentions HTTPS requirement |
| N2 | Server-to-server auth for MCP | MCP plan §2 — shared secret header |
| N3 | Docker-based deployment | `docker-compose.yaml` |
| N4 | Database migrations via Prisma | `db:migrate` and `db:seed` scripts |

## See also

- [overview](overview.md)
- [architecture](architecture.md)
- [status](status.md)
