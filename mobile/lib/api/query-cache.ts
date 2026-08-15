type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function cachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  options: { ttlMs?: number; force?: boolean } = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 30_000;
  const current = cache.get(key) as CacheEntry<T> | undefined;

  if (!options.force && current?.value !== undefined && current.expiresAt > Date.now()) {
    return Promise.resolve(current.value);
  }
  if (current?.promise) return current.promise;

  const promise = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      if (current?.value !== undefined) cache.set(key, current);
      else cache.delete(key);
      throw error;
    });

  cache.set(key, { value: current?.value, expiresAt: current?.expiresAt ?? 0, promise });
  return promise;
}

export function setCachedQuery<T>(key: string, value: T, ttlMs = 30_000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateCachedQuery(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function prefetchQuery<T>(request: Promise<T>) {
  void request.catch(() => undefined);
}
