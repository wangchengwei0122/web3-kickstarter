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

# 验证 db 构建产物
RUN test -d packages/db/dist || (echo "❌ DB build failed" && exit 1)

# 构建 indexer（强制重新构建）
# 确保在 monorepo 根目录执行，以便正确处理工作区依赖
RUN echo "🔨 Building indexer from monorepo root..." && \
    pwd && \
    pnpm --filter "@apps/indexer" build && \
    echo "✅ Build completed"

# 验证构建产物是否存在（详细输出）
RUN echo "📦 Checking build artifacts..." && \
    pwd && \
    ls -la apps/indexer/ && \
    test -d apps/indexer/dist || (echo "❌ Build failed: dist directory not found" && exit 1) && \
    echo "📁 Contents of apps/indexer/dist:" && \
    ls -la apps/indexer/dist/ && \
    test -f apps/indexer/dist/src/index.js || (echo "❌ Build failed: dist/src/index.js not found" && exit 1) && \
    test -f apps/indexer/dist/abi/index.js || (echo "❌ Build failed: dist/abi/index.js not found" && exit 1) && \
    echo "✅ Build artifacts verified: dist/src/index.js and dist/abi/index.js exist"

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

# 验证运行时文件是否存在
RUN test -f dist/src/index.js || (echo "❌ Runtime check failed: dist/src/index.js not found" && ls -la . && ls -la dist/ 2>&1 && ls -la dist/src/ 2>&1 || true && exit 1)

CMD ["node", "dist/src/index.js"]
