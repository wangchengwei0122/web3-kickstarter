/**
 * 索引器相关的类型定义
 */

import type { Address } from 'viem';

/**
 * Campaign 状态枚举（与合约中的 Status 枚举对应）
 */
export enum CampaignStatus {
  Active = 0,
  Successful = 1,
  Failed = 2,
  Cancelled = 3,
}

/**
 * 从链上获取的 Campaign 摘要信息
 */
export interface CampaignSummary {
  creator: Address;
  goal: bigint;
  deadline: bigint;
  status: CampaignStatus;
  totalPledged: bigint;
  metadataURI: string;
  factory: Address;
}

/**
 * 索引器配置
 */
export interface IndexerConfig {
  rpcHttp: string;
  chainId: number;
  factory: Address;
  deployBlock: bigint;
  blockBatch: bigint;
  rpcDelayMs: number; // RPC 请求之间的延迟（毫秒）
  maxRetries: number; // 最大重试次数
  retryDelayMs: number; // 重试延迟（毫秒）
  updateIntervalMs: number; // 定期更新已有 campaign 的间隔（毫秒）
}

