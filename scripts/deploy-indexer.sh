#!/usr/bin/env bash

set -e

APP_NAME="fundr-indexer"
DOCKER_IMAGE="wangchengwei123/fundr-indexer"

# 自动生成版本 TAG（按时间戳）
TAG="v$(date +%s)"

echo "🚀 Fundr Indexer 一键部署开始..."
echo "📌 Version: $TAG"
echo "📂 当前目录: $(pwd)"

# 安全检查：必须在项目根目录运行
if [ ! -d "apps/indexer" ] || [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌ 当前目录不是项目根目录！请 cd 到 web3-kickstarter 根目录再执行。"
  exit 1
fi

echo "🔍 检查 Docker 构建上下文大小..."
CONTEXT_SIZE=$(du -sh . | awk '{print $1}')
echo "📦 构建上下文大小: $CONTEXT_SIZE"

echo "🐳 开始 Docker Build + Push..."
docker buildx build \
  --no-cache \
  --platform linux/amd64 \
  -f apps/indexer/Dockerfile \
  -t $DOCKER_IMAGE:$TAG \
  . --push

echo "👍 Docker 镜像构建完成: $DOCKER_IMAGE:$TAG"

echo "✈️ 开始 Fly.io 部署..."
(
  cd apps/indexer
  fly deploy \
    --remote-only \
    --image "$DOCKER_IMAGE:$TAG" \
    --app "$APP_NAME"
)

echo "🎉 部署完成！"
echo "👉 镜像版本: $DOCKER_IMAGE:$TAG"
echo "👉 查看日志: fly logs -a $APP_NAME"
