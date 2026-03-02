import { isRetryableHttpStatus, withRetry } from "./retry.js";

export async function fetchJsonWithRetry<T>(url: string, init?: RequestInit): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(url, init);
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return (await res.json()) as T;
    },
    2,
    500,
    (err) => {
      const status = (err as { status?: number })?.status;
      return status ? isRetryableHttpStatus(status) : true;
    }
  );
}
