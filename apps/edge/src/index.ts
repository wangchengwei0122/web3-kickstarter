import { createPublicClient, http, type AbiEvent, type Address } from "viem";
import { campaignAbi, campaignFactoryAbi } from "@packages/contracts/abi";

const LATEST_INDEX_KEY = "kv:crowd:index";
const DEADLINE_INDEX_KEY = "kv:crowd:index:deadline";
const CHECKPOINT_KEY = "kv:crowd:checkpoint";
const CAMPAIGN_KEY_PREFIX = "kv:crowd:campaign:";
const DEFAULT_LIMIT = 12;
const MAX_INDEX_SIZE = 1024;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 750;

const campaignCreatedEvent = getCampaignCreatedEvent();

interface CampaignRecord {
  address: Address;
  creator: Address;
  goal: string;
  deadline: number;
  status: number;
  totalPledged: string;
  metadataURI: string;
  createdAt: number;
  createdBlock: number;
}

interface CampaignListResponse {
  campaigns: CampaignRecord[];
  cursor: number;
  nextCursor: number | null;
  hasMore: boolean;
  sort: "latest" | "deadline";
  total: number;
}

interface DeadlineEntry {
  address: string;
  deadline: number;
}

interface Env {
  KV: KVNamespace;
  RPC_URL: string;
  CHAIN_ID: string;
  FACTORY: string;
  DEPLOY_BLOCK: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400"
};

function withCors(init: ResponseInit = {}, body?: BodyInit | null) {
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  if (body === undefined) {
    return new Response(null, { ...init, headers });
  }
  return new Response(body, { ...init, headers });
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  return withCors({ ...init, headers }, JSON.stringify(body));
}

const isValidAddress = (value: string): value is Address => /^0x[a-fA-F0-9]{40}$/.test(value);
const normaliseAddress = (value: string) => value.toLowerCase();

function getCampaignCreatedEvent(): AbiEvent {
  const event = campaignFactoryAbi.find(
    (item): item is AbiEvent => item.type === "event" && item.name === "CampaignCreated"
  );
  if (!event) {
    throw new Error("CampaignCreated event not found in factory ABI");
  }
  return event;
}

async function withRetry<T>(operation: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }
    const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(operation, attempt + 1);
  }
}

function parseRequiredBigInt(value: string, label: string): bigint {
  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function createClient(env: Env) {
  const chainId = Number.parseInt(env.CHAIN_ID, 10);
  if (Number.isNaN(chainId)) {
    throw new Error("Invalid CHAIN_ID env");
  }

  return createPublicClient({
    chain: {
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.RPC_URL] }, public: { http: [env.RPC_URL] } }
    },
    transport: http(env.RPC_URL)
  });
}

async function getLatestIndex(env: Env): Promise<string[]> {
  const raw = await env.KV.get(LATEST_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch (error) {
    console.warn("Failed to parse latest index", error);
    return [];
  }
}

async function putLatestIndex(env: Env, addresses: string[]) {
  const trimmed = addresses.slice(0, MAX_INDEX_SIZE);
  await env.KV.put(LATEST_INDEX_KEY, JSON.stringify(trimmed));
}

async function getDeadlineIndex(env: Env): Promise<DeadlineEntry[]> {
  const raw = await env.KV.get(DEADLINE_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (item && typeof item === "object" && "address" in item && "deadline" in item) {
          const address = (item as Record<string, unknown>).address;
          const deadline = (item as Record<string, unknown>).deadline;
          if (typeof address === "string" && typeof deadline === "number") {
            return { address, deadline } satisfies DeadlineEntry;
          }
        }
        if (typeof item === "string") {
          return { address: item, deadline: Number.POSITIVE_INFINITY } satisfies DeadlineEntry;
        }
        return null;
      })
      .filter((entry): entry is DeadlineEntry => entry !== null);
  } catch (error) {
    console.warn("Failed to parse deadline index", error);
    return [];
  }
}

async function putDeadlineIndex(env: Env, entries: DeadlineEntry[]) {
  const trimmed = entries.slice(0, MAX_INDEX_SIZE);
  await env.KV.put(DEADLINE_INDEX_KEY, JSON.stringify(trimmed));
}

async function loadCampaign(env: Env, address: string) {
  const record = await env.KV.get(CAMPAIGN_KEY_PREFIX + normaliseAddress(address), "json");
  if (!record) return null;
  return record as CampaignRecord;
}

async function handleCampaignsRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");
  const sortParam = url.searchParams.get("sort");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;
  const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : 0;
  const sort = sortParam === "deadline" ? "deadline" : "latest";

  if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
    return jsonResponse({ error: "Invalid limit" }, { status: 400 });
  }
  if (Number.isNaN(cursor) || cursor < 0) {
    return jsonResponse({ error: "Invalid cursor" }, { status: 400 });
  }

  const addresses = sort === "latest"
    ? await getLatestIndex(env)
    : (await getDeadlineIndex(env)).map((entry) => entry.address);

  const page = addresses.slice(cursor, cursor + limit);
  const campaignsRaw = await Promise.all(page.map((address) => loadCampaign(env, address)));
  const campaigns = campaignsRaw.filter((item): item is CampaignRecord => Boolean(item));

  const nextCursor = cursor + page.length < addresses.length ? cursor + page.length : null;

  const body: CampaignListResponse = {
    campaigns,
    cursor,
    nextCursor,
    hasMore: nextCursor !== null,
    sort,
    total: addresses.length
  };

  return jsonResponse(body, { status: 200, headers: { "Cache-Control": "no-store" } });
}

async function updateLatestIndex(env: Env, address: Address) {
  const normalised = normaliseAddress(address);
  const index = await getLatestIndex(env);
  const filtered = index.filter((item) => normaliseAddress(item) !== normalised);
  filtered.unshift(normalised);
  await putLatestIndex(env, filtered);
}

async function updateDeadlineIndex(env: Env, address: Address, deadline: number) {
  const normalised = normaliseAddress(address);
  const index = await getDeadlineIndex(env);
  const filtered = index.filter((item) => normaliseAddress(item.address) !== normalised);
  filtered.push({ address: normalised, deadline });
  filtered.sort((a, b) => a.deadline - b.deadline);
  await putDeadlineIndex(env, filtered);
}

async function persistCampaign(env: Env, record: CampaignRecord) {
  const keyAddress = normaliseAddress(record.address);
  const storedRecord: CampaignRecord = { ...record, address: keyAddress as Address };
  await env.KV.put(CAMPAIGN_KEY_PREFIX + keyAddress, JSON.stringify(storedRecord));
  await updateLatestIndex(env, storedRecord.address);
  await updateDeadlineIndex(env, storedRecord.address, storedRecord.deadline);
}

async function runIndexer(env: Env) {
  const factoryAddress = env.FACTORY;
  if (!isValidAddress(factoryAddress)) {
    throw new Error("FACTORY env must be a valid address");
  }

  const deployBlock = parseRequiredBigInt(env.DEPLOY_BLOCK, "DEPLOY_BLOCK");
  const client = createClient(env);

  const lastProcessedRaw = await env.KV.get(CHECKPOINT_KEY);
  const fromBlock = lastProcessedRaw ? parseRequiredBigInt(lastProcessedRaw, "checkpoint") + 1n : deployBlock;
  const headBlock = await withRetry(() => client.getBlockNumber());

  if (fromBlock > headBlock) {
    await env.KV.put(CHECKPOINT_KEY, headBlock.toString());
    return;
  }

  const logs = await withRetry(() =>
    client.getLogs({
      address: factoryAddress as Address,
      event: campaignCreatedEvent,
      fromBlock,
      toBlock: headBlock
    })
  );

  for (const log of logs) {
    const campaignAddress = log.args.campaign as Address;
    const existing = await loadCampaign(env, campaignAddress);
    if (existing) {
      continue;
    }

    const [summary, metadata] = await withRetry(() =>
      client.multicall({
        allowFailure: false,
        contracts: [
          {
            address: campaignAddress,
            abi: campaignAbi,
            functionName: "getSummary"
          },
          {
            address: campaignAddress,
            abi: campaignAbi,
            functionName: "metadataURI"
          }
        ]
      })
    );

    const [creator, goal, deadline, status, totalPledged] = summary as [
      Address,
      bigint,
      bigint,
      number,
      bigint
    ];

    const block = await withRetry(() => client.getBlock({ blockNumber: log.blockNumber }));

    const record: CampaignRecord = {
      address: campaignAddress,
      creator,
      goal: goal.toString(),
      deadline: Number(deadline),
      status: Number(status),
      totalPledged: totalPledged.toString(),
      metadataURI: metadata as string,
      createdAt: Number(block.timestamp),
      createdBlock: Number(log.blockNumber)
    };

    await persistCampaign(env, record);
  }

  const newCheckpoint = logs.length > 0 ? logs[logs.length - 1]!.blockNumber : headBlock;
  await env.KV.put(CHECKPOINT_KEY, newCheckpoint.toString());
}

async function handleHealthRequest(env: Env) {
  const client = createClient(env);
  const [checkpointRaw, latestIndex, headNumber] = await Promise.all([
    env.KV.get(CHECKPOINT_KEY),
    getLatestIndex(env),
    withRetry(() => client.getBlockNumber())
  ]);

  const headBlock = await withRetry(() => client.getBlock({ blockNumber: headNumber }));
  const lastIndexedNumber = checkpointRaw ? parseRequiredBigInt(checkpointRaw, "checkpoint") : null;
  const lastIndexedBlock = lastIndexedNumber
    ? await withRetry(() => client.getBlock({ blockNumber: lastIndexedNumber }))
    : null;

  const lagSeconds = lastIndexedBlock ? Number(headBlock.timestamp - lastIndexedBlock.timestamp) : null;

  const body = {
    head: headNumber.toString(),
    lastIndexedBlock: lastIndexedNumber ? lastIndexedNumber.toString() : null,
    lagSeconds,
    count: latestIndex.length
  };

  return jsonResponse(body, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return withCors({ status: 204 });
    }

    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/campaigns") {
        return await handleCampaignsRequest(request, env);
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return await handleHealthRequest(env);
      }
      return jsonResponse({ error: "Not Found" }, { status: 404 });
    } catch (error) {
      console.error("Request failed", error);
      return jsonResponse({ error: "Internal Error" }, { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runIndexer(env).catch((error) => {
        console.error("Indexer run failed", error);
      })
    );
  }
} satisfies ExportedHandler<Env>;
