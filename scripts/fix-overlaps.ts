/**
 * 겹치는 한국어 뜻 수정 스크립트
 * 같은 한국어에 매칭되는 단어들을 한 배치로 보내서
 * 각각 고유한 한국어 뜻을 받음
 */

import { readFile, writeFile } from "fs/promises";
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

  // 겹치는 한국어별로 그룹핑
  const koGroups = new Map<string, DictEntry[]>();
  for (const err of errors) {
    if (!err.reason.includes("매칭")) continue;
    const ko = err.reason.match(/"(.+?)"에/)?.[1];
    if (!ko) continue;
    if (!koGroups.has(ko)) koGroups.set(ko, []);
    const entry = dict.find((e) => e.id === err.id);
    if (entry && !koGroups.get(ko)!.find((e) => e.id === entry.id)) {
      koGroups.get(ko)!.push(entry);
    }
  }

  console.log(`겹치는 한국어: ${koGroups.size}개 그룹`);

  // 그룹들을 하나의 프롬프트로 만듦
  const lines: string[] = [];
  lines.push("아래 일본어 단어들이 같은 한국어로 번역되어 문제입니다.");
  lines.push("각 그룹의 단어들이 서로 다른 고유한 한국어 뜻을 갖도록 다시 번역해주세요.");
  lines.push("");
  lines.push("규칙:");
  lines.push("- 같은 그룹 안에서 한국어 뜻이 절대 겹치면 안 됨");
  lines.push("- 각 단어에 가장 정확한 한국어 대응어 1개만");
  lines.push("- 한국어에서 실제로 쓰는 자연스러운 단어로");
  lines.push("- 한자어가 있으면 한자어 우선 (例: 納得→납득, 把握→파악)");
  lines.push("");
  lines.push("반환 형식만: ID\\t한국어");
  lines.push("");

  for (const [ko, entries] of koGroups) {
    lines.push(`--- 현재 모두 "${ko}"로 번역된 단어들 ---`);
    for (const e of entries) {
      lines.push(`${e.id}\t${e.expression}\t${e.reading}\t영어: ${e.meaningsEn.join("; ")}`);
    }
    lines.push("");
  }

  const prompt = lines.join("\n");
  console.log(`프롬프트 길이: ${prompt.length}자`);

  // 너무 길면 배치로 나눔
  const MAX_PROMPT = 5000;
  const batches: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  const header = lines.slice(0, 11).join("\n");

  let groupLines: string[][] = [];
  let tempGroup: string[] = [];
  for (const line of lines.slice(11)) {
    if (line.startsWith("---") && tempGroup.length > 0) {
      groupLines.push(tempGroup);
      tempGroup = [];
    }
    tempGroup.push(line);
  }
  if (tempGroup.length > 0) groupLines.push(tempGroup);

  let batchGroups: string[] = [header];
  let batchLen = header.length;
  for (const group of groupLines) {
    const groupText = group.join("\n");
    if (batchLen + groupText.length > MAX_PROMPT && batchGroups.length > 1) {
      batches.push(batchGroups.join("\n"));
      batchGroups = [header];
      batchLen = header.length;
    }
    batchGroups.push(groupText);
    batchLen += groupText.length;
  }
  if (batchGroups.length > 1) batches.push(batchGroups.join("\n"));

  console.log(`배치 수: ${batches.length}`);

  let fixed = 0;
  for (let i = 0; i < batches.length; i++) {
    console.log(`\nBatch ${i + 1}/${batches.length}...`);

    const tmpFile = join(CACHE_DIR, "_overlap_prompt.txt");
    writeFileSync(tmpFile, batches[i]);

    try {
      const result = execSync(
        `cat "${tmpFile}" | claude -p --model sonnet --no-session-persistence`,
        { encoding: "utf-8", timeout: 600000, maxBuffer: 10 * 1024 * 1024 }
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
      console.log(`  → 누적 ${fixed}개 수정`);
    } catch (err) {
      console.error("Batch failed:", (err as Error).message?.slice(0, 100));
    }
  }

  // 캐시 저장
  await writeFile(KO_CACHE, JSON.stringify(cache));
  console.log(`\n캐시 저장. 총 ${fixed}개 수정.`);

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
