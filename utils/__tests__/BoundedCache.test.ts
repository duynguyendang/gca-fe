import { describe, it, expect } from 'vitest';
import { BoundedCache } from '../cacheUtils';

describe('BoundedCache', () => {
  it('stores and retrieves values', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('evicts oldest when max size reached', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
  });

  it('LRU: most recently used survives', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // access 'a' to make it most recent
    cache.set('d', 4); // should evict 'b'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});