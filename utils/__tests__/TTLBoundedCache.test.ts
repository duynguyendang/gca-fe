import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTLBoundedCache } from '../cacheUtils';

describe('TTLBoundedCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new TTLBoundedCache<string, number>(3, 60000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('evicts expired entries on get', () => {
    const cache = new TTLBoundedCache<string, number>(3, 5000); // 5 second TTL
    cache.set('a', 1);
    vi.advanceTimersByTime(6000); // advance 6 seconds
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts oldest non-expired when max size reached', () => {
    const cache = new TTLBoundedCache<string, number>(3, 60000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    expect(cache.has('a')).toBe(false);
  });

  it('cleanup removes expired entries', () => {
    const cache = new TTLBoundedCache<string, number>(3, 5000);
    cache.set('a', 1);
    cache.set('b', 2);
    vi.advanceTimersByTime(6000);
    cache.cleanup();
    expect(cache.size).toBe(0);
  });

  it('updates existing key without eviction', () => {
    const cache = new TTLBoundedCache<string, number>(3, 60000);
    cache.set('a', 1);
    cache.set('a', 10);
    expect(cache.get('a')).toBe(10);
    expect(cache.size).toBe(1);
  });

  it('counts only non-expired entries in size', () => {
    const cache = new TTLBoundedCache<string, number>(3, 5000);
    cache.set('a', 1);
    vi.advanceTimersByTime(3000); // 3 seconds passed
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    vi.advanceTimersByTime(3000); // 6 seconds total, 'a' expired
    expect(cache.size).toBe(1);
  });
});