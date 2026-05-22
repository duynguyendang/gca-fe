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
    cache.set('d', 4); // evicts 'a'
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('updates existing key without eviction', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10); // update, not new
    expect(cache.get('a')).toBe(10);
    expect(cache.size).toBe(2);
  });

  it('returns undefined for missing key', () => {
    const cache = new BoundedCache<string, number>();
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('deletes entries correctly', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.delete('a')).toBe(false);
  });

  it('clears all entries', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('moves accessed entries to most recent', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // access 'a'
    cache.set('d', 4); // should evict 'b' (least recently used)
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});