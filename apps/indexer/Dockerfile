# ---------- Build Stage ----------
FROM flyio/node:20 AS builder
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

COPY ../../pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ../../apps ./apps
COPY ../../packages ./packages

RUN pnpm install --filter @apps/indexer...

RUN pnpm --filter @apps/indexer build

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY --from=builder /app/apps/indexer/dist ./dist
COPY --from=builder /app/apps/indexer/package.json ./

RUN npm install --omit=dev

CMD ["node", "dist/index.js"]