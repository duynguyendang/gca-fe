/**
 * BoundedCache - A cache with max size and LRU eviction
 * When maxSize is reached, the oldest entry is evicted
 */
export class BoundedCache<K, V> {
    private cache: Map<K, V>;
    private readonly maxSize: number;

    constructor(maxSize: number = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used) - delete and re-insert
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        // If key exists, delete it first (will be re-inserted at end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict oldest (first) entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }

    /**
     * Get oldest entry without removing it (for debugging/inspection)
     */
    peekOldest(): { key: K; value: V } | undefined {
        const firstKey = this.cache.keys().next().value;
        if (firstKey === undefined) return undefined;
        const value = this.cache.get(firstKey);
        if (value === undefined) return undefined;
        return { key: firstKey, value };
    }

    /**
     * Get newest entry without removing it (for debugging/inspection)
     */
    peekNewest(): { key: K; value: V } | undefined {
        const lastKey = Array.from(this.cache.keys()).pop();
        if (lastKey === undefined) return undefined;
        const value = this.cache.get(lastKey);
        if (value === undefined) return undefined;
        return { key: lastKey, value };
    }
}

/**
 * TTLBoundedCache - A cache with max size, LRU eviction, AND TTL expiration
 * Entries expire after ttlMs milliseconds
 */
export class TTLBoundedCache<K, V> {
    private cache: Map<K, { value: V; expiry: number }>;
    private readonly maxSize: number;
    private readonly ttlMs: number;

    constructor(maxSize: number = 100, ttlMs: number = 10 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    private isExpired(entry: { value: V; expiry: number }): boolean {
        return Date.now() > entry.expiry;
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (entry === undefined) return undefined;

        if (this.isExpired(entry)) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used) - delete and re-insert
        this.cache.delete(key);
        const newEntry = { value: entry.value, expiry: Date.now() + this.ttlMs };
        this.cache.set(key, newEntry);
        return entry.value;
    }

    set(key: K, value: V): void {
        // If key exists, delete it first (will be re-inserted at end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict oldest non-expired entry
            for (const [k] of this.cache) {
                this.cache.delete(k);
                break;
            }
        }
        this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
    }

    has(key: K): boolean {
        const entry = this.cache.get(key);
        if (entry === undefined) return false;
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        // Count only non-expired entries
        let count = 0;
        for (const entry of this.cache.values()) {
            if (!this.isExpired(entry)) count++;
        }
        return count;
    }

    /**
     * Remove all expired entries (can be called periodically for cleanup)
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiry) {
                this.cache.delete(key);
            }
        }
    }
}
