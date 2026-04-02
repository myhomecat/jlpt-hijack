/**
 * 오역 수정 스크립트
 * errors.json의 오역 후보만 Sonnet으로 재번역
 */

import { readFile, writeFile, stat } from "fs/promises";
import { writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const DICT_FILE = join(import.meta.dirname, "..", "public", "data", "jmdict-n2.json");
const ERRORS_FILE = join(CACHE_DIR, "errors.json");
const KO_CACHE = join(CACHE_DIR, "korean-glosses.json");

interface DictEntry {
  id: string;
  expression: string;
  reading: string;
  meanings: string[];
  meaningsEn: string[];
  jlpt: number;
  pos: string[];
}

async function main(): Promise<void> {
  const errors = JSON.parse(await readFile(ERRORS_FILE, "utf-8"));
  const dict: DictEntry[] = JSON.parse(await readFile(DICT_FILE, "utf-8"));
  const cache: Record<string, string[]> = JSON.parse(await readFile(KO_CACHE, "utf-8"));

  // 오역 후보 ID 추출 (중복 제거)
  const errorIds = new Set<string>(
    errors.filter((e: any) => e.reason.includes("매칭")).map((e: any) => e.id)
  );

  const toFix = dict.filter((e) => errorIds.has(e.id));
  console.log(`재번역 대상: ${toFix.length}개`);

  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(toFix.length / BATCH_SIZE);
  let fixed = 0;

  for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = toFix.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} entries)...`);

    const lines = batch.map((e) => `${e.id}\t${e.expression}\t${e.reading}`);
    const prompt = `일본어 단어를 한국어로 번역해주세요. 각 줄: ID\\t일본어\\t읽기
규칙:
- 각 단어에 가장 적합한 한국어 대응어를 정확히 1개만 반환
- 한자어는 한국 한자음으로 (例: 理解 → 이해, 経験 → 경험)
- カタカナ 외래어는 한국어 외래어 표기로 (例: データ → 데이터)
- 和語는 가장 자연스러운 한국어 뜻 1개 (例: 食べる → 먹다, 心得 → 마음가짐)
- 여러 뜻이 있어도 가장 대표적인 1개만
- 다른 단어와 겹치지 않는 고유한 뜻을 선택
반환 형식만: ID\\t한국어

${lines.join("\n")}`;

    const tmpFile = join(CACHE_DIR, "_fix_prompt.txt");
    writeFileSync(tmpFile, prompt);

    try {
      const result = execSync(
        `cat "${tmpFile}" | claude -p --model sonnet --no-session-persistence`,
        { encoding: "utf-8", timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
      );

      for (const line of result.split("\n")) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const id = parts[0].trim();
          const ko = parts[1].trim();
          if (id && ko && /^\d+$/.test(id)) {
            cache[id] = [ko];
            fixed++;
          }
        }
      }
      console.log(`  → Fixed ${fixed} so far`);
    } catch (err) {
      console.error("Batch failed:", (err as Error).message?.slice(0, 100));
    }
  }

  // 캐시 저장
  await writeFile(KO_CACHE, JSON.stringify(cache));
  console.log(`\n캐시 저장 완료. 총 ${fixed}개 수정.`);

  // 사전에 적용
  let applied = 0;
  for (const entry of dict) {
    const ko = cache[entry.id];
    if (ko && ko.length > 0) {
      entry.meanings = ko;
      applied++;
    }
  }

  await writeFile(DICT_FILE, JSON.stringify(dict));
  console.log(`사전 적용: ${applied} / ${dict.length}`);
}

main().catch(console.error);
