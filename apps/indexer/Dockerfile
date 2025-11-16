# ---------- Build Stage ----------
FROM node:20-slim AS builder
WORKDIR /app

ENV CI=true
RUN npm install -g pnpm

# 整个 monorepo 复制进去
COPY . .

# 只安装 indexer 的依赖（包括 workspace）
RUN pnpm install --filter @apps/indexer...

# 构建 indexer
RUN pnpm --filter @apps/indexer build

# ---------- Runtime Stage ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 复制 indexer 构建产物
COPY --from=builder /app/apps/indexer/dist ./dist

# 复制 indexer 的 package.json 和已经装好的 node_modules
COPY --from=builder /app/apps/indexer/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# 直接运行，无需 install！
CMD ["node", "dist/index.js"]