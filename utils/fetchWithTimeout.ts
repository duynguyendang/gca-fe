import { API_CONFIG } from '../src/constants';

/**
 * Fetch wrapper with timeout support using AbortController.
 * Defaults to API_CONFIG.TIMEOUT.DEFAULT (30s).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_CONFIG.TIMEOUT.DEFAULT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
