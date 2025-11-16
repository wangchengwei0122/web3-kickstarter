# Campaign Indexer

链上 Campaign 事件索引器，用于监听 `CampaignCreated` 事件并将数据同步到 PostgreSQL 数据库。

## 功能特性

- ✅ 监听 `CampaignCreated` 事件
- ✅ 从链上读取 Campaign 合约的完整数据（`getSummary()`）
- ✅ 自动重试机制（可配置）
- ✅ RPC 请求频率控制（避免超过免费额度）
- ✅ 断点续跑（从上次 checkpoint 开始）
- ✅ 定期更新已有 Campaign 的状态
- ✅ 支持 Supabase PostgreSQL（SSL 连接）

## 环境变量配置

在 `apps/indexer/.env` 文件中配置以下环境变量：

```bash
# 必需配置
RPC_HTTP=https://your-rpc-url.com          # RPC 节点 URL
CHAIN_ID=11155111                          # 链 ID（Sepolia: 11155111）
FACTORY=0x...                              # CampaignFactory 合约地址
DEPLOY_BLOCK=0                             # Factory 部署的起始区块号
DATABASE_URL=postgresql://...             # PostgreSQL 连接字符串

# 可选配置
BLOCK_BATCH=10                             # 每次扫描的区块批次大小（默认：10）
RPC_DELAY_MS=100                           # RPC 请求之间的延迟（毫秒，默认：100）
MAX_RETRIES=3                              # 最大重试次数（默认：3）
RETRY_DELAY_MS=1000                        # 重试延迟（毫秒，默认：1000）
UPDATE_INTERVAL_MS=60000                   # 定期更新间隔（毫秒，默认：60000，即 60 秒）

# Supabase SSL 配置（开发环境）
NODE_TLS_REJECT_UNAUTHORIZED=0             # 开发环境禁用 SSL 验证
DATABASE_SSL=true                          # 启用 SSL 连接
```

## 数据库 Schema

### campaigns 表

| 字段          | 类型          | 说明                                                      |
| ------------- | ------------- | --------------------------------------------------------- |
| id            | serial        | 主键                                                      |
| address       | text (unique) | Campaign 合约地址                                         |
| creator       | text          | 创建者地址                                                |
| goal          | text          | 目标金额（wei）                                           |
| deadline      | bigint        | 截止时间（Unix 时间戳）                                   |
| status        | integer       | 状态（0: Active, 1: Successful, 2: Failed, 3: Cancelled） |
| total_pledged | text          | 已筹金额（wei）                                           |
| metadata_uri  | text          | 元数据 URI                                                |
| created_at    | timestamp     | 创建时间                                                  |
| created_block | bigint        | 创建区块号                                                |

### checkpoints 表

| 字段       | 类型               | 说明                                |
| ---------- | ------------------ | ----------------------------------- |
| id         | text (primary key) | Checkpoint ID（如 "factory:0x..."） |
| block      | bigint             | 最后索引的区块号                    |
| updated_at | timestamp          | 更新时间                            |

## 使用方法

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 运行数据库迁移

```bash
pnpm migrate:push
```

### 4. 启动索引器

开发模式（自动重启）：

```bash
pnpm dev
```

生产模式：

```bash
pnpm build
pnpm start
```

## 工作流程

1. **初始索引**：从 `DEPLOY_BLOCK` 开始扫描，或从上次 checkpoint 继续
2. **事件监听**：监听 `CampaignCreated` 事件
3. **数据获取**：调用 Campaign 合约的 `getSummary()` 获取完整数据
4. **数据存储**：将数据保存到 PostgreSQL 数据库
5. **定期更新**：每 60 秒更新一次已有 Campaign 的状态

## 日志输出示例

```
🚀 Starting indexer...
📋 Configuration:
   Factory: 0x1234...
   Chain ID: 11155111
   RPC: https://...
   Block Batch: 10
   RPC Delay: 100ms
   Max Retries: 3
🔍 Scanning from block 0 to 12345 (12346 blocks)
📦 Processing new campaign: 0xabcd... (creator: 0x5678...)
✅ Campaign indexed: 0xabcd... | Goal: 1000000000000000000 | Status: 0 | Pledged: 0
✅ Indexed blocks 0-9 (1 new campaigns)
...
✅ Indexing complete
⏰ Scheduled updates every 60s
🔄 Updating existing campaigns...
📊 Found 5 active campaigns to update
✅ Campaign update complete
```

## 故障处理

### RPC 请求失败

索引器会自动重试，最多重试 `MAX_RETRIES` 次。如果持续失败，请检查：

- RPC 节点是否可用
- 网络连接是否正常
- RPC 请求频率是否过高（调整 `RPC_DELAY_MS`）

### 数据库连接失败

确保：

- `DATABASE_URL` 配置正确
- 数据库服务正在运行
- SSL 配置正确（Supabase 需要 SSL）

### 索引器停止

索引器支持断点续跑，重启后会从上次 checkpoint 继续索引，不会重复处理已索引的区块。

## 性能优化建议

1. **调整 `BLOCK_BATCH`**：根据 RPC 节点性能调整批次大小
2. **调整 `RPC_DELAY_MS`**：避免超过 RPC 提供商的速率限制
3. **调整 `UPDATE_INTERVAL_MS`**：根据需求调整更新频率

## 技术栈

- **TypeScript** - 类型安全
- **viem** - 以太坊交互
- **drizzle-orm** - ORM 数据库操作
- **PostgreSQL** - 数据库（Supabase）
- **dotenv** - 环境变量管理

## 部署

docker buildx build \
 --platform linux/amd64,linux/arm64 \
 -t xxxx/fundr-indexer:latest \
 --push \
 -f apps/indexer/Dockerfile .
