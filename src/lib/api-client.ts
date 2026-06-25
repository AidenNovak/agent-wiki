/**
 * Thin fetch wrapper with:
 *  - configurable timeout (default 30 s)
 *  - automatic retry on network failure / 5xx (default 2 retries)
 *  - consistent error shape { error: string }
 */

export interface ApiError {
  error: string;
  status?: number;
}

export function isApiError(v: unknown): v is ApiError {
  return typeof v === "object" && v !== null && "error" in v;
}

interface FetchOptions extends RequestInit {
  /** Timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Max retry attempts on network error / 5xx. Default: 1 */
  retries?: number;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30_000, retries = 1, ...fetchOpts } = options;
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(url, { ...fetchOpts, signal: ctrl.signal });
      clearTimeout(timer);

      // Parse body
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res as unknown as T;
      }

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error ?? `HTTP ${res.status}`;
        // Retry on 5xx
        if (res.status >= 500 && attempt < retries) {
          lastError = new Error(msg);
          await sleep(500 * (attempt + 1));
          continue;
        }
        throw Object.assign(new Error(msg), { status: res.status, body: json });
      }

      return json as T;
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        lastError = new Error(`Request timed out after ${timeout / 1000}s`);
      } else {
        lastError = err as Error;
      }
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError;
}

/** POST helper with JSON body */
export function apiPost<T = unknown>(url: string, body: unknown, opts?: FetchOptions) {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
}
