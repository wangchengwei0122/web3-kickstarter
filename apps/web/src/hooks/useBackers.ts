'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address, PublicClient } from 'viem';
import { formatEther } from 'viem';
import { campaignAbi } from '@lib/abi';

export type BackerRecord = {
  address: Address;
  amount: string; // ETH amount as string
  amountWei: bigint;
  timestamp: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

async function fetchBackers(
  campaignAddress: Address,
  publicClient: PublicClient
): Promise<BackerRecord[]> {
  if (!publicClient) {
    return [];
  }

  try {
    // 从 ABI 中找到 Pledged 事件定义
    const pledgedEvent = campaignAbi.find(
      (item) => item.type === 'event' && item.name === 'Pledged'
    );

    if (!pledgedEvent || pledgedEvent.type !== 'event') {
      return [];
    }

    // 获取当前区块号，用于确定查询范围
    let currentBlock: bigint;
    try {
      currentBlock = await publicClient.getBlockNumber();
    } catch {
      console.warn('Failed to get current block number');
      return [];
    }

    // 使用合理的区块范围：最近50000个区块（约7天，假设12秒/区块）
    // 这避免了某些 RPC 节点不支持 'earliest' 或大范围查询的问题
    const maxBlocksToSearch = 50000n;
    const fromBlock = currentBlock > maxBlocksToSearch ? currentBlock - maxBlocksToSearch : 0n;

    // 获取 Pledged 事件日志
    let logs;
    try {
      logs = await publicClient.getLogs({
        address: campaignAddress,
        event: pledgedEvent,
        fromBlock,
        toBlock: currentBlock,
      });
    } catch (error) {
      // 如果查询失败，尝试使用更小的范围（最近10000个区块）
      console.warn('Failed to get logs with large range, trying smaller range', error);
      try {
        const smallerRange = 10000n;
        const smallerFromBlock = currentBlock > smallerRange ? currentBlock - smallerRange : 0n;
        logs = await publicClient.getLogs({
          address: campaignAddress,
          event: pledgedEvent,
          fromBlock: smallerFromBlock,
          toBlock: currentBlock,
        });
      } catch (error2) {
        // 如果还是失败，只查询最近1000个区块
        console.warn('Failed to get logs with medium range, trying very recent blocks', error2);
        const veryRecentRange = 1000n;
        const veryRecentFromBlock =
          currentBlock > veryRecentRange ? currentBlock - veryRecentRange : 0n;
        logs = await publicClient.getLogs({
          address: campaignAddress,
          event: pledgedEvent,
          fromBlock: veryRecentFromBlock,
          toBlock: currentBlock,
        });
      }
    }

    // 获取对应的区块信息以获取时间戳
    const backersWithDetails = await Promise.all(
      logs.map(async (log) => {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        const amountWei = log.args.amount as bigint;
        return {
          address: log.args.backer as Address,
          amount: formatEther(amountWei),
          amountWei,
          timestamp: Number(block.timestamp),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        };
      })
    );

    // 按时间倒序排列（最新的在前）
    return backersWithDetails.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to fetch backers', error);
    return [];
  }
}

export function useBackers(campaignAddress: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['backers', campaignAddress],
    queryFn: () => {
      if (!campaignAddress || !publicClient) {
        return [];
      }
      return fetchBackers(campaignAddress, publicClient);
    },
    enabled: Boolean(campaignAddress && publicClient),
    staleTime: 30000, // 30秒内不重新获取
  });
}
