import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite', // ✅ 新版本必须写 dialect
  dbCredentials: {
    url: '../../data/app.db', // 相对路径到你的数据库文件
  },
} satisfies Config;
