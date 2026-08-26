import NodeCache from "node-cache";

// One shared in-process cache for the whole app — no Redis in this stack
// (single-instance deployment), so an in-memory TTL cache is the simplest
// thing that actually helps repeated Dashboard/Analytics reads without
// introducing a new external dependency.
const cache = new NodeCache({ checkperiod: 60 });

/**
 * Check the cache for `key`; on miss, run `fn()`, store the result for
 * `ttlSeconds`, and return it. `fn` is only ever called on a miss.
 *
 * Callers MUST build `key` with `buildCacheKey` (or something equally
 * scope-aware) — a key that doesn't fold in the tenant scope and every
 * param that affects the result will serve one tenant's (or one filter
 * combination's) data to another. See buildCacheKey below.
 */
const getOrSet = async <T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = await fn();
  cache.set(key, value, ttlSeconds);
  return value;
};

/**
 * Builds a cache key that's safe to share the same NodeCache instance
 * across every tenant and every query-param combination this app serves.
 * `namespace` should be unique per calling function (e.g.
 * "hr-analytics:getOverview"); `parts` should include the tenant scope
 * filter object AND every other parameter (date range, pagination, ids)
 * that changes what the wrapped function returns — two calls that would
 * return different data must never produce the same key.
 *
 * JSON.stringify is enough here (not a cryptographic hash): the only
 * requirement is that differing inputs don't collide, not that the key be
 * short or that logically-identical inputs always serialize byte-identically.
 * A rare key mismatch on an equivalent input is just a cache miss, not a
 * correctness bug.
 */
const buildCacheKey = (namespace: string, ...parts: unknown[]): string => {
  const serialized = parts.map((part) => JSON.stringify(part ?? null)).join("|");
  return `${namespace}::${serialized}`;
};

export { cache, getOrSet, buildCacheKey };
