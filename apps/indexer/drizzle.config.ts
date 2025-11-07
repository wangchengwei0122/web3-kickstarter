import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: { url: '../../data/app.db' }, // 数据库存放在 /data/app.db
} satisfies Config;
