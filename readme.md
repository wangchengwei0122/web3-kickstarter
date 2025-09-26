# Web3 Kickstarter

一个基于 **Foundry + Next.js** 的 Web3 众筹平台 Demo  
支持合约编译、部署到本地链、前端自动同步 ABI 和地址。

---

## 📦 安装依赖

```bash
pnpm install
```

## 🚀 启动开发环境

一键启动 Cloudflare Worker + Web 前端

```bash
pnpm dev
```

- Edge Worker (Wrangler): http://127.0.0.1:8787
- Next.js: http://localhost:3000

## 🔨 编译合约

```bash
pnpm contracts:build
```

等价于在 packages/contracts 下执行 forge build。

## 📜 部署合约（本地链）

```bash
pnpm contracts:deploy:local:auto
```

执行流程：

1. 使用 Anvil 默认账户私钥
2. 运行部署脚本 script/Counter.s.sol:Deploy
3. 将合约地址写入 apps/web/lib/abi/Counter-address.ts
4. 将 ABI 拷贝到 apps/web/lib/abi/Counter.json

运行成功后，会在终端打印：

```bash
✅ 合约地址：0x5FbDB2...
✅ ABI 和地址已写入：apps/web/lib/abi
```

## 🛰️ Edge Worker

- 独立启动：`pnpm dev:edge`
- 前端独立启动：`pnpm dev:web`
- 部署：`pnpm deploy:edge`
- 创建 KV（写入 wrangler.toml 的 id/preview_id）：
  - 生产：`pnpm edge:kv:create`
  - 预览：`pnpm edge:kv:create:preview`

## 🛠️ 前端调用合约

在前端代码中直接引入：

```typescript
import { counterAbi } from '@/lib/abi';
import { counterAddress } from '@/lib/abi/Counter-address';
```

搭配 viem 或 wagmi 使用即可。

## 📂 项目结构

web3-kickstarter/
├─ apps/web # Next.js 前端
│ └─ lib/abi # ABI + 地址自动写入目录
├─ packages/contracts # Foundry 智能合约
│ ├─ src # 合约源码
│ ├─ script # 部署脚本
│ ├─ out # 编译产物 (ABI/bytecode)
│ └─ broadcast # 部署记录
└─ scripts/deploy-local.sh # 部署 & 同步 ABI/地址
