type CacheEntry<T> = {
  value: T;
  updatedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getScreenCache<T>(key: string): T | null {
  return (cache.get(key)?.value as T | undefined) ?? null;
}

export function setScreenCache<T>(key: string, value: T) {
  cache.set(key, {
    value,
    updatedAt: Date.now(),
  });
}

export function getScreenCacheAge(key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - entry.updatedAt;
}

export function patchScreenCache<T extends object>(
  key: string,
  patch: Partial<T>
) {
  const previous = getScreenCache<T>(key);

  setScreenCache<T>(key, {
    ...(previous ?? ({} as T)),
    ...patch,
  } as T);
}
