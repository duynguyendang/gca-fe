import { API_CONFIG } from '../src/constants';

/**
 * Fetch wrapper with timeout support using AbortController.
 * Defaults to API_CONFIG.TIMEOUT.DEFAULT (30s).
 * Automatically adds Accept-Encoding: gzip header for response compression.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_CONFIG.TIMEOUT.DEFAULT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Add compression support by default
    const headers = {
      ...options.headers,
      'Accept-Encoding': 'gzip, deflate'
    };

    const response = await fetch(url, {
      ...options,
      headers,
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
