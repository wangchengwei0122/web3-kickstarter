# Web3 众筹平台 – 前端开发任务清单

## 1. 基础设施
- [ ] 设置 `.env.local`，包含：
  - NEXT_PUBLIC_RPC_HTTP
  - NEXT_PUBLIC_FACTORY_ADDRESS
- [ ] Provider：Wagmi + React Query 在 `app/layout.tsx` 挂载
- [ ] 项目结构：`components/`, `sdk/`, `lib/`, `hooks/`

## 2. SDK 层
- [ ] 定义 ABI：Factory + Project
- [ ] `read.ts`：getProjects, getProjectSummary, getContribution
- [ ] `write.ts`：donate, refund, payout
- [ ] 支持 mockAdapter / onchainAdapter 切换