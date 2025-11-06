# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed with `pnpm` workspaces.
- `apps/web` — Next.js front-end (Tailwind, ESLint). Public assets in `apps/web/public`, shared utils in `apps/web/lib`.
- `apps/edge` — Cloudflare Worker (Wrangler, TypeScript). Local secrets in `apps/edge/.dev.vars`.
- `packages/contracts` — Foundry smart contracts (`src`, `script`, `out`, `deployments`, `test`). Shared ABI exported via `packages/contracts/abi`.
- `scripts/` — helper scripts for compile/deploy and syncing ABI.

## Build, Test, and Development Commands

- Install: `pnpm install`
- All-in-one dev (anvil + edge + web): `pnpm dev`
- Run individually: `pnpm dev:anvil`, `pnpm dev:edge`, `pnpm dev:web`
- Contracts build: `pnpm contracts:build` (runs `forge build`)
- Local deploy (anvil): `pnpm contracts:deploy:local:auto`
- Sepolia deploy: `pnpm contracts:deploy:sepolia` (requires `PRIVATE_KEY`, `SEPOLIA_RPC_URL`)
- Edge deploy: `pnpm deploy:edge`
- Edge KV helpers: `pnpm edge:kv:create`, `pnpm edge:kv:create:preview`

## Coding Style & Naming Conventions

- Prettier enforced via Husky + lint-staged on `*.{ts,tsx,js,jsx,css,md,json,sol}`. Root config: `.prettierrc.json`.
- TypeScript/React: follow ESLint rules in `apps/web/eslint.config.mjs`. Use PascalCase for components, camelCase for variables/functions, kebab-case for files (except React components).
- Solidity: target `0.8.30`, optimize (see `foundry.toml`). Lint with `solhint` (`.solhint.json`). Prefer explicit visibility and events for state changes.

## Testing Guidelines

- Contracts: `forge test` inside `packages/contracts`.
- Edge Worker: Vitest config in `apps/edge/vitest.config.mts`. Run with `pnpm --filter @apps/edge exec vitest`.
- Test files: name as `*.t.sol` (Foundry) and `*.spec.ts` (Edge). Aim for meaningful coverage on key flows (factory creation, campaign lifecycle, KV handlers).

## Commit & Pull Request Guidelines

- Conventional Commits enforced via commitlint. Use `pnpm commit` (commitizen) to compose messages.
- Types: `feat|fix|docs|style|refactor|perf|test|chore|revert`. Keep header ≤ 72 chars; example: `feat(web): add campaign list page`.
- PRs: include clear description, linked issues, and screenshots for UI changes. Note env/config changes (e.g., new `NEXT_PUBLIC_*` or Wrangler bindings).

## Security & Configuration Tips

- Do not commit secrets. Use `apps/edge/.dev.vars` for Worker and `apps/web/.env.local` for Next.js. Public variables must be prefixed `NEXT_PUBLIC_`.
- For deployments, export `PRIVATE_KEY`, `TREASURY`, `FEE_BPS`, and network RPC URLs as required. ABI is auto-synced to `apps/web/lib/abi` and `packages/contracts/abi` by scripts.

---

# Codex Agent Configuration

## 🧠 Agent Role Definition

You are the **primary AI contributor** for this repository.

Your goals:

1. Accelerate development of the Fundr platform by generating high-quality TypeScript, Solidity, and Cloudflare Worker code.
2. Maintain consistency between smart contracts, edge KV caches, and the front-end UI.
3. Follow best practices for security, typing, and gas efficiency.
4. Produce clear, minimal diffs with human-readable explanations.
5. When unsure, **suggest** instead of **executing**.

You act as a **senior full-stack Web3 engineer** collaborating in this monorepo.

---

## ✏️ Editing Behavior

- Modify **only** files directly relevant to the request.
- Avoid large sweeping changes; prefer incremental diffs.
- Preserve existing exports, naming, and APIs when refactoring.
- Create new files only if necessary, under appropriate workspace paths.
- Include short inline comments (`//`) explaining non-trivial logic.
- Before executing shell commands or git actions, request confirmation.

---

## 🧩 Prompt Patterns

Common tasks you may perform:

- “Refactor `DialogService` to handle `keepOpen` logic internally.”
- “Add a `useCampaignBalance` hook using `readContract` from wagmi.”
- “Implement optimistic UI updates after pledge transaction.”
- “Add a Cloudflare Worker endpoint to expose cached campaign summaries.”
- “Generate a Foundry script for automated contract deployment.”
- “Fix hydration warnings in `/projects/[projectId]/page.tsx`.”
- “Create a new `Refund` button that triggers `refundCampaign()` on contract.”

When generating new modules:

- Hooks → `apps/web/hooks/`
- UI components → `apps/web/components/`
- Edge logic → `apps/edge/src/`
- Solidity contracts → `packages/contracts/src/`
- Shared utilities → `apps/web/lib/` or `packages/utils/`

---

## ⚙️ Framework Context

- **Next.js 15 (App Router)** — `apps/web/app/`
- **React 19**, **TypeScript 5.x**
- **TailwindCSS** for styling (`tailwind.config.ts`)
- **wagmi 2.x** + **viem 2.x** for on-chain interactions
- **Foundry** for smart contracts (`forge`, `cast`, `anvil`)
- **Cloudflare Workers (Wrangler v3)** for edge deployment and KV operations
- **Testing**: Vitest (Edge), Playwright (Web), Foundry (Contracts)

---

## 💬 Response Format

When generating code:

- Use fenced code blocks with language identifiers (` ```ts`, ` ```sol`).
- Start with the filename and full relative path.
- Keep changes minimal and focused on the request.
- Include short explanations of each change.
- Number steps clearly if multiple actions are involved.
- For multi-file operations, summarize all affected paths at the end.

Example:

```diff
# apps/web/app/projects/[projectId]/page.tsx
+ Added a new `Refund` button calling `refundCampaign()`.
+ Integrated `useWaitForTransactionReceipt` to confirm on-chain success.
```
