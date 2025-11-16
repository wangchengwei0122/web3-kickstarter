# ---------- Build Stage ----------
FROM node:20-slim AS builder
WORKDIR /app

ENV CI=true
RUN npm install -g pnpm

# 将整个 monorepo 复制进去
COPY . .

# 安装所有 workspace 依赖（非常关键）
RUN pnpm install

# 构建 indexer
RUN pnpm --filter "@apps/indexer" build

# ---------- Runtime Stage ----------
FROM node:20-slim AS runner
WORKDIR /app/apps/indexer

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 复制根 node_modules（包含 .pnpm store，供所有 workspace 依赖使用）
COPY --from=builder /app/node_modules /app/node_modules

# 复制 indexer 的构建产物和依赖，保持与 builder 相同的目录结构
COPY --from=builder /app/apps/indexer/dist ./dist
COPY --from=builder /app/apps/indexer/node_modules ./node_modules

# 复制 indexer 的 package.json（可选）
COPY --from=builder /app/apps/indexer/package.json ./package.json

CMD ["node", "dist/index.js"]
