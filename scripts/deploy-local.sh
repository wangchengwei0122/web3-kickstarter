#!/bin/bash
set -euo pipefail

# 取得仓库根，避免相对路径出错
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/packages/contracts"

# 1) 用 anvil 的默认第一个私钥（注意：这是私钥，不是地址）
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 2) 编译合约（生成 out/*.json）
forge build

# 3) 部署（会生成 broadcast 目录）
forge script script/Counter.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# 4) 寻找最新的 run-latest.json（确保路径正确）
BROADCAST_DIR="broadcast/Counter.s.sol/31337"
RUN_FILE="$BROADCAST_DIR/run-latest.json"
if [ ! -f "$RUN_FILE" ]; then
  echo "❌ 未找到 $RUN_FILE。请确认脚本文件名是否为 script/Counter.s.sol，或 chainId 是否为 31337。"
  echo "   可用文件："
  ls -R broadcast || true
  exit 1
fi

# 5) 读取合约地址（选第一条包含 contractAddress 的交易）
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ 未安装 jq，请先安装：brew install jq"
  exit 1
fi

DEPLOYED_ADDRESS="$(jq -r 'first(.transactions[] | select(.contractAddress != null) | .contractAddress)' "$RUN_FILE")"
if [ -z "$DEPLOYED_ADDRESS" ] || [ "$DEPLOYED_ADDRESS" = "null" ]; then
  echo "❌ 未能从 $RUN_FILE 解析到合约地址。文件内容如下供排查："
  cat "$RUN_FILE"
  exit 1
fi

echo "✅ 合约地址：$DEPLOYED_ADDRESS"

# 6) 拷贝 ABI + 写入地址到前端
ABI_FILE="out/Counter.sol/Counter.json"
DEST_DIR="$REPO_ROOT/apps/web/lib/abi"

if [ ! -f "$ABI_FILE" ]; then
  echo "❌ 未找到 ABI 文件 $ABI_FILE，请确认合约文件名与路径。现有 out 目录："
  ls -R out || true
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$ABI_FILE" "$DEST_DIR/Counter.json"
echo "export const counterAddress = \"$DEPLOYED_ADDRESS\" as \`0x\${string}\`;" > "$DEST_DIR/Counter-address.ts"

echo "✅ ABI 和地址已写入：$DEST_DIR"