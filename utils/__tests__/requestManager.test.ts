import { describe, it, expect, beforeEach } from 'vitest';
import { requestManager } from '../requestManager';

describe('requestManager', () => {
  beforeEach(() => {
    requestManager.cancelAll();
  });

  it('starts and tracks requests', () => {
    const controller = requestManager.startRequest('req1');
    expect(requestManager.isPending('req1')).toBe(true);
    expect(requestManager.getPendingCount()).toBe(1);
  });

  it('cancels specific requests', () => {
    requestManager.startRequest('req1');
    requestManager.startRequest('req2');
    requestManager.cancelRequest('req1');
    expect(requestManager.isPending('req1')).toBe(false);
    expect(requestManager.isPending('req2')).toBe(true);
  });

  it('cancels all requests', () => {
    requestManager.startRequest('req1');
    requestManager.startRequest('req2');
    requestManager.cancelAll();
    expect(requestManager.getPendingCount()).toBe(0);
  });

  it('replaces existing request with same ID', () => {
    requestManager.startRequest('req1');
    const controller2 = requestManager.startRequest('req1');
    expect(requestManager.isPending('req1')).toBe(true);
    expect(requestManager.getPendingCount()).toBe(1);
  });

  it('returns AbortController that can be aborted', () => {
    const controller = requestManager.startRequest('req1');
    let aborted = false;
    controller.signal.addEventListener('abort', () => { aborted = true; });
    requestManager.cancelRequest('req1');
    expect(aborted).toBe(true);
  });
});