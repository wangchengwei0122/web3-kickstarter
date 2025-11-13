/**
 * 统计服务层
 * 处理全局统计数据
 */

import { db } from '../db/client.js';
import { campaigns } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export interface GlobalStats {
  totalProjects: number;
  totalPledged: string; // 总 pledge 金额（字符串，避免精度丢失）
  activeProjects: number;
  failedProjects: number;
  succeededProjects: number;
}

/**
 * 获取全局统计信息
 */
export async function getStats(): Promise<GlobalStats> {
  // 总项目数
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns);

  const totalProjects = Number(totalResult[0]?.count ?? 0);

  // 总 pledge 金额（使用 SQL SUM）
  // 注意：totalPledged 在 schema 中是 text 类型，需要转换为 numeric 再求和
  const totalPledgedResult = await db
    .select({
      sum: sql<string>`coalesce(sum(cast(${campaigns.totalPledged} as numeric)), '0')`,
    })
    .from(campaigns);

  const totalPledged = totalPledgedResult[0]?.sum ?? '0';

  // 按状态统计
  const activeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(eq(campaigns.status, 0));

  const activeProjects = Number(activeResult[0]?.count ?? 0);

  const failedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(eq(campaigns.status, 2));

  const failedProjects = Number(failedResult[0]?.count ?? 0);

  const succeededResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(eq(campaigns.status, 1));

  const succeededProjects = Number(succeededResult[0]?.count ?? 0);

  return {
    totalProjects,
    totalPledged,
    activeProjects,
    failedProjects,
    succeededProjects,
  };
}

