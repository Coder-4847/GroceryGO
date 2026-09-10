import { createLogger } from './logger.js';

const log = createLogger('cache');

/**
 * Dead-simple in-process TTL cache. Fine for a single free-tier instance;
 * swap for Redis if the backend is ever horizontally scaled.
 */
class TtlCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
    // Sweep expired entries every 5 min so the map does not grow unbounded.
    this.sweepTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.sweepTimer.unref?.();
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) {
        this.store.delete(k);
        removed++;
      }
    }
    if (removed) log.debug(`swept ${removed} expired entries`);
  }

  get size() {
    return this.store.size;
  }
}

export const cache = new TtlCache();
