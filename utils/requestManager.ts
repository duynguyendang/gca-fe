/**
 * Request Manager - Tracks in-flight requests for cancellation
 * Prevents race conditions when user rapidly triggers new requests
 */

type RequestId = string;

class RequestManager {
  private pending = new Map<RequestId, AbortController>();

  /**
   * Start tracking a new request
   */
  startRequest(id: string): AbortController {
    this.cancelRequest(id); // Cancel any existing request with same ID
    const controller = new AbortController();
    this.pending.set(id, controller);
    return controller;
  }

  /**
   * Cancel a specific request by ID
   */
  cancelRequest(id: string): void {
    const controller = this.pending.get(id);
    if (controller) {
      controller.abort();
      this.pending.delete(id);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    this.pending.forEach(controller => controller.abort());
    this.pending.clear();
  }

  /**
   * Check if a request is still pending
   */
  isPending(id: string): boolean {
    return this.pending.has(id);
  }

  /**
   * Get count of pending requests
   */
  getPendingCount(): number {
    return this.pending.size;
  }
}

export const requestManager = new RequestManager();
