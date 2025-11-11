import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

/**
 * 创建数据库连接池
 * 支持 Supabase PostgreSQL（需要 SSL）
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'
      ? {
          rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
        }
      : false,
});

export const db = drizzle(pool, { schema });
