/**
 * 工具函数模块
 * 包含重试机制、延迟控制等辅助功能
 */

/**
 * 延迟指定毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试机制的异步函数执行器
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数
 * @param retryDelayMs 重试延迟（毫秒）
 * @param onRetry 重试时的回调函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
  onRetry?: (error: Error, attempt: number) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(lastError, attempt + 1);
        }
        await delay(retryDelayMs * (attempt + 1)); // 指数退避
      }
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * 格式化大数字为字符串（用于存储到数据库）
 */
export function formatBigInt(value: bigint): string {
  return value.toString();
}

/**
 * 格式化地址为小写
 */
export function formatAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * 格式化区块号
 */
export function formatBlockNumber(block: bigint | number): number {
  return typeof block === 'bigint' ? Number(block) : block;
}

