export async function withRetry<T>(
  task: () => Promise<T>,
  retries: number,
  baseDelayMs: number,
  shouldRetry?: (err: unknown) => boolean
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      if (shouldRetry && !shouldRetry(err)) break;
      const wait = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
      attempt += 1;
    }
  }
  throw lastError;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || status === 429;
}
