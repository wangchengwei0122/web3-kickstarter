合约设计

MVP 必备 1. CampaignFactory（项目工厂）

    •	作用：创建与登记项目，收平台费（可选）。
    •	关键状态：owner（平台方）、feeBps、campaigns[]。
    •	主要函数：
    •	createCampaign(params) → 返回新 Campaign 地址
    •	setFeeBps(uint16)（onlyOwner）
    •	事件：CampaignCreated(campaign, creator, id)。

    2.	Campaign（单个众筹项目）

    •	关键状态：
    •	creator、goal、deadline、totalPledged
    •	status（Active/Successful/Failed/Cancelled）
    •	pledges[address]（用户出资额）
    •	主要函数：
    •	pledge() / pledge(amount)（支持 ETH/ ERC20 两种形态；先选其一做 MVP）
    •	unpledge()（可选：截止前允许撤回）
    •	finalize()（到期：若 totalPledged >= goal 则成功 → 释放给 creator；否则失败 → 允许退款）
    •	refund()（失败时支持者取回）
    •	cancel()（creator 在无人出资/早期取消）
    •	事件：Pledged(backer, amount)、Unpledged(backer, amount)、Finalized(success)、Refunded(backer, amount)、Cancelled()。
    •	权限：onlyCreator、onlyActive、到期检查。
    •	资产托管：MVP 先做 原生 ETH 托管（payable），进阶再扩展 ERC20。

备注：如果你已经有 Counter 流程，迁移成 Campaign 很顺：把 pledge/refund/finalize 流程与事件打通，再在前端接入。

进阶增强
• Milestone 里程碑拨款：release(nextMilestone) 需通过投票或时序解锁。
• ERC20 众筹：在 Campaign 中添加 IERC20 token，支持 permit。
• 奖励/打赏档位：tiers[]（minAmount, metadataUri），claimReward(tierId)。
• 拉黑/KYC（平台侧）：Factory 拥有 pause / 列表。
• 平台费：成功时从 totalPledged 抽 feeBps 到 treasury。
• 可升级性：用 UUPS/Clone（Minimal Proxy）降低部署 gas。
• 可观察性：所有关键路径都 emit 事件，便于前端/索引。

MVP 页面1. 首页/发现（/）
• 卡片流：项目封面、标题、简述、进度条（pledged/goal）、剩余时间、状态。
• 筛选/排序：最新、即将截止、目标接近。

    2.	项目详情（/projects/[id]）

    •	顶部：标题、分类、发起人、状态 Pill。
    •	核心区：
    •	进度：目标额、已筹金额、支持者数、截止时间
    •	支持输入框 + 支持按钮（调用 pledge）
    •	失败/到期后的按钮：refund() 或 finalize()（仅 creator）
    •	标签页（或区块）：
    •	介绍（富文本/MD）
    •	更新（手动或上链事件流）
    •	支持者列表（从事件聚合）
    •	里程碑（进阶）

    3.	创建项目向导（/create）

    •	步骤：基本信息 → 目标 & 截止日期 → 预览 → 上链创建（Factory.createCampaign）。
    •	成功后跳转详情。

    4.	我的（/account）

    •	我发起的 / 我支持的项目列表（从事件/索引/后端聚合）。
    •	钱包连接状态，交易历史（简化）。

    5.	平台管理（可后置）

    •	设置平台费、暂停项目等（onlyOwner）。

进阶页面/功能
• 项目方控制台（/dashboard/[projectId]）：查看资金曲线、发更新、触发 finalize / 里程碑解锁。
• 奖励档位选择：左侧选择档位 → 右侧展示权益/库存。
• 评论/讨论：链下（DB）或去中心化存储（后续）。
• 多链切换：将 anvil/测试网/主网 抽象在配置里。
• 搜索 & 标签：按类别/关键字索引。

前后端/链上交互要点
• 读取：
• 列表页：从 Factory 读取 campaigns，或用事件 CampaignCreated 索引。
• 详情页：读 goal/pledged/deadline/status/pledges[user]。
• 进度刷新：监听 Pledged/Refunded/Finalized 事件或新区块后 refetch。
• 写入：
• pledge: value=amount 传 ETH；按钮灰度：未连接/已到期/已取消。
• finalize/refund/cancel：按条件启用，弹出确认框。
• 状态呈现：
• Active（未到期）、Successful（达标 finalize 后）、Failed（未达标到期）、Cancelled。
• 统一的截止时间倒计时组件（避免 SSR 差异，客户端挂载后再启动计时）。
