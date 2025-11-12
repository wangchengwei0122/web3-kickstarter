import 'dotenv/config';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { db } from './db/client.js';
import { campaigns, checkpoints } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { withRetry, delay, formatBigInt, formatAddress, formatBlockNumber } from './utils.js';
import { CampaignStatus, type CampaignSummary } from './types.js';

// 从环境变量读取配置
const RPC_HTTP = must('RPC_HTTP');
const CHAIN_ID = Number(must('CHAIN_ID'));
const FACTORY = must('FACTORY').toLowerCase() as Address;
const DEPLOY_BLOCK = BigInt(must('DEPLOY_BLOCK'));
const BLOCK_BATCH = BigInt(process.env.BLOCK_BATCH ?? '10');
const RPC_DELAY_MS = Number(process.env.RPC_DELAY_MS ?? '100'); // RPC 请求之间的延迟（毫秒）
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? '3'); // 最大重试次数
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS ?? '1000'); // 重试延迟（毫秒）
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS ?? '60000'); // 定期更新间隔（60秒）

// 验证 RPC URL 配置
validateRpcUrl(RPC_HTTP);

// 创建 viem 公共客户端
const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: `chain-${CHAIN_ID}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC_HTTP] }, public: { http: [RPC_HTTP] } },
  },
  transport: http(RPC_HTTP),
});

// Campaign ABI（仅包含需要的函数）
const CAMPAIGN_ABI = [
  {
    name: 'getSummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_creator', type: 'address', internalType: 'address' },
      { name: '_goal', type: 'uint256', internalType: 'uint256' },
      { name: '_deadline', type: 'uint64', internalType: 'uint64' },
      { name: '_status', type: 'uint8', internalType: 'enum Campaign.Status' },
      { name: '_totalPledged', type: 'uint256', internalType: 'uint256' },
      { name: '_metadataURI', type: 'string', internalType: 'string' },
      { name: '_factory', type: 'address', internalType: 'address' },
    ],
  },
] as const;

// CampaignCreated 事件定义
const campaignCreatedEvent = parseAbiItem(
  'event CampaignCreated(address indexed campaign, address indexed creator, uint256 indexed id)'
);

/**
 * 从环境变量读取必需的值，如果不存在则抛出错误
 */
function must(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env ${key}`);
  return val;
}

/**
 * 验证 RPC URL 配置
 */
function validateRpcUrl(url: string): void {
  // 检查是否包含常见的占位符
  const placeholders = ['xxxxxxxxxxxxx', 'your-rpc-url', 'YOUR_API_KEY', 'xxx', 'placeholder'];
  const hasPlaceholder = placeholders.some((placeholder) => url.includes(placeholder));
  
  if (hasPlaceholder) {
    console.error('❌ RPC URL 配置错误：检测到占位符');
    console.error(`   当前 RPC URL: ${url}`);
    console.error('');
    console.error('💡 解决方案：');
    console.error('   1. 在 apps/indexer/.env 文件中设置正确的 RPC_HTTP');
    console.error('   2. 对于 Alchemy，格式应为: https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY');
    console.error('   3. 确保 API key 是有效的，不是占位符');
    console.error('');
    throw new Error('RPC URL 包含占位符，请配置正确的 RPC_HTTP 环境变量');
  }
}

/**
 * 获取 checkpoint（最后索引的区块号）
 */
async function getCheckpoint(): Promise<bigint | null> {
  const id = `factory:${FACTORY}`;
  const row = await db.query.checkpoints.findFirst({ where: eq(checkpoints.id, id) });
  return row?.block ? BigInt(row.block) : null;
}

/**
 * 设置 checkpoint（保存最后索引的区块号）
 */
async function setCheckpoint(block: bigint): Promise<void> {
  const id = `factory:${FACTORY}`;
  await db
    .insert(checkpoints)
    .values({ id, block: Number(block) })
    .onConflictDoUpdate({ target: checkpoints.id, set: { block: Number(block) } });
}

/**
 * 从链上获取 Campaign 的完整摘要信息
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

/**
 * 处理新创建的 Campaign
 * 从链上获取完整数据并保存到数据库
 */
async function processNewCampaign(
  campaignAddress: Address,
  creator: Address,
  blockNumber: bigint
): Promise<void> {
  console.log(`📦 Processing new campaign: ${campaignAddress} (creator: ${creator})`);

  try {
    // 使用重试机制获取 Campaign 摘要
    const summary = await withRetry(
      () => fetchCampaignSummary(campaignAddress),
      MAX_RETRIES,
      RETRY_DELAY_MS,
      (error, attempt) => {
        console.warn(
          `⚠️  Failed to fetch campaign summary (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
        );
      }
    );

    // 保存到数据库
    await db
      .insert(campaigns)
      .values({
        address: formatAddress(campaignAddress),
        creator: formatAddress(summary.creator),
        goal: formatBigInt(summary.goal),
        deadline: Number(summary.deadline),
        status: summary.status,
        totalPledged: formatBigInt(summary.totalPledged),
        metadataURI: summary.metadataURI,
        createdAt: new Date(),
        createdBlock: formatBlockNumber(blockNumber),
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

    console.log(
      `✅ Campaign indexed: ${campaignAddress} | Goal: ${summary.goal} | Status: ${summary.status} | Pledged: ${summary.totalPledged}`
    );
  } catch (error) {
    console.error(`❌ Failed to process campaign ${campaignAddress}:`, error);
    throw error;
  }
}

/**
 * 更新已有 Campaign 的状态（定期调用）
 */
async function updateExistingCampaigns(): Promise<void> {
  console.log('🔄 Updating existing campaigns...');

  try {
    // 获取所有活跃的 campaigns
    const activeCampaigns = await db.query.campaigns.findMany({
      where: eq(campaigns.status, CampaignStatus.Active),
    });

    console.log(`📊 Found ${activeCampaigns.length} active campaigns to update`);

    for (const campaign of activeCampaigns) {
      try {
        // 使用重试机制获取最新状态
        const summary = await withRetry(
          () => fetchCampaignSummary(campaign.address as Address),
          MAX_RETRIES,
          RETRY_DELAY_MS,
          (error, attempt) => {
            console.warn(
              `⚠️  Failed to update campaign ${campaign.address} (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
            );
          }
        );

        // 更新数据库
        await db
          .update(campaigns)
          .set({
            status: summary.status,
            totalPledged: formatBigInt(summary.totalPledged),
            deadline: Number(summary.deadline),
            metadataURI: summary.metadataURI,
          })
          .where(eq(campaigns.address, campaign.address));

        // 如果状态发生变化，打印日志
        if (summary.status !== campaign.status) {
          console.log(
            `🔄 Campaign ${campaign.address} status changed: ${campaign.status} → ${summary.status}`
          );
        }

        // 控制 RPC 请求频率
        await delay(RPC_DELAY_MS);
      } catch (error) {
        console.error(`❌ Failed to update campaign ${campaign.address}:`, error);
        // 继续处理下一个，不中断整个更新流程
      }
    }

    console.log('✅ Campaign update complete');
  } catch (error) {
    console.error('❌ Failed to update campaigns:', error);
  }
}

/**
 * 主索引函数：扫描新区块并处理 CampaignCreated 事件
 */
async function runIndexer(): Promise<void> {
  console.log('🚀 Starting indexer...');
  console.log(`📋 Configuration:`);
  console.log(`   Factory: ${FACTORY}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  // 隐藏 RPC URL 中的敏感信息（API key）
  const maskedRpc = RPC_HTTP.replace(/(\/v2\/)([^/]+)/, '$1***');
  console.log(`   RPC: ${maskedRpc}`);
  console.log(`   Block Batch: ${BLOCK_BATCH}`);
  console.log(`   RPC Delay: ${RPC_DELAY_MS}ms`);
  console.log(`   Max Retries: ${MAX_RETRIES}`);

  // 测试 RPC 连接
  console.log('🔌 Testing RPC connection...');
  let head: bigint;
  try {
    head = await client.getBlockNumber();
    console.log(`✅ RPC connection successful. Current block: ${head}`);
  } catch (error) {
    console.error('❌ RPC connection failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('HTTP request failed') || error.message.includes('Unexpected token')) {
        console.error('');
        console.error('🔍 这通常是认证错误，请检查：');
        console.error('   1. RPC_HTTP 中的 API key 是否正确');
        console.error('   2. API key 是否已过期或被撤销');
        console.error('   3. RPC 服务提供商是否正常服务');
        console.error('');
      }
    }
    throw error;
  }
  let from = (await getCheckpoint()) ?? DEPLOY_BLOCK;

  // 如果 checkpoint 存在，从下一个区块开始
  if (from > DEPLOY_BLOCK) {
    from = from + 1n;
  }

  console.log(`🔍 Scanning from block ${from} to ${head} (${head - from + 1n} blocks)`);

  while (from <= head) {
    const to = from + BLOCK_BATCH - 1n > head ? head : from + BLOCK_BATCH - 1n;

    try {
      // 使用重试机制获取日志
      const logs = await withRetry(
        () =>
          client.getLogs({
            address: FACTORY,
            event: campaignCreatedEvent,
            fromBlock: from,
            toBlock: to,
          }),
        MAX_RETRIES,
        RETRY_DELAY_MS,
        (error, attempt) => {
          console.warn(
            `⚠️  Failed to get logs for blocks ${from}-${to} (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
          );
        }
      );

      // 处理每个 CampaignCreated 事件
      for (const log of logs) {
        const { campaign, creator } = log.args as { campaign: Address; creator: Address };
        const blockNumber = log.blockNumber ?? 0n;

        await processNewCampaign(campaign, creator, blockNumber);

        // 控制 RPC 请求频率
        await delay(RPC_DELAY_MS);
      }

      // 保存 checkpoint
      await setCheckpoint(to);
      console.log(`✅ Indexed blocks ${from}-${to} (${logs.length} new campaigns)`);

      from = to + 1n;

      // 控制 RPC 请求频率
      await delay(RPC_DELAY_MS);
    } catch (error) {
      console.error(`❌ Error processing blocks ${from}-${to}:`, error);
      // 继续处理下一个批次
      from = to + 1n;
    }
  }

  console.log('✅ Indexing complete');
}

/**
 * 主函数：启动索引器并定期更新
 */
async function main(): Promise<void> {
  try {
    // 先运行一次索引
    await runIndexer();

    // 然后定期更新已有 campaigns
    setInterval(async () => {
      await updateExistingCampaigns();
    }, UPDATE_INTERVAL_MS);

    console.log(`⏰ Scheduled updates every ${UPDATE_INTERVAL_MS / 1000}s`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    
    // 改进错误信息显示
    if (error instanceof Error) {
      // 检查是否是 HTTP 请求错误
      if (error.message.includes('HTTP request failed') || error.message.includes('Unexpected token')) {
        console.error('');
        console.error('🔍 错误分析：');
        console.error('   RPC 请求失败，可能是以下原因：');
        console.error('   1. RPC URL 中的 API key 无效或已过期');
        console.error('   2. RPC 服务提供商返回了认证错误');
        console.error('   3. 网络连接问题');
        console.error('');
        console.error('💡 解决方案：');
        console.error('   1. 检查 apps/indexer/.env 文件中的 RPC_HTTP 配置');
        console.error('   2. 确认 API key 是否正确且有效');
        console.error('   3. 如果是 Alchemy，请访问 https://dashboard.alchemy.com/ 获取新的 API key');
        console.error('   4. 检查网络连接是否正常');
        console.error('');
      }
      
      // 检查是否是 RPC URL 验证错误
      if (error.message.includes('RPC URL 包含占位符')) {
        // 验证错误已经在 validateRpcUrl 中显示了详细信息
      }
    }
    
    process.exit(1);
  }
}

// 启动索引器
main().catch((e) => {
  console.error('❌ Unhandled error:', e);
  process.exit(1);
});
