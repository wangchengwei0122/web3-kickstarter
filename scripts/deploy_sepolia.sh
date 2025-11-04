#!/bin/bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/packages/contracts"

# ====== 自动加载 .env（若存在） ======
# 优先加载 packages/contracts/.env，其次加载仓库根目录 .env
if [ -f ./.env ]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
  echo "ℹ️  Loaded env from packages/contracts/.env"
elif [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
  echo "ℹ️  Loaded env from ./.env (repo root)"
fi

# ====== 环境变量检查 ======
# 必填：部署私钥（请确保账户有足够的 Sepolia ETH）
if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "❌ 错误: 请设置 PRIVATE_KEY 环境变量"
  echo "   示例: export PRIVATE_KEY=0x..."
  exit 1
fi

# 必填：Sepolia RPC URL
if [ -z "${SEPOLIA_RPC_URL:-}" ]; then
  echo "❌ 错误: 请设置 SEPOLIA_RPC_URL 环境变量"
  echo "   示例: export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
  echo "   或: export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY"
  exit 1
fi

# 可选：Etherscan API Key（用于合约验证）
if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "⚠️  警告: 未设置 ETHERSCAN_API_KEY，将跳过合约验证"
  echo "   如需验证，请设置: export ETHERSCAN_API_KEY=your_key"
fi

# 工厂构造参数
export TREASURY=${TREASURY:-""}  # 必填：资金库地址
if [ -z "$TREASURY" ]; then
  echo "❌ 错误: 请设置 TREASURY 环境变量（资金库地址）"
  exit 1
fi

export FEE_BPS=${FEE_BPS:-250}  # 默认 2.5% (250 bps)

# 可选：示例 Campaign
now=$(date +%s)
export GOAL=${GOAL:-1000000000000000000} # 1 ether
export DEADLINE=${DEADLINE:-$((now + 7*24*3600))}  # 7天后
export METADATA_URI=${METADATA_URI:-"ipfs://your-json-metadata"}

# ====== 编译 ======
echo "🔨 编译合约..."
forge build

# ====== 部署 ======
echo "🚀 部署到 Sepolia..."
RPC_URL="$SEPOLIA_RPC_URL"
CHAIN_ID=11155111

# 构建 forge script 命令
if [ -n "${ETHERSCAN_API_KEY:-}" ]; then
  # 有 API key，启用验证
  forge script script/DeployAll.s.sol:DeployAll \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ETHERSCAN_API_KEY"
else
  # 没有 API key，跳过验证
  forge script script/DeployAll.s.sol:DeployAll \
    --rpc-url "$RPC_URL" \
    --broadcast
fi

# ====== 拷贝 ABI 到前端 ======
DEST_DIR="$REPO_ROOT/apps/web/lib/abi"
mkdir -p "$DEST_DIR"

# 注意：路径要与 out 里生成的一致
cp out/CampaignFactory.sol/CampaignFactory.json "$DEST_DIR/CampaignFactory.json" 2>/dev/null || true
cp out/Campaign.sol/Campaign.json "$DEST_DIR/Campaign.json" 2>/dev/null || true

# ====== 拷贝 ABI 到共享目录 ======
SHARED_ABI_DIR="$REPO_ROOT/packages/contracts/abi"
mkdir -p "$SHARED_ABI_DIR"
cp out/CampaignFactory.sol/CampaignFactory.json "$SHARED_ABI_DIR/CampaignFactory.json" 2>/dev/null || true
cp out/Campaign.sol/Campaign.json "$SHARED_ABI_DIR/Campaign.json" 2>/dev/null || true

# ====== 输出地址文件位置 ======
DEPLOY_FILE="$REPO_ROOT/packages/contracts/deployments/$CHAIN_ID.json"
echo "✅ Deployments written: $DEPLOY_FILE"

# 生成环境变量提示
if command -v jq >/dev/null 2>&1; then
  FACTORY_ADDR=$(
    jq -r '.factory // .CampaignFactory // empty' "$DEPLOY_FILE" 2>/dev/null || echo ""
  )
  SAMPLE_ADDR=$(jq -r '.SampleCampaign // empty' "$DEPLOY_FILE" 2>/dev/null || echo "")
  DEPLOY_BLOCK=$(jq -r '.deployBlock // empty' "$DEPLOY_FILE" 2>/dev/null || echo "")

  echo ""
  echo "🔑 建议的环境变量（粘贴到 .env 或 Vercel UI）:"
  echo "  NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID"
  if [ -n "$FACTORY_ADDR" ]; then
    echo "  NEXT_PUBLIC_FACTORY=$FACTORY_ADDR"
  fi
  if [ -n "$DEPLOY_BLOCK" ]; then
    echo "  NEXT_PUBLIC_DEPLOY_BLOCK=$DEPLOY_BLOCK"
  fi
  if [ -n "$SAMPLE_ADDR" ]; then
    echo "  NEXT_PUBLIC_SAMPLE_CAMPAIGN=$SAMPLE_ADDR"
  fi
else
  echo "ℹ️  未安装 jq，已跳过输出环境变量提示"
fi

echo ""
echo "✅ 部署完成！"
