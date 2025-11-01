import { createPublicClient, http, type AbiEvent, type Address, type PublicClient } from 'viem';
import { campaignAbi, campaignFactoryAbi } from '@packages/contracts/abi';

export type EdgeCampaign = {
  address: Address;
  creator: Address;
  goal: string;
  deadline: number;
  status: number;
  totalPledged: string;
  metadataURI: string;
  createdAt: number;
  createdBlock: number;
};

export type CampaignPage = {
  campaigns: EdgeCampaign[];
  cursor: number;
  nextCursor: number | null;
  hasMore: boolean;
  sort: 'latest' | 'deadline';
  total: number;
  source: 'edge' | 'fallback';
};

export type FetchCampaignOptions = {
  cursor?: number;
  limit?: number;
  sort?: 'latest' | 'deadline';
};

const envSource = {
  NEXT_PUBLIC_EDGE: process.env.NEXT_PUBLIC_EDGE,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_FACTORY: process.env.NEXT_PUBLIC_FACTORY,
  NEXT_PUBLIC_DEPLOY_BLOCK: process.env.NEXT_PUBLIC_DEPLOY_BLOCK,
} as const;

type EnvKey = keyof typeof envSource;

const runtimeConfig = {
  edgeUrl: requireEnv('NEXT_PUBLIC_EDGE'),
  rpcUrl: requireEnv('NEXT_PUBLIC_RPC_URL').trim(),
  chainId: requireNumeric('NEXT_PUBLIC_CHAIN_ID'),
  factory: requireAddress('NEXT_PUBLIC_FACTORY'),
  deployBlock: requireBigInt('NEXT_PUBLIC_DEPLOY_BLOCK'),
};

const DEFAULT_LIMIT = 12;

const campaignCreatedEvent = getCampaignCreatedEvent();

function getCampaignCreatedEvent(): AbiEvent {
  const event = campaignFactoryAbi.find(
    (item): item is AbiEvent => item.type === 'event' && item.name === 'CampaignCreated'
  );
  if (!event) {
    throw new Error('CampaignCreated event missing from factory ABI');
  }
  return event;
}

function requireEnv(key: EnvKey) {
  const value = envSource[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is not configured`);
  }
  return value;
}

function requireNumeric(key: EnvKey) {
  const value = requireEnv(key);
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${key} must be a valid number`);
  }
  return parsed;
}

function requireBigInt(key: EnvKey) {
  const value = requireEnv(key);
  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`${key} must be a valid integer`);
  }
}

function requireAddress(key: EnvKey) {
  const value = requireEnv(key);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${key} must be a valid address`);
  }
  return value as Address;
}
async function fetchFromEdge(
  cursor: number,
  limit: number,
  sort: 'latest' | 'deadline'
): Promise<CampaignPage> {
  const base = runtimeConfig.edgeUrl;

  if (!base) {
    throw new Error('NEXT_PUBLIC_EDGE is not configured');
  }

  const url = new URL('/campaigns', base);
  url.searchParams.set('cursor', cursor.toString());
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('sort', sort);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (fetchError) {
    // 连接被拒绝或其他网络错误
    if (fetchError instanceof TypeError) {
      throw fetchError;
    }
    throw new Error(
      `Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
    );
  }

  if (!response.ok) {
    throw new Error(`Edge request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CampaignPage;
  return { ...payload, source: 'edge' };
}

async function fetchDirectOnChain(limit: number, cursor: number): Promise<CampaignPage> {
  const rpcUrl = runtimeConfig.rpcUrl;
  const chainId = runtimeConfig.chainId;
  const factory = runtimeConfig.factory;
  const deployBlock = runtimeConfig.deployBlock;

  if (!rpcUrl || !chainId || !factory || deployBlock === undefined) {
    throw new Error('Missing RPC fallback configuration');
  }

  const client = createPublicClient({
    chain: {
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });

  const latestBlock = await client.getBlockNumber();
  const logs = await client.getLogs({
    address: factory,
    event: campaignCreatedEvent,
    fromBlock: deployBlock,
    toBlock: latestBlock,
  });

  const ordered = logs.slice().sort((a, b) => Number(b.blockNumber - a.blockNumber));

  const pageLogs = ordered.slice(cursor, cursor + limit);

  async function readSummarySafe(client: PublicClient, address: Address) {
    try {
      const [summary, metadata] = await client.multicall({
        allowFailure: false,
        contracts: [
          { address, abi: campaignAbi, functionName: 'getSummary' },
          { address, abi: campaignAbi, functionName: 'metadataURI' },
        ],
      });
      return { summary, metadata };
    } catch (e) {
      // 链不支持 multicall 或其他错误时降级
      const [summary, metadata] = await Promise.all([
        client.readContract({ address, abi: campaignAbi, functionName: 'getSummary' }),
        client.readContract({ address, abi: campaignAbi, functionName: 'metadataURI' }),
      ]);
      return { summary, metadata };
    }
  }

  const campaigns = await Promise.all(
    pageLogs.map(async (log) => {
      const address = log.args.campaign as Address;
      try {
        const { summary, metadata } = await readSummarySafe(client, address);

        const [creator, goal, deadline, status, totalPledged] = summary as [
          Address,
          bigint,
          bigint,
          number,
          bigint,
        ];

        const block = await client.getBlock({ blockNumber: log.blockNumber });

        return {
          address,
          creator,
          goal: goal.toString(),
          deadline: Number(deadline),
          status: Number(status),
          totalPledged: totalPledged.toString(),
          metadataURI: metadata as string,
          createdAt: Number(block.timestamp),
          createdBlock: Number(log.blockNumber),
        } satisfies EdgeCampaign;
      } catch (error) {
        console.error('Failed fallback sync', error);
        return undefined;
      }
    })
  );

  const filtered = campaigns.filter((item): item is EdgeCampaign => Boolean(item));
  const nextCursor = cursor + pageLogs.length < ordered.length ? cursor + pageLogs.length : null;

  return {
    campaigns: filtered,
    cursor,
    nextCursor,
    hasMore: nextCursor !== null,
    sort: 'latest',
    total: ordered.length,
    source: 'fallback',
  } satisfies CampaignPage;
}

export async function fetchCampaignPage(options: FetchCampaignOptions = {}): Promise<CampaignPage> {
  const { cursor = 0, limit = DEFAULT_LIMIT, sort = 'latest' } = options;

  try {
    return await fetchFromEdge(cursor, limit, sort);
  } catch (error) {
    // 只在开发环境或特定错误类型时记录详细错误
    const isConnectionError =
      error instanceof TypeError && error.message.includes('Failed to fetch');
    if (!isConnectionError) {
      console.warn('Edge fetch failed, attempting direct chain fallback', error);
    }
    try {
      return await fetchDirectOnChain(limit, cursor);
    } catch (fallbackError) {
      console.error('Both edge and fallback failed', fallbackError);
      throw fallbackError;
    }
  }
}
