import { createPublicClient, http, parseAbiItem, webSocket, type Address, type Log } from 'viem';
import { db } from './db/client.js';
import { campaigns, checkpoints } from '@packages/db';
import { eq } from 'drizzle-orm';
import { withRetry, delay, formatBigInt, formatAddress } from './utils.js';
import { CampaignStatus, type CampaignSummary } from './types.js';
import { campaignAbi, campaignFactoryAbi } from '../abi';
console.log('🔥 BUILD VERSION = 2025-11-17-22:30');
/* --------------------------
 *  ENV & CONSTANTS
 * -------------------------- */
const RPC_HTTP = must('RPC_HTTP');
const RPC_WSS = must('RPC_WSS');
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY').toLowerCase() as Address;
const DEPLOY_BLOCK = BigInt(must('DEPLOY_BLOCK'));

const BLOCK_BATCH = BigInt(process.env.BLOCK_BATCH ?? '500');
const RPC_DELAY_MS = Number(process.env.RPC_DELAY_MS ?? 300);
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS ?? 30_000);
const RECONNECT_BACKOFF = [1_000, 2_000, 5_000, 10_000] as const;

/* --------------------------
 *  CLIENTS
 * -------------------------- */
const chain = {
  id: CHAIN_ID,
  name: `chain-${CHAIN_ID}`,
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_HTTP], webSocket: [RPC_WSS] },
    public: { http: [RPC_HTTP], webSocket: [RPC_WSS] },
  },
} as const;

const httpClient = createPublicClient({
  chain,
  transport: http(RPC_HTTP),
});

// WebSocket 客户端（延迟初始化，失败时回退到 HTTP）
let wsClient: ReturnType<typeof createPublicClient> | null = null;

async function initWsClient(): Promise<void> {
  try {
    wsClient = createPublicClient({
      chain,
      transport: webSocket(RPC_WSS),
    });
    // 测试连接
    await wsClient.getBlockNumber();
    console.log('✅ WebSocket client initialized');
  } catch (error) {
    console.warn('⚠️ WebSocket initialization failed, will use HTTP polling:', error);
    wsClient = null;
  }
}

const campaignCreatedEvent = parseAbiItem(
  'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
);

type CampaignCreatedLog = Log & {
  args: {
    campaign: Address;
    creator: Address;
    id: bigint;
  };
};

/* --------------------------
 *  CHECKPOINT STATE
 * -------------------------- */
let latestCheckpoint: bigint = 0n;

async function readCheckpoint(): Promise<bigint | null> {
  const row = await db.query.checkpoints.findFirst({
    where: eq(checkpoints.id, `factory:${FACTORY}`),
  });
  if (!row?.block) return null;
  latestCheckpoint = BigInt(row.block);
  return latestCheckpoint;
}

async function writeCheckpoint(block: bigint): Promise<void> {
  if (block <= latestCheckpoint) return;
  await db
    .insert(checkpoints)
    .values({ id: `factory:${FACTORY}`, block: Number(block) })
    .onConflictDoUpdate({
      target: checkpoints.id,
      set: { block: Number(block) },
    });
  latestCheckpoint = block;
  console.log(`✅ Checkpoint advanced → ${block}`);
}

/* --------------------------
 *  CATCH-UP & FULL SYNC
 * -------------------------- */
async function syncRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
  if (fromBlock > toBlock) return;

  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const batchEnd = cursor + BLOCK_BATCH - 1n > toBlock ? toBlock : cursor + BLOCK_BATCH - 1n;
    console.log(`⏳ Syncing ${cursor} → ${batchEnd}`);

    const logs = await httpClient.getLogs({
      address: FACTORY,
      event: campaignCreatedEvent,
      fromBlock: cursor,
      toBlock: batchEnd,
    });

    await handleCampaignLogs(logs as CampaignCreatedLog[]);

    await writeCheckpoint(batchEnd);
    cursor = batchEnd + 1n;
    await delay(RPC_DELAY_MS);
  }
}

async function fullSyncIfNeeded(): Promise<void> {
  if (latestCheckpoint > 0n) return;
  console.log('🧱 Running full sync...');
  const head = await httpClient.getBlockNumber();
  await syncRange(DEPLOY_BLOCK, head);
}

async function catchUpFromCheckpoint(): Promise<void> {
  const head = await httpClient.getBlockNumber();
  const nextBlock = latestCheckpoint === 0n ? DEPLOY_BLOCK : latestCheckpoint + 1n;
  if (head < nextBlock) return;
  await syncRange(nextBlock, head);
}

/* --------------------------
 *  CAMPAIGN PROCESSING
 * -------------------------- */
async function handleCampaignLogs(logs: CampaignCreatedLog[]): Promise<void> {
  if (!logs.length) return;
  const addresses = logs.map((log) => log.args.campaign);
  const summaries = await fetchCampaignSummaries(addresses);

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const summary = summaries[i];
    if (!summary) {
      console.warn(`⚠️ Skip campaign ${log.args.campaign}, summary missing`);
      continue;
    }
    await upsertCampaign(log.args.campaign, summary, log.blockNumber ?? latestCheckpoint);
  }

  const highestBlock = logs.reduce(
    (max, log) => (log.blockNumber && log.blockNumber > max ? log.blockNumber : max),
    latestCheckpoint
  );
  if (highestBlock > latestCheckpoint) {
    await writeCheckpoint(highestBlock);
  }
}

async function fetchCampaignSummaries(
  addresses: Address[]
): Promise<Array<CampaignSummary | null>> {
  if (!addresses.length) return [];

  // 如果 WebSocket 不可用，使用 HTTP 客户端
  const client = wsClient || httpClient;

  const responses = await withRetry(
    () =>
      client.multicall({
        allowFailure: true,
        contracts: addresses.map((address) => ({
          address,
          abi: campaignAbi,
          functionName: 'getSummary',
        })),
      }),
    3,
    1_000
  );

  return Promise.all(
    responses.map(async (response, idx) => {
      if (response.status === 'success') {
        return normalizeSummary(response.result as readonly unknown[]);
      }
      console.warn(
        `⚠️ Multicall failed for ${addresses[idx]}, fallback to single read`,
        response.error
      );
      try {
        return await withRetry(() => fetchCampaignSummary(addresses[idx]), 2, 1_000);
      } catch (error) {
        console.error(`❌ Failed to fetch summary for ${addresses[idx]}`, error);
        return null;
      }
    })
  );
}

function normalizeSummary(result: readonly unknown[]): CampaignSummary {
  const [creator, goal, deadline, status, totalPledged, metadataURI, factory] = result as [
    Address,
    bigint,
    bigint,
    number,
    bigint,
    string,
    Address,
  ];
  return {
    creator,
    goal,
    deadline,
    status: status as CampaignStatus,
    totalPledged,
    metadataURI,
    factory,
  };
}

async function fetchCampaignSummary(addr: Address): Promise<CampaignSummary> {
  // 如果 WebSocket 不可用，使用 HTTP 客户端
  const client = wsClient || httpClient;
  const res = await client.readContract({
    address: addr,
    abi: campaignAbi,
    functionName: 'getSummary',
  });
  return normalizeSummary(res as readonly unknown[]);
}

async function upsertCampaign(
  addr: Address,
  summary: CampaignSummary,
  block: bigint
): Promise<void> {
  console.log(`📦 Upsert campaign ${addr} @ block ${block}`);
  await db
    .insert(campaigns)
    .values({
      address: formatAddress(addr),
      creator: formatAddress(summary.creator),
      goal: formatBigInt(summary.goal),
      deadline: Number(summary.deadline),
      status: summary.status,
      totalPledged: formatBigInt(summary.totalPledged),
      metadataURI: summary.metadataURI,
      createdAt: new Date(),
      createdBlock: Number(block),
    })
    .onConflictDoUpdate({
      target: campaigns.address,
      set: {
        goal: formatBigInt(summary.goal),
        status: summary.status,
        totalPledged: formatBigInt(summary.totalPledged),
        deadline: Number(summary.deadline),
        metadataURI: summary.metadataURI,
      },
    });
}

/* --------------------------
 *  WATCHERS & RECONNECT
 * -------------------------- */
let watcherCleanups: Array<() => void> = [];
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;

function registerWatcher(cleanup: () => void): void {
  watcherCleanups.push(cleanup);
}

function stopWatchers(): void {
  for (const cleanup of watcherCleanups) {
    try {
      cleanup();
    } catch (error) {
      console.error('⚠️ Failed to stop watcher', error);
    }
  }
  watcherCleanups = [];
}

async function startWatchers(): Promise<void> {
  stopWatchers();
  reconnectAttempts = 0;

  // 如果 WebSocket 不可用，跳过实时监听，使用轮询模式
  if (!wsClient) {
    console.log('⚠️ WebSocket not available, using polling mode');
    // 设置定期轮询
    setInterval(async () => {
      await catchUpFromCheckpoint().catch((error) => console.error('❌ Polling error', error));
    }, UPDATE_INTERVAL_MS);
    return;
  }

  try {
    registerWatcher(
      wsClient.watchBlocks({
        blockTag: 'finalized',
        onBlock: async (block) => {
          console.log(`🔔 Finalized block ${block.number}`);
        },
        onError: handleWatchError,
      })
    );

    registerWatcher(
      wsClient.watchContractEvent({
        address: FACTORY,
        abi: campaignFactoryAbi,
        eventName: 'CampaignCreated',
        onLogs: async (logs) => {
          await handleCampaignLogs(logs as CampaignCreatedLog[]);
        },
        onError: handleWatchError,
      })
    );

    console.log('👀 Live watchers started');
  } catch (error) {
    console.error('❌ Failed to start watchers', error);
    // 回退到轮询模式
    setInterval(async () => {
      await catchUpFromCheckpoint().catch((error) => console.error('❌ Polling error', error));
    }, UPDATE_INTERVAL_MS);
  }
}

function handleWatchError(error: unknown): void {
  console.error('❌ Watcher error', error);
  stopWatchers();
  queueReconnect();
}

function queueReconnect(): void {
  if (reconnectTimer) return;
  // 如果 WebSocket 不可用，不尝试重连
  if (!wsClient) {
    console.log('⚠️ WebSocket not available, skipping reconnect');
    return;
  }
  const delayMs = RECONNECT_BACKOFF[Math.min(reconnectAttempts, RECONNECT_BACKOFF.length - 1)];
  reconnectAttempts = Math.min(reconnectAttempts + 1, RECONNECT_BACKOFF.length - 1);
  console.log(`🔁 Reconnecting WebSocket in ${delayMs}ms`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await catchUpFromCheckpoint();
      await startWatchers();
    } catch (error) {
      console.error('❌ Failed to restart watchers', error);
      queueReconnect();
    }
  }, delayMs);
}

/* --------------------------
 *  ACTIVE CAMPAIGN UPDATES
 * -------------------------- */
async function updateActiveCampaigns(): Promise<void> {
  const active = await db.query.campaigns.findMany({
    where: eq(campaigns.status, CampaignStatus.Active),
  });

  for (const c of active) {
    const summary = await withRetry(() => fetchCampaignSummary(c.address as Address), 2, 1_000);
    await db
      .update(campaigns)
      .set({
        status: summary.status,
        totalPledged: formatBigInt(summary.totalPledged),
        deadline: Number(summary.deadline),
        metadataURI: summary.metadataURI,
      })
      .where(eq(campaigns.address, c.address));
    await delay(RPC_DELAY_MS);
  }
}

/* --------------------------
 *  UTILITIES
 * -------------------------- */
function must(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
}

/* --------------------------
 *  MAIN
 * -------------------------- */
async function main() {
  console.log('🚀 Indexer booting');
  console.log(`📌 Factory: ${FACTORY}`);
  console.log(`📡 HTTP: ${RPC_HTTP}`);
  console.log(`📡 WSS: ${RPC_WSS}`);

  // 初始化 WebSocket 客户端（非阻塞）
  await initWsClient();

  await readCheckpoint();
  await fullSyncIfNeeded();
  await catchUpFromCheckpoint();
  await startWatchers();

  setInterval(() => {
    updateActiveCampaigns().catch((error) => console.error('❌ updateActive error', error));
  }, UPDATE_INTERVAL_MS);
}

main().catch((error) => {
  console.error('❌ Fatal error', error);
  process.exit(1);
});
