/**
 * JMdict → 사전 JSON 변환 스크립트
 *
 * 1. jmdict-eng-common (영어 common 단어) 다운로드
 * 2. jmdict-all (전체 언어) 다운로드 → 한국어 gloss 추출
 * 3. 두 소스를 합쳐서 한국어 우선, 영어 fallback 사전 생성
 *
 * 사용법: npx tsx scripts/build-dict.ts
 */

import { createReadStream, readdirSync } from "fs";
import { writeFile, mkdir, stat, readFile } from "fs/promises";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { execSync } from "child_process";

const GITHUB_API =
  "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";

// 전 레벨 JLPT vocab CSV
const JLPT_CSV_URLS: Record<number, string> = {
  1: "https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n1.csv",
  2: "https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n2.csv",
  3: "https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n3.csv",
  4: "https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n4.csv",
  5: "https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n5.csv",
};

const PUBLIC_DATA_DIR = join(import.meta.dirname, "..", "public", "data");
const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const CACHED_ENG = join(CACHE_DIR, "jmdict-eng-common.json");
const CACHED_ALL = join(CACHE_DIR, "jmdict-all.json");
const OUTPUT_FILE = join(PUBLIC_DATA_DIR, "jmdict-n2.json");

// --- Types ---

interface JmdictGloss {
  lang: string;
  text: string;
}

interface JmdictSense {
  partOfSpeech: string[];
  gloss: JmdictGloss[];
}

interface JmdictWord {
  id: string;
  kanji: Array<{ text: string; common: boolean }>;
  kana: Array<{ text: string; common: boolean; appliesToKanji: string[] }>;
  sense: JmdictSense[];
}

interface JmdictFile {
  words: JmdictWord[];
}

interface OutputEntry {
  id: string;
  expression: string;
  reading: string;
  meanings: string[];   // 한국어 (있으면)
  meaningsEn: string[]; // 영어 (항상)
  jlpt: number;
  pos: string[];
}

// --- JLPT 전 레벨 ID 로드 ---

async function loadJlptIds(): Promise<Map<string, number>> {
  const idToLevel = new Map<string, number>();

  for (const [level, url] of Object.entries(JLPT_CSV_URLS)) {
    const lvl = Number(level);
    console.log(`Downloading JLPT N${lvl} vocab list...`);
    const response = await fetch(url);
    const csv = await response.text();
    let count = 0;

    for (const line of csv.split("\n").slice(1)) {
      const seq = line.split(",")[0]?.trim();
      if (seq && /^\d+$/.test(seq) && !idToLevel.has(seq)) {
        idToLevel.set(seq, lvl);
        count++;
      }
    }
    console.log(`  N${lvl}: ${count} IDs`);
  }

  console.log(`Total JLPT IDs: ${idToLevel.size}`);
  return idToLevel;
}

// --- 다운로드 ---

async function downloadAsset(
  keyword: string,
  cachedPath: string
): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });

  try {
    await stat(cachedPath);
    console.log(`Using cached: ${cachedPath}`);
    return cachedPath;
  } catch {
    // 캐시 없음
  }

  console.log(`Finding latest release for "${keyword}"...`);
  const apiRes = await fetch(GITHUB_API, {
    headers: { "User-Agent": "jlpt-n2-extension" },
  });
  const release = (await apiRes.json()) as {
    assets: Array<{ name: string; browser_download_url: string }>;
  };

  const asset = release.assets.find(
    (a) => a.name.includes(keyword) && a.name.endsWith(".json.tgz")
  );
  if (!asset) {
    throw new Error(`Asset "${keyword}" not found in release`);
  }

  const tgzPath = join(CACHE_DIR, asset.name);
  console.log(`Downloading ${asset.name}...`);
  const response = await fetch(asset.browser_download_url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  await writeFile(tgzPath, Buffer.from(await response.arrayBuffer()));

  console.log("Extracting...");
  execSync(`tar xzf "${tgzPath}" -C "${CACHE_DIR}"`);

  // 추출된 JSON 찾기
  const prefix = keyword.split("-").slice(0, 2).join("-"); // jmdict-eng or jmdict-all
  const files = readdirSync(CACHE_DIR).filter(
    (f) => f.endsWith(".json") && f.includes(keyword.replace("-common", ""))
  );

  if (!files.length) {
    // fallback: 가장 최근 json 파일
    const allJson = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
    console.log("Available JSON files:", allJson);
    throw new Error(`Extracted JSON for "${keyword}" not found`);
  }

  const content = await readFile(join(CACHE_DIR, files[0]));
  await writeFile(cachedPath, content);
  console.log(`Saved to ${cachedPath}`);
  return cachedPath;
}

// --- 한국어 gloss 추출 ---

async function extractKoreanGlosses(
  allPath: string
): Promise<Map<string, string[]>> {
  console.log("Extracting Korean glosses from all-languages file...");
  const raw = await readFile(allPath, "utf-8");
  const data: JmdictFile = JSON.parse(raw);

  const korMap = new Map<string, string[]>();
  let korCount = 0;

  for (const word of data.words) {
    const korMeanings: string[] = [];
    for (const sense of word.sense) {
      for (const gloss of sense.gloss) {
        if (gloss.lang === "kor" && korMeanings.length < 3) {
          korMeanings.push(gloss.text);
        }
      }
    }
    if (korMeanings.length > 0) {
      korMap.set(word.id, korMeanings);
      korCount++;
    }
  }

  console.log(`Korean glosses found: ${korCount} / ${data.words.length} words`);
  return korMap;
}

// --- 메인 ---

async function main(): Promise<void> {
  // 1. 동시에 다운로드
  const [engPath, jlptIds] = await Promise.all([
    downloadAsset("jmdict-eng-common", CACHED_ENG),
    loadJlptIds(),
  ]);

  // 2. 영어 common 사전 파싱
  console.log("Parsing English common dictionary...");
  const engRaw = await readFile(engPath, "utf-8");
  const engData: JmdictFile = JSON.parse(engRaw);

  console.log(`Total common words: ${engData.words.length}`);

  // 3. 기존 한국어 번역 캐시 로드 (translate-ko.ts에서 생성)
  let koCache: Record<string, string[]> = {};
  try {
    const koCacheFile = join(CACHE_DIR, "korean-glosses.json");
    await stat(koCacheFile);
    koCache = JSON.parse(await readFile(koCacheFile, "utf-8"));
    console.log(`Korean translation cache: ${Object.keys(koCache).length} entries`);
  } catch {
    console.log("No Korean translation cache found");
  }

  // 4. 합치기
  const entries: OutputEntry[] = [];
  const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let korHits = 0;

  for (const word of engData.words) {
    const jlpt = jlptIds.get(word.id) || 0;
    if (jlpt > 0) levelCounts[jlpt]++;

    const expression =
      word.kanji.length > 0 ? word.kanji[0].text : word.kana[0].text;
    const reading = word.kana[0].text;

    // 영어 뜻
    const meaningsEn: string[] = [];
    const pos = new Set<string>();
    for (const sense of word.sense) {
      for (const gloss of sense.gloss) {
        if (meaningsEn.length < 3) meaningsEn.push(gloss.text);
      }
      for (const p of sense.partOfSpeech) pos.add(p);
    }

    // 한국어 뜻 (캐시에서)
    const korMeanings = koCache[word.id];
    if (korMeanings) korHits++;

    entries.push({
      id: word.id,
      expression,
      reading,
      meanings: korMeanings || meaningsEn,
      meaningsEn,
      jlpt,
      pos: [...pos].slice(0, 3),
    });
  }

  console.log(`\nTotal entries: ${entries.length}`);
  for (const [lvl, count] of Object.entries(levelCounts)) {
    console.log(`  N${lvl}: ${count}`);
  }
  console.log(`  태그 없음: ${entries.length - Object.values(levelCounts).reduce((a, b) => a + b, 0)}`);
  console.log(`Korean meanings: ${korHits} (${((korHits / entries.length) * 100).toFixed(1)}%)`);

  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(entries));

  const fileSize = (await stat(OUTPUT_FILE)).size;
  console.log(`\nOutput: ${OUTPUT_FILE}`);
  console.log(`File size: ${(fileSize / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
