#!/bin/bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/packages/contracts"

# ====== 环境变量 ======
# 私钥
export PRIVATE_KEY=${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80} # anvil 默认
# 工厂构造参数
export TREASURY=${TREASURY:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266} # anvil 第一个账号
export FEE_BPS=${FEE_BPS:-250}  # 2.5%

# 可选：示例 Campaign
# 如要创建示例：设置一个未来的 deadline（比如现在+7天），并提供 goal 和 metadata
now=$(date +%s)
export GOAL=${GOAL:-1000000000000000000} # 1 ether
export DEADLINE=${DEADLINE:-$((now + 7*24*3600))}
export METADATA_URI=${METADATA_URI:-"ipfs://your-json-metadata"}

# ====== 编译 ======
forge build

# ====== 部署 ======
RPC_URL=${RPC_URL:-http://127.0.0.1:8545} # anvil
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url "$RPC_URL" \
  --broadcast

# ====== 拷贝 ABI 到前端 ======
DEST_DIR="$REPO_ROOT/apps/web/lib/abi"
mkdir -p "$DEST_DIR"

# 注意：路径要与 out 里生成的一致
cp out/CampaignFactory.sol/CampaignFactory.json "$DEST_DIR/CampaignFactory.json" 2>/dev/null || true
cp out/Campaign.sol/Campaign.json             "$DEST_DIR/Campaign.json"         2>/dev/null || true

# ====== 输出地址文件位置 ======
CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
DEPLOY_FILE="$REPO_ROOT/packages/contracts/deployments/$CHAIN_ID.json"
echo "✅ Deployments written: $DEPLOY_FILE"

# 也可顺手产出一个 addresses.ts 供前端直接 import
if command -v jq >/dev/null 2>&1; then
  FACTORY_ADDR=$(jq -r '.CampaignFactory' "$DEPLOY_FILE" 2>/dev/null || echo "")
  SAMPLE_ADDR=$(jq -r '.SampleCampaign'    "$DEPLOY_FILE" 2>/dev/null || echo "")
  {
    echo "export const campaignFactoryAddress = \"$FACTORY_ADDR\" as \`0x\${string}\`;"
    echo "export const sampleCampaignAddress  = \"$SAMPLE_ADDR\"  as \`0x\${string}\`;"
  } > "$DEST_DIR/addresses.ts"
  echo "✅ ABI & addresses exported to: $DEST_DIR"
else
  echo "ℹ️  未安装 jq，已跳过生成 addresses.ts"
fi