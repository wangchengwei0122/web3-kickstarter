import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { watchBlockNumber } from 'viem/actions';
import { db } from './db/client.js';
import { campaigns, checkpoints } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { withRetry, delay, formatBigInt, formatAddress, formatBlockNumber } from './utils.js';
import { CampaignStatus, type CampaignSummary } from './types.js';

/* --------------------------
 *  ENV
 * -------------------------- */
const RPC_HTTP = must('RPC_HTTP');
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY').toLowerCase() as Address;
const DEPLOY_BLOCK = BigInt(must('DEPLOY_BLOCK'));

const BLOCK_BATCH = 50n; // 批量扫描大小（大一点更省 RPC）
const RPC_DELAY_MS = 200; // 请求间隔（保险）
const UPDATE_INTERVAL_MS = 30000; // 30 秒检测 active 状态

/* --------------------------
 *  Client
 * -------------------------- */
const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: `chain-${CHAIN_ID}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC_HTTP] }, public: { http: [RPC_HTTP] } },
  },
  transport: http(RPC_HTTP),
});

/* --------------------------
 *  ABI
 * -------------------------- */
const CAMPAIGN_ABI = [
  {
    name: 'getSummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_creator', type: 'address' },
      { name: '_goal', type: 'uint256' },
      { name: '_deadline', type: 'uint64' },
      { name: '_status', type: 'uint8' },
      { name: '_totalPledged', type: 'uint256' },
      { name: '_metadataURI', type: 'string' },
      { name: '_factory', type: 'address' },
    ],
  },
] as const;

const campaignCreatedEvent = parseAbiItem(
  'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
);

/* --------------------------
 *  UTIL
 * -------------------------- */
function must(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env ${key}`);
  return val;
}

async function getCheckpoint(): Promise<bigint | null> {
  const row = await db.query.checkpoints.findFirst({
    where: eq(checkpoints.id, `factory:${FACTORY}`),
  });
  return row?.block ? BigInt(row.block) : null;
}

async function setCheckpoint(block: bigint): Promise<void> {
  await db
    .insert(checkpoints)
    .values({ id: `factory:${FACTORY}`, block: Number(block) })
    .onConflictDoUpdate({
      target: checkpoints.id,
      set: { block: Number(block) },
    });
}

/* --------------------------
 *  Fetch full summary
 * -------------------------- */
async function fetchCampaignSummary(addr: Address): Promise<CampaignSummary> {
  const res = await client.readContract({
    address: addr,
    abi: CAMPAIGN_ABI,
    functionName: 'getSummary',
  });

  return {
    creator: res[0],
    goal: res[1],
    deadline: res[2],
    status: res[3],
    totalPledged: res[4],
    metadataURI: res[5],
    factory: res[6],
  };
}

/* --------------------------
 *  Process CampaignCreated
 * -------------------------- */
async function processNewCampaign(addr: Address, creator: Address, block: bigint) {
  console.log(`📦 New campaign ${addr} at block ${block}`);

  const summary = await withRetry(() => fetchCampaignSummary(addr), 3, 1500);

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
 *  INDEX BLOCKS
 * -------------------------- */
async function indexBlocks(headBlock: bigint) {
  let from = (await getCheckpoint()) ?? DEPLOY_BLOCK;

  if (from > DEPLOY_BLOCK) from++;

  while (from <= headBlock) {
    const to = from + BLOCK_BATCH - 1n > headBlock ? headBlock : from + BLOCK_BATCH - 1n;

    const logs = await client.getLogs({
      address: FACTORY,
      event: campaignCreatedEvent,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      const { campaign, creator } = log.args as any;
      await processNewCampaign(campaign, creator, log.blockNumber);
      await delay(RPC_DELAY_MS);
    }

    await setCheckpoint(to);
    console.log(`🟢 Indexed ${from} → ${to} (${logs.length} events)`);

    from = to + 1n;
  }
}

/* --------------------------
 *  Update active campaigns
 * -------------------------- */
async function updateActive() {
  const active = await db.query.campaigns.findMany({
    where: eq(campaigns.status, CampaignStatus.Active),
  });

  for (const c of active) {
    const summary = await fetchCampaignSummary(c.address as Address);

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
 *  Main
 * -------------------------- */
async function main() {
  console.log('🚀 Indexer started');
  console.log(`📌 Factory: ${FACTORY}`);
  console.log(`📌 RPC: ${RPC_HTTP}`);

  // Full sync once
  const head = await client.getBlockNumber();
  await indexBlocks(head);

  // Watch new blocks
  watchBlockNumber(client, {
    onBlockNumber: async (block) => {
      await indexBlocks(block);
    },
    onError(err) {
      console.error('❌ Watch error:', err);
    },
  });

  // update active campaigns
  setInterval(updateActive, UPDATE_INTERVAL_MS);
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
