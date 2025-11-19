#!/usr/bin/env bash
set -e

echo "🚀 Fundr Indexer Deploy"

ROOT_DIR=$(pwd)
TAG="v$(date +%s)"

echo "📌 Version: $TAG"

echo "🐳 Building Docker image..."
docker buildx build \
  --platform linux/amd64 \
  -f apps/indexer/Dockerfile \
  -t wangchengwei123/fundr-indexer:$TAG \
  . --push

echo "⬆️ Deploying to Fly..."
fly deploy --image wangchengwei123/fundr-indexer:$TAG -a fundr-indexer --remote-only

echo "🎉 Deploy done"