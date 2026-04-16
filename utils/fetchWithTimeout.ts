import { API_CONFIG } from '../src/constants';

/**
 * Fetch wrapper with timeout support using AbortController.
 * Defaults to API_CONFIG.TIMEOUT.DEFAULT (30s).
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @param externalSignal - Optional external AbortSignal for request cancellation
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_CONFIG.TIMEOUT.DEFAULT,
  externalSignal?: AbortSignal | null
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Combine external signal with internal controller signal
    const signal = options.signal || externalSignal
      ? combineSignals(externalSignal, controller.signal)
      : controller.signal;

    const response = await fetch(url, {
      ...options,
      signal,
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

/**
 * Combines multiple AbortSignals into one.
 * When any source is aborted, the combined signal is aborted.
 */
function combineSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return controller.signal;
}
