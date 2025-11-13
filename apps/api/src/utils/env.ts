/**
 * 环境变量工具
 * 提供类型安全的环境变量读取
 */

function must(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string = ''): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // 数据库连接
  DATABASE_URL: must('DATABASE_URL'),

  // 服务器配置
  PORT: Number(optional('PORT', '3001')),
  NODE_ENV: optional('NODE_ENV', 'development'),

  // CORS 配置
  CORS_ORIGIN: optional('CORS_ORIGIN', '*'),
} as const;

