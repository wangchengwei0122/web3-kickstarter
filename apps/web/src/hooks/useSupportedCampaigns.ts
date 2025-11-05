'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address, PublicClient } from 'viem';
import { campaignAbi } from '@lib/abi';
import type { CampaignInfo } from './useUserCampaigns';

const WEI_PER_ETH = 1_000_000_000_000_000_000n;

const FALLBACK_METADATA = {
  title: '未命名项目',
  summary: '该项目的详细描述暂不可用，稍后再试。',
  description: 'No project introduction content.',
  imageUrl:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
  category: 'unclassified',
};

const statusMap: Record<number, CampaignInfo['status']> = {
  0: 'active',
  1: 'successful',
  2: 'failed',
  3: 'cancelled',
};

function toEth(value: bigint): number {
  try {
    const whole = Number(value / WEI_PER_ETH);
    const fraction = Number(value % WEI_PER_ETH) / 1e18;
    return whole + fraction;
  } catch {
    return 0;
  }
}

async function fetchMetadata(uri: string): Promise<typeof FALLBACK_METADATA> {
  if (!uri || uri.trim().length === 0) {
    return FALLBACK_METADATA;
  }

  const url = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return FALLBACK_METADATA;
    }
    const raw = (await response.json()) as Record<string, unknown>;

    return {
      title:
        typeof raw.title === 'string' && raw.title.trim().length > 0
          ? raw.title
          : FALLBACK_METADATA.title,
      summary:
        typeof raw.summary === 'string' && raw.summary.trim().length > 0
          ? raw.summary
          : typeof raw.description === 'string' && raw.description.trim().length > 0
            ? raw.description
            : FALLBACK_METADATA.summary,
      description:
        typeof raw.description === 'string' && raw.description.trim().length > 0
          ? raw.description
          : FALLBACK_METADATA.description,
      imageUrl:
        typeof raw.image === 'string' && raw.image.trim().length > 0
          ? raw.image
          : typeof raw.cover === 'string' && raw.cover.trim().length > 0
            ? raw.cover
            : FALLBACK_METADATA.imageUrl,
      category:
        typeof raw.category === 'string' && raw.category.trim().length > 0
          ? raw.category
          : FALLBACK_METADATA.category,
    };
  } catch {
    return FALLBACK_METADATA;
  }
}

async function fetchSupportedCampaigns(
  userAddress: Address,
  publicClient: PublicClient
): Promise<CampaignInfo[]> {
  try {
    // 从 ABI 中找到 Pledged 事件定义
    const pledgedEvent = campaignAbi.find(
      (item) => item.type === 'event' && item.name === 'Pledged'
    );

    if (!pledgedEvent || pledgedEvent.type !== 'event') {
      return [];
    }

    // 获取当前区块号
    let currentBlock: bigint;
    try {
      currentBlock = await publicClient.getBlockNumber();
    } catch {
      return [];
    }

    // 查询最近50000个区块内的 Pledged 事件，其中 backer 是用户地址
    const maxBlocksToSearch = 50000n;
    const fromBlock = currentBlock > maxBlocksToSearch ? currentBlock - maxBlocksToSearch : 0n;

    let logs;
    try {
      logs = await publicClient.getLogs({
        event: pledgedEvent,
        args: {
          backer: userAddress,
        },
        fromBlock,
        toBlock: currentBlock,
      });
    } catch (error) {
      console.warn('Failed to get logs with large range, trying smaller range', error);
      try {
        const smallerRange = 10000n;
        const smallerFromBlock = currentBlock > smallerRange ? currentBlock - smallerRange : 0n;
        logs = await publicClient.getLogs({
          event: pledgedEvent,
          args: {
            backer: userAddress,
          },
          fromBlock: smallerFromBlock,
          toBlock: currentBlock,
        });
      } catch (error2) {
        console.warn('Failed to get logs, returning empty', error2);
        return [];
      }
    }

    // 提取唯一的 campaign 地址（通过解析 log 的 address）
    const campaignAddresses = new Set<Address>();
    for (const log of logs) {
      // log.address 就是 campaign 合约地址
      if (log.address) {
        campaignAddresses.add(log.address);
      }
    }

    if (campaignAddresses.size === 0) {
      return [];
    }

    // 获取每个 campaign 的详细信息
    const campaigns = await Promise.all(
      Array.from(campaignAddresses).map(async (address) => {
        try {
          const [summary, metadataURI] = await Promise.all([
            publicClient.readContract({
              address,
              abi: campaignAbi,
              functionName: 'getSummary',
            }),
            publicClient.readContract({
              address,
              abi: campaignAbi,
              functionName: 'metadataURI',
            }),
          ]);

          const [creator, goal, deadline, statusIndex, totalPledged] = summary as [
            Address,
            bigint,
            bigint,
            number,
            bigint,
          ];

          const metadata = await fetchMetadata(metadataURI as string);
          const goalAmount = toEth(goal);
          const pledgedAmount = toEth(totalPledged);
          const progress = goalAmount > 0 ? Math.min(1, pledgedAmount / goalAmount) : 0;

          return {
            address,
            title: metadata.title,
            category: metadata.category,
            description: metadata.description,
            imageUrl: metadata.imageUrl,
            status: statusMap[statusIndex] ?? 'active',
            goalAmount,
            pledgedAmount,
            progress,
          } as CampaignInfo;
        } catch (error) {
          console.error(`Failed to fetch campaign info for ${address}`, error);
          return null;
        }
      })
    );

    return campaigns.filter((c): c is CampaignInfo => c !== null);
  } catch (error) {
    console.error('Failed to fetch supported campaigns', error);
    return [];
  }
}

export function useSupportedCampaigns(userAddress: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['supportedCampaigns', userAddress],
    queryFn: () => {
      if (!userAddress || !publicClient) {
        return [];
      }
      return fetchSupportedCampaigns(userAddress, publicClient);
    },
    enabled: Boolean(userAddress && publicClient),
    staleTime: 30000,
  });
}
