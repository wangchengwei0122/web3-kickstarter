# ================================
# 1) Build Stage（使用 Fly 节点）
# ================================
FROM flyio/node:20 AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# monorepo 文件
COPY ../../pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY ../../pnpm-lock.yaml ./pnpm-lock.yaml
COPY ../../apps ./apps
COPY ../../packages ./packages

# 安装依赖
RUN pnpm install --filter @apps/indexer...

# 构建产物
RUN pnpm --filter @apps/indexer build


# ================================
# 2) Runtime Stage（使用官方 node）
# ================================
FROM node:20 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 复制产物
COPY --from=builder /app/apps/indexer/dist ./dist
COPY --from=builder /app/apps/indexer/package.json ./package.json

# 安装生产依赖
RUN npm install --omit=dev

CMD ["node", "dist/index.js"]