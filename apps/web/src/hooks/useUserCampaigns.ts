'use client';

import { useQuery } from '@tanstack/react-query';
import { useReadContract, usePublicClient } from 'wagmi';
import type { Address, PublicClient } from 'viem';
import { campaignFactoryAbi, campaignAbi } from '@lib/abi';

export type CampaignInfo = {
  address: Address;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  status: 'active' | 'successful' | 'failed' | 'cancelled';
  goalAmount: number;
  pledgedAmount: number;
  progress: number;
};

const statusMap: Record<number, CampaignInfo['status']> = {
  0: 'active',
  1: 'successful',
  2: 'failed',
  3: 'cancelled',
};

const WEI_PER_ETH = 1_000_000_000_000_000_000n;

const FALLBACK_METADATA = {
  title: '未命名项目',
  summary: '该项目的详细描述暂不可用，稍后再试。',
  description: 'No project introduction content.',
  imageUrl:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
  category: 'unclassified',
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

async function fetchCampaignInfo(
  address: Address,
  publicClient: PublicClient
): Promise<CampaignInfo | null> {
  if (!publicClient) {
    return null;
  }

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
    };
  } catch (error) {
    console.error(`Failed to fetch campaign info for ${address}`, error);
    return null;
  }
}

export function useUserCampaigns(userAddress: Address | undefined) {
  const publicClient = usePublicClient();

  // 首先获取 Factory 地址
  const factoryAddress =
    (process.env.NEXT_PUBLIC_FACTORY as Address | undefined) ||
    ('0x0000000000000000000000000000000000000000' as Address);

  // 读取用户创建的项目列表
  const { data: userCampaigns = [] } = useReadContract({
    address: factoryAddress,
    abi: campaignFactoryAbi,
    functionName: 'getUserCampaigns',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: Boolean(userAddress && factoryAddress),
    },
  });

  // 获取所有项目的详细信息
  return useQuery({
    queryKey: ['userCampaigns', userAddress, userCampaigns],
    queryFn: async () => {
      if (!publicClient || !userCampaigns || userCampaigns.length === 0) {
        return [];
      }

      const campaigns = await Promise.all(
        (userCampaigns as Address[]).map((addr) => fetchCampaignInfo(addr, publicClient))
      );

      return campaigns.filter((c): c is CampaignInfo => c !== null);
    },
    enabled: Boolean(publicClient && userCampaigns && userCampaigns.length > 0),
    staleTime: 30000,
  });
}
