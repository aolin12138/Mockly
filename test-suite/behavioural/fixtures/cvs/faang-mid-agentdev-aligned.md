# Tessa Morrison

Auckland, NZ · tessa.morrison@example.com · github.com/tessa-ai

## Education

**BE (Hons) Software Engineering — University of Auckland** (2021–2024)
GPA 8.4/9.0. Specialisation: AI/ML. Relevant: Multi-Agent Systems, NLP, Reinforcement Learning.

## Experience

**AI Engineer — Finch (Series A, enterprise customer-support AI)** (2024–present)
Core agent team (4 engineers). Finch builds autonomous agents that handle complex customer-support workflows for SaaS companies.
- Designed the agent orchestration layer using LangGraph: a supervisor-worker topology where a routing agent classifies incoming tickets and delegates to specialist agents (billing, technical, account). Each specialist has its own tool set and can escalate back to a human when confidence drops below a calibrated threshold. The supervisor uses a structured output schema to decide routing, which eliminated the "agent sends user in circles" problem we had with prompt-based routing.
- Built the planning module for complex multi-step tickets: switched from ReAct (interleave thought-action-observation) to plan-and-execute after discovering that ReAct agents would myopically optimise step 1 without considering that steps 3-4 required different information. Plan-and-execute generates the full plan upfront, then executes each step; the plan is re-evaluated if new information invalidates remaining steps. This reduced our "stuck in loop" rate from 18% to 4%.
- Owned the tool-calling safety layer: implemented a pre-execution validator that checks tool arguments against schemas and business rules (e.g., "never refund more than the order value", "never access another customer's data"). Caught 3 classes of hallucinated tool calls that the base LLM was generating — including fabricated order IDs and impossible date ranges.
- Built the evaluation harness: 200 hand-annotated customer scenarios with expected outcomes, run nightly against all agent changes. Tracks resolution rate, time-to-resolution, hallucination rate, and human-escalation rate. Wrote a trajectory-level judge (DeepSeek V3 with chain-of-thought) that identifies WHERE in the conversation the agent went wrong, not just IF it solved the ticket.

**ML Intern — Auror (retail crime intelligence)** (2023–2024)
- Built a Named Entity Recognition pipeline (fine-tuned BERT-base) for extracting structured information from police incident reports — persons of interest, vehicle plates, location mentions. Deployed as a FastAPI microservice handling ~5K reports/day.

## Projects

**TriageBot** (2025, solo — 400+ GitHub stars)
An open-source LangGraph agent for triaging GitHub issues. Automatically labels, assigns, and suggests relevant code files based on issue text.
- Uses a ReAct loop with GitHub API tools (list issues, get file, comment) and a retrieval step that searches the repo's codebase for relevant files before suggesting assignments.
- Key learning: added a "confidence gate" — if the agent's routing confidence (from structured output logprobs) is below 0.7, it leaves the issue unassigned rather than making a wrong guess. This simple guard dropped false assignments from 23% to 3%.
- Built it specifically to test structured output routing vs prompt-based routing; the repo's README includes a detailed comparison.

**EvalTwin** (2025, solo)
A tool that generates synthetic evaluation scenarios for agent testing. Given an agent's tool definitions and a few seed examples, it generates diverse adversarial test cases — including edge cases where tools should NOT be called, ambiguous queries, and multi-step chains that test planning.
- Used by 2 other agent teams at Finch for expanding their eval suites.

## Skills

Python, LangGraph, LangChain, FastAPI, PyTorch, Docker, PostgreSQL, Redis, DeepSeek, OpenAI, Weights & Biases, GitHub Actions

## Talks

- "When Agents Go in Circles — Planning Strategies for Multi-Step Autonomy" — NZ AI Meetup, 2025
- Lightning talk: "Tool-Calling Safety in Production Agents" — Finch internal tech conference, 2025
