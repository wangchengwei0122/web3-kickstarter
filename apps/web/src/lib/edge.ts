import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type Address,
  type PublicClient,
} from 'viem';
import deployment from '../../../../packages/contracts/deployments/31337.json';

type DeploymentManifest = {
  chainId: number;
  factory: Address;
  deployBlock: number;
};

const manifest = deployment as DeploymentManifest;

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

// const campaignCreatedEvent = parseAbiItem(
//   'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
// );

// const campaignAbi = parseAbi([
//   'function getSummary() view returns (address creator, uint256 goal, uint64 deadline, uint8 status, uint256 totalPledged)',
//   'function metadataURI() view returns (string)',
// ]);

// const campaignCreatedEvent = {

const DEFAULT_LIMIT = 12;

function resolveEnv(key: string) {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function parseNumeric(value: string | number | undefined) {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseBig(value: string | undefined) {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch (error) {
    return undefined;
  }
}

function ensureAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
}
async function fetchFromEdge(
  cursor: number,
  limit: number,
  sort: 'latest' | 'deadline'
): Promise<CampaignPage> {
  const base = resolveEnv('NEXT_PUBLIC_EDGE');
  if (!base) {
    throw new Error('NEXT_PUBLIC_EDGE is not configured');
  }

  const url = new URL('/campaigns', base);
  url.searchParams.set('cursor', cursor.toString());
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('sort', sort);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Edge request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CampaignPage;
  return { ...payload, source: 'edge' };
}

async function fetchDirectOnChain(limit: number, cursor: number): Promise<CampaignPage> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_HTTP || '127.0.0.1:8545';

  const chainId = parseNumeric(resolveEnv('NEXT_PUBLIC_CHAIN_ID')) ?? manifest.chainId;

  const factory = ensureAddress(resolveEnv('NEXT_PUBLIC_FACTORY')) ?? manifest.factory;

  const deployBlock =
    parseBig(resolveEnv('NEXT_PUBLIC_DEPLOY_BLOCK')) ?? BigInt(manifest.deployBlock);

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
    console.warn('Edge fetch failed, attempting direct chain fallback', error);
    return fetchDirectOnChain(limit, cursor);
  }
}
