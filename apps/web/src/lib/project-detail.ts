import { createPublicClient, http, type Address } from 'viem';
import { campaignAbi } from '@packages/contracts/abi';

import type { ProjectDetail } from '@/components/projects/types';
import deployment from '../../../../packages/contracts/deployments/31337.json';

type DeploymentManifest = {
  chainId: number;
};

const manifest = deployment as DeploymentManifest;

const statusMap: Record<number, ProjectDetail['status']> = {
  0: 'active',
  1: 'successful',
  2: 'failed',
  3: 'cancelled',
};

const FALLBACK_METADATA = {
  title: 'unname project',
  summary: 'The detailed description of the project is not available, please try again later.',
  description: 'No project introduction content.',
  imageUrl:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
  category: 'unclassified',
};

type NormalisedMetadata = {
  title: string;
  summary: string;
  description: string;
  imageUrl: string;
  category: string;
};

const metadataCache = new Map<string, NormalisedMetadata>();

const WEI_PER_ETH = 1_000_000_000_000_000_000n;

function ensureAddress(value: string | undefined | null): Address | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed as Address;
  }
  return null;
}

function resolveRpcUrl() {
  const direct =
    process.env.NEXT_PUBLIC_RPC_URL?.trim() || process.env.NEXT_PUBLIC_RPC_HTTP?.trim();
  return direct && direct.length > 0 ? direct : 'http://127.0.0.1:8545';
}

function resolveChainId() {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return manifest.chainId;
}

function resolveMetadataUrl(uri: string) {
  if (!uri) {
    return null;
  }
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`;
  }
  return uri;
}

async function fetchMetadata(uri: string): Promise<NormalisedMetadata> {
  if (metadataCache.has(uri)) {
    return metadataCache.get(uri)!;
  }

  const url = resolveMetadataUrl(uri);
  if (!url) {
    metadataCache.set(uri, FALLBACK_METADATA);
    return FALLBACK_METADATA;
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Metadata fetch failed: ${response.status}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;

    const title =
      typeof raw.title === 'string' && raw.title.trim().length > 0
        ? (raw.title as string)
        : FALLBACK_METADATA.title;
    const summary =
      typeof raw.summary === 'string' && raw.summary.trim().length > 0
        ? (raw.summary as string)
        : typeof raw.tagline === 'string' && raw.tagline.trim().length > 0
          ? (raw.tagline as string)
          : FALLBACK_METADATA.summary;
    const description =
      typeof raw.description === 'string' && raw.description.trim().length > 0
        ? (raw.description as string)
        : summary;
    const image =
      typeof raw.image === 'string' && raw.image.trim().length > 0
        ? (raw.image as string)
        : typeof raw.cover === 'string' && raw.cover.trim().length > 0
          ? (raw.cover as string)
          : FALLBACK_METADATA.imageUrl;
    const category =
      typeof raw.category === 'string' && raw.category.trim().length > 0
        ? (raw.category as string)
        : FALLBACK_METADATA.category;

    const normalised: NormalisedMetadata = {
      title,
      summary,
      description,
      imageUrl: image,
      category,
    };

    metadataCache.set(uri, normalised);
    return normalised;
  } catch (error) {
    console.warn('Metadata fetch fallback', error);
    metadataCache.set(uri, FALLBACK_METADATA);
    return FALLBACK_METADATA;
  }
}

function toEth(value: bigint) {
  try {
    const whole = Number(value / WEI_PER_ETH);
    const fraction = Number(value % WEI_PER_ETH) / 1e18;
    return whole + fraction;
  } catch {
    return 0;
  }
}

function createClient() {
  const rpcUrl = resolveRpcUrl();
  const chainId = resolveChainId();

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

async function readCampaign(address: Address) {
  const client = createClient();
  try {
    const [summary, metadataURI] = await client.multicall({
      allowFailure: false,
      contracts: [
        { address, abi: campaignAbi, functionName: 'getSummary' },
        { address, abi: campaignAbi, functionName: 'metadataURI' },
      ],
    });
    return { summary, metadataURI };
  } catch (error) {
    console.warn('Multicall failed, falling back to single reads', error);
    const [summary, metadataURI] = await Promise.all([
      client.readContract({ address, abi: campaignAbi, functionName: 'getSummary' }),
      client.readContract({ address, abi: campaignAbi, functionName: 'metadataURI' }),
    ]);
    return { summary, metadataURI };
  }
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const address = ensureAddress(projectId);
  if (!address) {
    return null;
  }

  try {
    const { summary, metadataURI } = await readCampaign(address);
    const [creator, goal, deadline, statusIndex, totalPledged] = summary as [
      Address,
      bigint,
      bigint,
      number,
      bigint,
    ];

    const metadata = await fetchMetadata(metadataURI as string);

    const deadlineSeconds = Number(deadline);
    const goalAmount = toEth(goal);
    const pledgedAmount = toEth(totalPledged);

    const status = statusMap[statusIndex] ?? 'active';
    const deadlineIso = Number.isFinite(deadlineSeconds)
      ? new Date(deadlineSeconds * 1000).toISOString()
      : new Date().toISOString();

    const project: ProjectDetail = {
      id: address,
      title: metadata.title,
      summary: metadata.summary,
      description: metadata.description,
      goalAmount,
      pledgedAmount,
      deadline: deadlineIso,
      status,
      creator,
      category: metadata.category,
      imageUrl: metadata.imageUrl,
      owner: creator,
      backerCount: 0,
    };

    return project;
  } catch (error) {
    console.error('Failed to fetch project detail', error);
    return null;
  }
}
