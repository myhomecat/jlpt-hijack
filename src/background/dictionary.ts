import { DB_NAME, DB_VERSION, STORE_TERMS } from "@/shared/constants";
import type { DictEntry } from "@/shared/types";
import { cacheLookup, cacheStore } from "./cache";

const STORE_KO_INDEX = "koreanIndex";

let db: IDBDatabase | null = null;
let dbReady: Promise<void> | null = null;

// 한국어 → 일본어 인메모리 맵 (N2 단어만)
let koToEntryMap: Map<string, DictEntry[]> | null = null;

export function initDatabase(): Promise<void> {
  if (dbReady) return dbReady;

  dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // 기존 store 삭제 후 재생성
      if (database.objectStoreNames.contains(STORE_TERMS)) {
        database.deleteObjectStore(STORE_TERMS);
      }
      if (database.objectStoreNames.contains(STORE_KO_INDEX)) {
        database.deleteObjectStore(STORE_KO_INDEX);
      }

      const store = database.createObjectStore(STORE_TERMS, { keyPath: "id" });
      store.createIndex("expression", "expression", { unique: false });
      store.createIndex("reading", "reading", { unique: false });
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      console.log("[JLPT N2] Database opened");
      loadDictionaryIfNeeded().then(resolve).catch(reject);
    };

    request.onerror = () => reject(request.error);
  });

  return dbReady;
}

async function loadDictionaryIfNeeded(): Promise<void> {
  if (!db) return;

  const tx = db.transaction(STORE_TERMS, "readonly");
  const store = tx.objectStore(STORE_TERMS);
  const count = await idbRequest<number>(store.count());

  if (count > 0) {
    console.log(`[JLPT N2] Dictionary already loaded (${count} entries)`);
    await buildKoreanIndex();
    return;
  }

  console.log("[JLPT N2] Loading dictionary...");
  const startTime = performance.now();

  const response = await fetch(chrome.runtime.getURL("data/jmdict-n2.json"));
  const entries: DictEntry[] = await response.json();

  console.log(`[JLPT N2] Parsed ${entries.length} entries, writing to IndexedDB...`);

  const writeTx = db.transaction(STORE_TERMS, "readwrite");
  const writeStore = writeTx.objectStore(STORE_TERMS);

  for (const entry of entries) {
    writeStore.put(entry);
  }

  return new Promise((resolve, reject) => {
    writeTx.oncomplete = () => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`[JLPT N2] Dictionary loaded (${entries.length} entries) in ${elapsed}s`);
      buildKoreanIndex().then(resolve);
    };
    writeTx.onerror = () => reject(writeTx.error);
  });
}

/**
 * 한국어 → 일본어 역방향 인덱스 구축 (JLPT 태그된 전체)
 * IndexedDB에서 엔트리를 읽어서 인메모리 맵 생성
 */
async function buildKoreanIndex(): Promise<void> {
  if (koToEntryMap) return;
  if (!db) return;

  const startTime = performance.now();
  koToEntryMap = new Map();

  const tx = db.transaction(STORE_TERMS, "readonly");
  const store = tx.objectStore(STORE_TERMS);
  const entries = await idbRequest<DictEntry[]>(store.getAll());

  let taggedCount = 0;
  let indexedTerms = 0;

  for (const entry of entries) {
    if (entry.jlpt === 0) continue; // JLPT 태그된 것만
    taggedCount++;

    for (const meaning of entry.meanings) {
      const keys = normalizeKoreanMeaning(meaning);
      for (const key of keys) {
        if (key.length < 2) continue;
        const existing = koToEntryMap.get(key);
        if (existing) {
          if (!existing.find((e) => e.id === entry.id)) {
            existing.push(entry);
          }
        } else {
          koToEntryMap.set(key, [entry]);
        }
        indexedTerms++;
      }
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[JLPT] Korean index built: ${taggedCount} entries → ${koToEntryMap.size} unique terms (${indexedTerms} mappings) in ${elapsed}s`
  );
}

/**
 * 한국어 뜻 문자열을 인덱스 키로 정규화
 * "명백한" → ["명백한", "명백"]
 * "수출하다" → ["수출하다", "수출"]
 * "아주 많다" → ["아주", "많다"]  (공백 분리)
 */
function normalizeKoreanMeaning(meaning: string): string[] {
  const keys: string[] = [];

  // 원본 추가 (소문자, 공백 trim)
  const trimmed = meaning.trim();
  if (trimmed.length >= 2) {
    keys.push(trimmed);
  }

  // 접미사 제거
  const suffixes = [
    "하다", "되다", "시키다", "스럽다",
    "한", "된", "할", "함", "해",
    "적인", "적", "인", "의",
  ];
  for (const suffix of suffixes) {
    if (trimmed.endsWith(suffix) && trimmed.length > suffix.length + 1) {
      const stem = trimmed.slice(0, -suffix.length);
      if (stem.length >= 2) keys.push(stem);
    }
  }

  return keys;
}

/**
 * 한국어 단어로 N2 일본어 단어 검색 (역방향)
 */
export async function lookupKorean(word: string): Promise<DictEntry[]> {
  await initDatabase();
  if (!koToEntryMap) return [];

  // 캐시 확인
  const cached = cacheLookup(word);
  if (cached) return cached;

  const results = koToEntryMap.get(word) || [];

  if (results.length > 0) {
    cacheStore(word, results);
  }

  return results;
}

/**
 * 한국어 단어 배열을 한번에 검색 (페이지 스캔용)
 * levels: 필터할 JLPT 레벨 배열 (예: [2, 3])
 */
export async function lookupKoreanBatch(
  words: string[],
  levels: number[]
): Promise<Map<string, DictEntry[]>> {
  await initDatabase();
  if (!koToEntryMap) return new Map();

  const levelSet = new Set(levels);
  const results = new Map<string, DictEntry[]>();

  for (const word of words) {
    const entries = koToEntryMap.get(word);
    if (entries && entries.length > 0) {
      const filtered = entries.filter((e) => levelSet.has(e.jlpt));
      if (filtered.length > 0) {
        results.set(word, filtered);
      }
    }
  }

  return results;
}

/**
 * 인덱스된 한국어 단어 수 반환 (디버깅용)
 */
export function getKoreanIndexSize(): number {
  return koToEntryMap?.size ?? 0;
}

function idbRequest<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}
