# Samuel Okonkwo

Auckland, NZ · sam.okonkwo@example.com · github.com/samok-ai

## Education

**BSc Computer Science & Statistics — University of Auckland** (2018–2021)
GPA 8.3/9.0. Relevant: Machine Learning, Natural Language Processing, Statistical Inference.

## Experience

**AI Engineer — Contextual (Series A, enterprise LLM platform)** (2022–present)
Core product team (5 engineers). Contextual builds RAG-powered knowledge assistants for Fortune 500 legal and compliance teams.
- Owned the retrieval pipeline end-to-end: evaluated 4 embedding models (text-embedding-3-large, Cohere v3, E5-mistral, BGE-M3) on our legal-domain benchmark (7K annotated query-document pairs). Selected Cohere v3 for its 12% MRR improvement on multi-hop legal queries over OpenAI. Built the chunking strategy: recursive character split at 512 tokens with 64-token overlap, plus a semantic-boundary detector (trained a small BERT classifier on our annotated section-break dataset) that prevents mid-section splits and improved recall@10 by 18%.
- Designed the hybrid search layer: dense embeddings for semantic retrieval + BM25 sparse for exact clause matching, with learned fusion weights tuned per customer. This was the key unlock that got us from pilot to 3 paid contracts.
- Built a query-rewriting module that expands vague legal queries (e.g., "what's the notice period") into structured search queries by extracting entity mentions and jurisdiction context from the conversation history. Used a fine-tuned Llama-3-8B for this; reduced hallucinated citations from 22% to 4% in user testing.
- Led the migration from Pinecone to pgvector (Postgres): the primary driver was eliminating sync latency between our operational DB and the vector store, which caused stale embeddings for 15–30 minutes after document updates. pgvector with IVFFlat indexing gave us within-1-second freshness at our scale (~2M chunks) with a 40ms p99 retrieval latency (acceptable for our async use case; would have been different if we needed sub-10ms for real-time chat).

**Junior ML Engineer — FinTell (fintech NLP startup, Wellington)** (2021–2022)
- Built a transaction-categorisation classifier (XGBoost) trained on 50M+ labelled transactions with 87% F1. Handled the severe class imbalance (200+ categories, some with <100 examples) using a two-stage architecture: first-pass coarse category, second-pass fine-grained within that category.

## Projects

**JurisMCP** (2025, solo)
An MCP server for LLMs that provides structured access to NZ legislation. Built to solve the problem of LLMs hallucinating case law — the server indexes 12,000+ statutes and provides a tool interface for agents to query specific sections. 200+ GitHub stars. Used by 3 NZ law-tech startups.
- Chose MCP over a REST API because the target users were coding agents and VS Code extensions that needed structured tool interfaces without managing API credentials. The MCP transport layer handles auth natively.

## Skills

Python, PyTorch, LangChain, LlamaIndex, pgvector, Pinecone, Cohere, OpenAI, XGBoost, Docker, PostgreSQL, Redis, FastAPI, Weights & Biases

## Talks

- "Chunking Strategies for Legal RAG" — NZ AI Meetup, 2024
- "From Pinecone to pgvector: A Migration Story" — Postgres Auckland, 2025
