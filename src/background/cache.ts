import { LRU_CACHE_SIZE } from "@/shared/constants";
import type { DictEntry } from "@/shared/types";

const cache = new Map<string, DictEntry[]>();
const order: string[] = [];

export function cacheLookup(key: string): DictEntry[] | null {
  const result = cache.get(key);
  if (!result) return null;

  // LRU: 최근 사용으로 이동
  const idx = order.indexOf(key);
  if (idx > -1) {
    order.splice(idx, 1);
    order.push(key);
  }

  return result;
}

export function cacheStore(key: string, value: DictEntry[]): void {
  if (cache.has(key)) {
    const idx = order.indexOf(key);
    if (idx > -1) order.splice(idx, 1);
  } else if (cache.size >= LRU_CACHE_SIZE) {
    const oldest = order.shift();
    if (oldest) cache.delete(oldest);
  }

  cache.set(key, value);
  order.push(key);
}
