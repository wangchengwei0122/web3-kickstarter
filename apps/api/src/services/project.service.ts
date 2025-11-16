/**
 * 项目服务层
 * 处理项目相关的业务逻辑
 */

import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { campaigns } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/error.js';
import { isAddress } from 'viem';

export type SortOption = 'latest' | 'deadline';

export interface ProjectQuery {
  page?: number;
  limit?: number;
  sort?: SortOption;
}

export interface Project {
  id: number;
  address: string;
  creator: string;
  goal: string;
  deadline: number;
  status: number;
  totalPledged: string;
  metadataURI: string;
  createdAt: Date;
  createdBlock: number;
}

export interface ProjectDetail extends Project {
  // 可以扩展更多字段，如从 IPFS 获取的 metadata
  metadata?: unknown;
}

/**
 * 验证以太坊地址格式
 */
function validateAddress(address: string): void {
  if (!isAddress(address)) {
    throw new ValidationError(`Invalid address format: ${address}`);
  }
}

/**
 * 验证分页参数
 */
function validatePagination(page: number, limit: number): void {
  if (page < 1) {
    throw new ValidationError('Page must be greater than 0');
  }
  if (limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }
}

/**
 * 获取项目列表（分页）
 */
export async function getProjects(query: ProjectQuery = {}) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const sort = query.sort ?? 'latest';

  validatePagination(page, limit);

  const offset = (page - 1) * limit;

  // 构建排序
  let orderBy;
  if (sort === 'deadline') {
    orderBy = asc(campaigns.deadline);
  } else {
    // latest: 按创建时间倒序
    orderBy = desc(campaigns.createdAt);
  }

  // 查询项目列表
  const results = await db.select().from(campaigns).orderBy(orderBy).limit(limit).offset(offset);

  // 查询总数
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(campaigns);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    items: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 根据地址获取单个项目详情
 */
export async function getProjectByAddress(address: string): Promise<ProjectDetail> {
  validateAddress(address);

  const normalizedAddress = address.toLowerCase();

  const result = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.address, normalizedAddress))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError(`Project not found: ${address}`);
  }

  const project = result[0];

  // TODO: 从 IPFS 获取 metadata（可以后续实现缓存）
  // const metadata = await fetchMetadataFromIPFS(project.metadataURI);

  return {
    ...project,
    // metadata,
  };
}

/**
 * 根据创建者地址获取所有项目
 */
export async function getProjectsByCreator(creatorAddress: string) {
  validateAddress(creatorAddress);

  const normalizedAddress = creatorAddress.toLowerCase();

  const results = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.creator, normalizedAddress))
    .orderBy(desc(campaigns.createdAt));

  return results;
}

/**
 * 获取项目的当前状态（active/failed/succeeded）
 */
export function getProjectStatus(
  project: Project
): 'active' | 'failed' | 'succeeded' | 'cancelled' {
  // status: 0=Active, 1=Successful, 2=Failed, 3=Cancelled
  switch (project.status) {
    case 0:
      // 检查是否已过期
      const now = Math.floor(Date.now() / 1000);
      if (project.deadline < now) {
        return 'failed';
      }
      return 'active';
    case 1:
      return 'succeeded';
    case 2:
      return 'failed';
    case 3:
      return 'cancelled';
    default:
      return 'active';
  }
}
