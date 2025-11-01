'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address, PublicClient } from 'viem';
import { formatEther } from 'viem';
import { campaignAbi } from '@packages/contracts/abi';

export type BackerRecord = {
  address: Address;
  amount: string; // ETH amount as string
  amountWei: bigint;
  timestamp: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

async function fetchBackers(campaignAddress: Address, publicClient: PublicClient): Promise<BackerRecord[]> {
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

    // 获取 Pledged 事件日志
    const logs = await publicClient.getLogs({
      address: campaignAddress,
      event: pledgedEvent,
      fromBlock: 'earliest',
    });

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

