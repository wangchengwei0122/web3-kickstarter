import 'dotenv/config';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { watchBlockNumber } from 'viem/actions';
import { db } from './db/client.js';
import { campaigns, checkpoints } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { withRetry, delay, formatBigInt, formatAddress, formatBlockNumber } from './utils.js';
import { CampaignStatus, type CampaignSummary } from './types.js';

/**
 * -----------------------------
 *  1. 环境变量与配置
 * -----------------------------
 */

const RPC_HTTP = must('RPC_HTTP');
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY').toLowerCase() as Address;
const DEPLOY_BLOCK = BigInt(must('DEPLOY_BLOCK'));

const BLOCK_BATCH = BigInt(process.env.BLOCK_BATCH ?? '10');
const RPC_DELAY_MS = Number(process.env.RPC_DELAY_MS ?? '100');
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? '3');
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS ?? '1000');
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS ?? '60000');

validateRpcUrl(RPC_HTTP);

/**
 * -----------------------------
 *  2. viem 公共客户端
 * -----------------------------
 */

const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: `chain-${CHAIN_ID}`,
    rpcUrls: {
      default: { http: [RPC_HTTP] },
      public: { http: [RPC_HTTP] },
    },
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  },
  transport: http(RPC_HTTP),
});

/**
 * -----------------------------
 *  3. ABI 与事件
 * -----------------------------
 */

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

/**
 * -----------------------------
 *  4. 工具函数
 * -----------------------------
 */

function must(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env ${key}`);
  return val;
}

function validateRpcUrl(url: string): void {
  const placeholders = ['xxxx', 'your-rpc', 'YOUR_API_KEY', 'placeholder'];
  if (placeholders.some((p) => url.includes(p))) {
    console.error('❌ RPC_HTTP 设置错误，请填写真实 RPC URL');
    throw new Error('Invalid RPC_HTTP');
  }
}

/**
 * -----------------------------
 *  5. 数据库操作
 * -----------------------------
 */

async function getCheckpoint(): Promise<bigint | null> {
  const id = `factory:${FACTORY}`;
  const row = await db.query.checkpoints.findFirst({
    where: eq(checkpoints.id, id),
  });
  return row?.block ? BigInt(row.block) : null;
}

async function setCheckpoint(block: bigint): Promise<void> {
  const id = `factory:${FACTORY}`;
  await db
    .insert(checkpoints)
    .values({ id, block: Number(block) })
    .onConflictDoUpdate({
      target: checkpoints.id,
      set: { block: Number(block) },
    });
}

/**
 * -----------------------------
 *  6. 读取合约
 * -----------------------------
 */

async function fetchCampaignSummary(campaignAddress: Address): Promise<CampaignSummary> {
  const result = await client.readContract({
    address: campaignAddress,
    abi: CAMPAIGN_ABI,
    functionName: 'getSummary',
  });

  return {
    creator: result[0] as Address,
    goal: result[1] as bigint,
    deadline: result[2] as bigint,
    status: result[3] as CampaignStatus,
    totalPledged: result[4] as bigint,
    metadataURI: result[5] as string,
    factory: result[6] as Address,
  };
}

async function processNewCampaign(campaign: Address, creator: Address, block: bigint) {
  console.log(`📦 New campaign ${campaign}`);

  const summary = await withRetry(
    () => fetchCampaignSummary(campaign),
    MAX_RETRIES,
    RETRY_DELAY_MS,
    (err, attempt) => {
      console.warn(`⚠️ Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
    }
  );

  await db
    .insert(campaigns)
    .values({
      address: formatAddress(campaign),
      creator: formatAddress(summary.creator),
      goal: formatBigInt(summary.goal),
      deadline: Number(summary.deadline),
      status: summary.status,
      totalPledged: formatBigInt(summary.totalPledged),
      metadataURI: summary.metadataURI,
      createdAt: new Date(),
      createdBlock: formatBlockNumber(block),
    })
    .onConflictDoUpdate({
      target: campaigns.address,
      set: {
        creator: formatAddress(summary.creator),
        goal: formatBigInt(summary.goal),
        deadline: Number(summary.deadline),
        status: summary.status,
        totalPledged: formatBigInt(summary.totalPledged),
        metadataURI: summary.metadataURI,
      },
    });
}

/**
 * -----------------------------
 *  7. 区块扫描（增量）
 * -----------------------------
 */

async function runIndexer(latestBlock?: bigint): Promise<void> {
  const head = latestBlock ?? (await client.getBlockNumber());
  let from = (await getCheckpoint()) ?? DEPLOY_BLOCK;

  if (from > DEPLOY_BLOCK) from++;

  console.log(`🔎 Scan ${from} → ${head}`);

  while (from <= head) {
    const to = from + BLOCK_BATCH - 1n > head ? head : from + BLOCK_BATCH - 1n;

    try {
      const logs = await withRetry(
        () =>
          client.getLogs({
            address: FACTORY,
            event: campaignCreatedEvent,
            fromBlock: from,
            toBlock: to,
          }),
        MAX_RETRIES,
        RETRY_DELAY_MS
      );

      for (const log of logs) {
        const { campaign, creator } = log.args as {
          campaign: Address;
          creator: Address;
        };
        await processNewCampaign(campaign, creator, log.blockNumber ?? 0n);
        await delay(RPC_DELAY_MS);
      }

      await setCheckpoint(to);

      console.log(`✅ Indexed ${from} → ${to} (${logs.length} new)`);

      from = to + 1n;
      await delay(RPC_DELAY_MS);
    } catch (error) {
      console.error(`❌ Error for ${from} → ${to}:`, error);
      from = to + 1n;
    }
  }
}

/**
 * -----------------------------
 *  8. Active campaign 定期更新
 * -----------------------------
 */

async function updateExistingCampaigns(): Promise<void> {
  console.log(`🔄 Updating active campaigns...`);

  const active = await db.query.campaigns.findMany({
    where: eq(campaigns.status, CampaignStatus.Active),
  });

  for (const campaign of active) {
    try {
      const summary = await fetchCampaignSummary(campaign.address as Address);

      await db
        .update(campaigns)
        .set({
          status: summary.status,
          totalPledged: formatBigInt(summary.totalPledged),
          deadline: Number(summary.deadline),
          metadataURI: summary.metadataURI,
        })
        .where(eq(campaigns.address, campaign.address));
    } catch (err) {
      console.error(`❌ Update error for ${campaign.address}:`, err);
    }

    await delay(RPC_DELAY_MS);
  }

  console.log('✅ Active campaigns updated');
}

/**
 * -----------------------------
 *  9. 主函数：首次同步 + 实时监听
 * -----------------------------
 */

async function main() {
  console.log('🚀 Indexer started');
  console.log(`📌 Factory: ${FACTORY}`);
  console.log(`📌 RPC: ${RPC_HTTP}`);

  let processing = false;

  // 🟦 首次 full sync
  await runIndexer();

  // 🟩 实时监听新区块
  watchBlockNumber(client, {
    onBlockNumber: async (blockNumber) => {
      if (processing) return;
      processing = true;

      try {
        await runIndexer(blockNumber);
      } finally {
        processing = false;
      }
    },
    onError: (err) => console.error('❌ Block watcher error:', err),
  });

  // 🟨 每分钟更新 active campaigns
  setInterval(updateExistingCampaigns, UPDATE_INTERVAL_MS);

  console.log(`⏰ Active campaigns update every ${UPDATE_INTERVAL_MS / 1000}s`);
}

/**
 * -----------------------------
 * 10. 启动
 * -----------------------------
 */

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
