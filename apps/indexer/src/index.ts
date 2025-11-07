// apps/indexer/src/index.ts
import 'dotenv/config';
import {
  createPublicClient,
  http,
  webSocket,
  parseAbi,
  parseAbiItem,
  type Address,
  isHex,
} from 'viem';

const campaignAbi = parseAbi([
  'function getSummary() view returns (address creator, uint256 goal, uint64 deadline, uint8 status, uint256 totalPledged)',
  'function metadataURI() view returns (string)',
]);

const campaignCreated = parseAbiItem(
  'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
);

// ---- env ----
const RPC_HTTP = must('RPC_HTTP');
const RPC_WS = process.env.RPC_WS; // 可选
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY') as Address;
const DEPLOY_BLOCK_RAW = must('DEPLOY_BLOCK');
const EDGE_RUN = process.env.EDGE_RUN; // 可选：通知 Worker 去 /run

function must(k: string) {
  const v = process.env[k];
  if (!v || v.trim() === '') throw new Error(`Missing env ${k}`);
  return v.trim();
}
function parseBlock(v: string) {
  if (isHex(v as `0x${string}`)) return BigInt(v);
  const n = BigInt(v);
  return n;
}

// http client（读合约）
const httpClient = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: `chain-${CHAIN_ID}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC_HTTP] }, public: { http: [RPC_HTTP] } },
  },
  transport: http(RPC_HTTP),
});

// ws client（订阅事件）
const wsClient = RPC_WS
  ? createPublicClient({
      chain: {
        id: CHAIN_ID,
        name: `chain-${CHAIN_ID}`,
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [RPC_HTTP] }, public: { http: [RPC_HTTP] } },
      },
      transport: webSocket(RPC_WS),
    })
  : null;

async function handleNewCampaign(address: Address, blockNumber?: bigint) {
  try {
    // 读合约详情
    const [summary, metadata] = await httpClient.multicall({
      allowFailure: false,
      contracts: [
        { address, abi: campaignAbi, functionName: 'getSummary' },
        { address, abi: campaignAbi, functionName: 'metadataURI' },
      ],
    });

    const [creator, goal, deadline, status, totalPledged] = summary as [
      Address,
      bigint,
      bigint,
      number,
      bigint,
    ];

    console.log('🆕 Campaign', {
      address,
      creator,
      goal: goal.toString(),
      deadline: Number(deadline),
      status,
      totalPledged: totalPledged.toString(),
      metadata,
    });

    // TODO: 这里写入 Redis / Postgres / Cloudflare KV（任选其一）
    // 先给你一个“通知 Worker 跑一次 /run”的可选方案（兼容你现有 Worker）：
    if (EDGE_RUN) {
      try {
        const r = await fetch(EDGE_RUN);
        const body = await r.text();
        console.log('→ Notified worker /run:', r.status, body);
      } catch (e) {
        console.warn('Notify worker failed:', e);
      }
    }
  } catch (e) {
    console.error('read summary failed', e);
  }
}

async function start() {
  // 方式 A：WS 订阅（有 RPC_WS 就走订阅）
  if (wsClient) {
    console.log('📡 watchEvent via WS…');
    wsClient.watchEvent({
      address: FACTORY,
      event: campaignCreated,
      onLogs: async (logs) => {
        for (const l of logs) {
          const addr = l.args.campaign as Address;
          await handleNewCampaign(addr, l.blockNumber);
        }
      },
      onError: (err) => console.error('watchEvent error', err),
      pollingInterval: 0, // WS 模式不轮询
    });
    return;
  }

  // 方式 B：无 WS 时轮询 getLogs（安全批量）
  console.log('⏱ polling getLogs…');
  const BATCH = 200n; // 你的 RPC 限额自行调整
  let from = parseBlock(DEPLOY_BLOCK_RAW);

  async function tick() {
    try {
      const head = await httpClient.getBlockNumber();
      if (from > head) return;

      const to = from + BATCH > head ? head : from + BATCH;
      const logs = await httpClient.getLogs({
        address: FACTORY,
        event: campaignCreated,
        fromBlock: from,
        toBlock: to,
      });

      for (const l of logs) {
        const addr = l.args.campaign as Address;
        await handleNewCampaign(addr, l.blockNumber);
      }

      from = to + 1n;
    } catch (e) {
      console.error('poll error', e);
    }
  }

  // 简单的轮询间隔
  setInterval(tick, 5_000);
  await tick();
}

start().catch((e) => {
  console.error('fatal', e);
  process.exit(1);
});
