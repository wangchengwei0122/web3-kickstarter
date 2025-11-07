import 'dotenv/config';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { db } from './db/client';
import { campaigns, checkpoints } from './db/schema';
import { eq } from 'drizzle-orm';

const RPC_HTTP = must('RPC_HTTP');
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY').toLowerCase() as Address;
const DEPLOY_BLOCK = BigInt(must('DEPLOY_BLOCK'));
const BLOCK_BATCH = BigInt(process.env.BLOCK_BATCH ?? '10');

const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: `chain-${CHAIN_ID}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC_HTTP] }, public: { http: [RPC_HTTP] } },
  },
  transport: http(RPC_HTTP),
});

const campaignCreatedEvent = parseAbiItem(
  'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
);

function must(key: string) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env ${key}`);
  return val;
}

async function getCheckpoint() {
  const id = `factory:${FACTORY}`;
  const row = await db.query.checkpoints.findFirst({ where: eq(checkpoints.id, id) });
  return row?.block ?? null;
}

async function setCheckpoint(block: bigint) {
  const id = `factory:${FACTORY}`;
  await db
    .insert(checkpoints)
    .values({ id, block })
    .onConflictDoUpdate({ target: checkpoints.id, set: { block } });
}

async function runIndexer() {
  const head = await client.getBlockNumber();
  let from = (await getCheckpoint()) ?? DEPLOY_BLOCK;

  console.log(`🔍 Scanning from ${from} to ${head}`);

  while (from <= head) {
    const to = from + BLOCK_BATCH - 1n > head ? head : from + BLOCK_BATCH - 1n;
    const logs = await client.getLogs({
      address: FACTORY,
      event: campaignCreatedEvent,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      const { campaign, creator } = log.args as any;
      console.log(`📦 New campaign: ${campaign} (creator: ${creator})`);

      // 存储到数据库（简版，只保存基础信息）
      await db
        .insert(campaigns)
        .values({
          address: campaign.toLowerCase(),
          creator: creator.toLowerCase(),
          goal: '0',
          deadline: 0,
          status: 0,
          totalPledged: '0',
          metadataURI: '',
          createdAt: Date.now(),
          createdBlock: Number(log.blockNumber ?? 0),
        })
        .onConflictDoNothing();
    }

    await setCheckpoint(to);
    from = to + 1n;
  }

  console.log('✅ Sync complete');
}

runIndexer().catch((e) => console.error(e));
