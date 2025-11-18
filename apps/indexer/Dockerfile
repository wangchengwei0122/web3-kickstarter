# ---------- Build Stage ----------
FROM node:20-slim AS builder
WORKDIR /app

ENV CI=true
RUN npm install -g pnpm

# 将整个 monorepo 复制进去
COPY . .

# 安装所有 workspace 依赖（非常关键）
RUN pnpm install

# 清理旧的构建产物（确保使用最新代码）
RUN rm -rf apps/indexer/dist packages/db/dist

# 构建共享 db schema（供 indexer/api 使用）
RUN pnpm --filter "@packages/db" build

# 构建 indexer（强制重新构建）
RUN pnpm --filter "@apps/indexer" build

# ---------- Runtime Stage ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 复制根 node_modules（包含 .pnpm store，供所有 workspace 依赖使用）
COPY --from=builder /app/node_modules /app/node_modules
# 复制需要的 packages（确保 workspace 路径存在）
COPY --from=builder /app/packages/db /app/packages/db

# 复制 indexer 的构建产物和依赖，保持与 builder 相同的目录结构
COPY --from=builder /app/apps/indexer /app/apps/indexer

WORKDIR /app/apps/indexer

CMD ["node", "dist/index.js"]
