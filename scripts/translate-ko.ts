/**
 * 영어 뜻 → 한국어 번역 스크립트
 *
 * claude CLI를 사용해서 배치 번역합니다.
 * 결과는 .cache/korean-glosses.json에 캐싱됩니다.
 *
 * 사용법: npx tsx scripts/translate-ko.ts
 */

import { readFile, writeFile, stat, writeFile as writeFileAsync } from "fs/promises";
import { writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const PUBLIC_DATA_DIR = join(import.meta.dirname, "..", "public", "data");
const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const DICT_FILE = join(PUBLIC_DATA_DIR, "jmdict-n2.json");
const KO_CACHE = join(CACHE_DIR, "korean-glosses.json");
const OUTPUT_FILE = DICT_FILE;

interface DictEntry {
  id: string;
  expression: string;
  reading: string;
  meanings: string[];
  meaningsEn: string[];
  jlpt: number;
  pos: string[];
}

async function loadExistingTranslations(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    await stat(KO_CACHE);
    const raw = await readFile(KO_CACHE, "utf-8");
    const data = JSON.parse(raw) as Record<string, string[]>;
    for (const [id, meanings] of Object.entries(data)) {
      map.set(id, meanings);
    }
    console.log(`Loaded ${map.size} cached translations`);
  } catch {
    console.log("No cached translations found");
  }
  return map;
}

async function saveTranslations(map: Map<string, string[]>): Promise<void> {
  const obj: Record<string, string[]> = {};
  for (const [id, meanings] of map) {
    obj[id] = meanings;
  }
  await writeFile(KO_CACHE, JSON.stringify(obj));
  console.log(`Saved ${map.size} translations to cache`);
}

function translateBatch(
  entries: Array<{ id: string; expression: string; reading: string }>
): Map<string, string[]> {
  const results = new Map<string, string[]>();

  const lines = entries.map((e) => `${e.id}\t${e.expression}\t${e.reading}`);
  const prompt = `일본어 단어를 한국어로 번역해주세요. 각 줄: ID\\t일본어\\t읽기
규칙:
- 각 단어에 가장 적합한 한국어 대응어를 1~2개만 반환
- 한자어는 한국 한자음으로 (例: 理解 → 이해, 経験 → 경험, 輸出 → 수출)
- カタカナ 외래어는 한국어 외래어 표기로 (例: データ → 데이터, テレビ → 텔레비전)
- 和語는 뜻을 번역 (例: 食べる → 먹다, 心得 → 마음가짐)
- "understanding" 같은 영어 중간 번역 하지 말 것
반환 형식만: ID\\t한국어 (;로 구분)

${lines.join("\n")}`;

  try {
    // 프롬프트를 임시 파일로 저장 (echo로 넘기면 길이 제한)
    const tmpFile = join(CACHE_DIR, "_prompt.txt");
    writeFileSync(tmpFile, prompt);

    const result = execSync(
      `cat "${tmpFile}" | claude -p --model haiku --no-session-persistence`,
      {
        encoding: "utf-8",
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    for (const line of result.split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const id = parts[0].trim();
        const ko = parts[1]
          .trim()
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        if (id && ko.length > 0 && /^\d+$/.test(id)) {
          results.set(id, ko);
        }
      }
    }
  } catch (err) {
    console.error("Translation batch failed:", (err as Error).message?.slice(0, 200));
  }

  return results;
}

async function main(): Promise<void> {
  // 1. 사전 로드
  const raw = await readFile(DICT_FILE, "utf-8");
  const entries: DictEntry[] = JSON.parse(raw);
  console.log(`Dictionary entries: ${entries.length}`);

  // 2. 기존 번역 캐시 로드
  const koMap = await loadExistingTranslations();

  // 3. 캐시에 없는 것만 번역
  const untranslated = entries
    .filter((e) => !koMap.has(e.id))
    .map((e) => ({
      id: e.id,
      expression: e.expression,
      reading: e.reading,
    }));

  console.log(`Untranslated: ${untranslated.length}`);

  if (untranslated.length === 0) {
    console.log("All entries already translated!");
  } else {
    // 4. 배치 번역
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(untranslated.length / BATCH_SIZE);

    for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = untranslated.slice(i, i + BATCH_SIZE);
      console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} entries)...`);

      const results = translateBatch(batch);
      console.log(`  → Got ${results.size} translations`);

      for (const [id, ko] of results) {
        koMap.set(id, ko);
      }

      // 매 5배치마다 중간 저장
      if (batchNum % 5 === 0 || i + BATCH_SIZE >= untranslated.length) {
        await saveTranslations(koMap);
      }
    }
  }

  // 5. 사전에 한국어 뜻 적용
  let applied = 0;
  for (const entry of entries) {
    const ko = koMap.get(entry.id);
    if (ko && ko.length > 0) {
      entry.meanings = ko;
      applied++;
    }
  }

  console.log(`\nApplied Korean translations: ${applied} / ${entries.length}`);

  // 6. 저장
  await writeFile(OUTPUT_FILE, JSON.stringify(entries));
  const fileSize = (await stat(OUTPUT_FILE)).size;
  console.log(`Output: ${OUTPUT_FILE} (${(fileSize / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
