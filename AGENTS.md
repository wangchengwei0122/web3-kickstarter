# Repository Guidelines (Updated for Indexer + API Architecture)

## Project Structure & Module Organization

Monorepo powered by `pnpm` workspaces:

- `apps/web`  
  Next.js 15 front-end (App Router). Fetches data **exclusively from `apps/api`.**

- `apps/api`  
  Fastify REST API service.  
  **The ONLY source of truth for frontend & edge.**  
  Reads data from PostgreSQL (populated by indexer).

- `apps/indexer`  
  Long-running Node service (Render).  
  Uses viem WebSocket transport to index the blockchain and store:
  - campaigns
  - checkpoints  
    into PostgreSQL (via Drizzle ORM).

- `apps/edge`  
  Cloudflare Worker.  
  IMPORTANT:
  - Does **NOT** fetch blockchain directly.
  - Does **NOT** perform indexing.
  - Only calls `apps/api` and performs KV caching.
  - Eventually replaced by a thin read-cache layer.

- `packages/contracts`  
  Foundry smart contracts. ABI output synced to:
  - `apps/web`
  - `apps/api` (if needed)

- `packages/db`  
  Shared drizzle schema for both:
  - `apps/indexer`
  - `apps/api`

- `scripts/`  
  Utilities for ABI sync, deployments, migrations, environment setup.

---

# Data Flow (single source of truth)

```
Blockchain → Indexer (WS) → PostgreSQL → API → Edge Cache → Web Frontend
```

Rules:

- **Indexer = the ONLY chain reader**
- **API = the ONLY database reader**
- **Web/Edge NEVER read the blockchain directly**

---

# Build & Development Commands

## Global

- Install deps: `pnpm install`
- All-in-one local dev: `pnpm dev`

## Apps

- Web: `pnpm dev:web`
- Edge: `pnpm dev:edge`
- API: `pnpm --filter @apps/api dev`
- Indexer: `pnpm --filter @apps/indexer dev`

## Contracts

- Build: `pnpm contracts:build`
- Local deploy: `pnpm contracts:deploy:local:auto`
- Sepolia deploy: `pnpm contracts:deploy:sepolia`

## Migrations

- Generate: `pnpm db:generate`
- Push: `pnpm db:push`

---

# Coding Style

- TypeScript / React:
  - PascalCase components, camelCase functions
  - Kebab-case filenames except components
  - Follow root ESLint + project-specific overrides
- Solidity:
  - Compiler `0.8.30`
  - Optimize & explicit visibility
  - Test with Foundry

---

# AI Agent Role

You are the **primary AI collaborator** for this repo.

Your priorities:

1. Maintain consistency between:
   - indexer inserts
   - database schema
   - API responses
   - web frontend consumers

2. Only modify code **relevant to the request**.

3. Prefer small, focused diffs.

4. When in doubt, propose an approach instead of executing a large refactor.

---

# Editing Rules

- Avoid breaking existing APIs.
- Do not introduce new env vars without asking.
- New modules go to:
  - Web hooks → `apps/web/hooks`
  - API routes → `apps/api/src/routes`
  - Edge logic → `apps/edge/src`
  - Indexer modules → `apps/indexer/src`
  - Shared utils → `packages/utils` or `packages/db`

---

# API Layer Responsibilities (`apps/api`)

The API must:

- Read from PostgreSQL through Drizzle
- Expose REST endpoints consumed by web/edge
- NEVER call blockchain directly
- Support pagination, sorting, filtering
- Provide enriched campaign summary for frontend

Edge Worker uses the API for all reads.

---

# Edge Worker Responsibilities (`apps/edge`)

- Fetch data from `apps/api`
- Optionally store read-through cache in KV
- Provide CDN-style high-performance read endpoints
- NEVER:
  - Index blockchain
  - Access chain RPC
  - Duplicate API logic

---

# Indexer Responsibilities (`apps/indexer`)

- ONLY component allowed to:
  - Connect to blockchain RPC/WebSocket
  - Subscribe to blocks/events
  - Run full sync or incremental sync
- Must:
  - Write clean data to PostgreSQL via Drizzle
  - Protect RPC usage (retry, backoff, WS reconnect)
  - Produce logs but never crash loop

---

# Response Format (for AI)

When generating code:

- Use fenced code blocks (` ```ts`, ` ```sol`).
- Prefix with the full relative path.
- Keep diff minimal and readable.
- Provide bullet-point explanation of changes.
- Summaries for multi-file modifications.

---

# Examples of Valid Tasks

- “Add GET `/campaigns/:id` to the API with Drizzle”
- “Add useCampaign(id) hook in frontend”
- “Add KV cache wrapper in apps/edge”
- “Optimize indexer: split WS client and sync logic”
- “Add script to verify ABIs match contracts/out”

Examples of Invalid Tasks:

- ❌ “Indexer writes directly to edge KV”
- ❌ “Web fetches directly from RPC”
- ❌ “Edge scans blocks or reads contract data”
- ❌ “Rewrite the entire repo”

---

# Summary

This repository follows a strict architecture:

- **CHAIN → INDEXER → DB → API → EDGE → WEB**
- Keep all code consistent with this structure.
- All business data flows from PostgreSQL outward.
