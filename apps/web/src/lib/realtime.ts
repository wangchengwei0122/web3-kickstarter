import { createPublicClient, http, type Address } from 'viem';
import { campaignAbi } from '@/lib/abi';

import type { EdgeCampaign } from './edge';

function resolveEnv(key: string) {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function resolveChainId(): number | undefined {
  const envChain = resolveEnv('NEXT_PUBLIC_CHAIN_ID');
  if (envChain) {
    const parsed = Number.parseInt(envChain, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function resolveRpcUrl() {
  return resolveEnv('NEXT_PUBLIC_RPC_URL');
}

function resolveClient() {
  const rpcUrl = resolveRpcUrl();
  const chainId = resolveChainId();
  if (!rpcUrl || !chainId) {
    return null;
  }

  return createPublicClient({
    chain: {
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });
}

export async function patchCampaignsRealtime(campaigns: EdgeCampaign[]): Promise<EdgeCampaign[]> {
  if (campaigns.length === 0) {
    return campaigns;
  }

  const client = resolveClient();
  if (!client) {
    return campaigns;
  }

  const contracts = campaigns.map((campaign) => ({
    address: campaign.address as Address,
    abi: campaignAbi,
    functionName: 'getSummary' as const,
  }));

  const results = await client.multicall({
    allowFailure: true,
    contracts,
  });

  return campaigns.map((campaign, index) => {
    const outcome = results[index];
    if (!outcome || outcome.status !== 'success') {
      return campaign;
    }

    const [, , , status, totalPledged] = outcome.result as [
      Address,
      bigint,
      bigint,
      number,
      bigint,
    ];

    return {
      ...campaign,
      status: Number(status),
      totalPledged: totalPledged.toString(),
    } satisfies EdgeCampaign;
  });
}
