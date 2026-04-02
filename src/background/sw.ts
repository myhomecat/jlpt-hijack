import { onMessage } from "@/shared/messages";
import { initDatabase, lookupKorean, lookupKoreanBatch, getKoreanIndexSize } from "./dictionary";
import { stemKorean } from "./korean-stemmer";
import type { DictEntry } from "@/shared/types";

// DB 초기화
initDatabase()
  .then(() => console.log("[JLPT N2] DB ready, Korean index:", getKoreanIndexSize(), "terms"))
  .catch((err) => console.error("[JLPT N2] DB init failed:", err));

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[JLPT N2] Extension installed/updated");
  await initDatabase();
});

// Content Script 메시지 처리
onMessage((message, _sender, sendResponse) => {
  switch (message.type) {
    case "SCAN_WORDS": {
      // 한국어 단어 배열 → 어근 추출 → 역방향 검색
      const allStems: string[] = [];
      const stemToOriginal = new Map<string, string>();

      for (const word of message.words) {
        const stems = stemKorean(word);
        for (const stem of stems) {
          allStems.push(stem);
          if (!stemToOriginal.has(stem)) {
            stemToOriginal.set(stem, word);
          }
        }
      }

      lookupKoreanBatch(allStems, message.levels)
        .then((matchMap) => {
          // stem 매칭을 원래 단어로 되돌림
          const result: Record<string, DictEntry[]> = {};
          for (const [stem, entries] of matchMap) {
            const original = stemToOriginal.get(stem) || stem;
            if (!result[original]) {
              result[original] = entries;
            }
          }
          sendResponse({ type: "SCAN_RESULT", matches: result });
        })
        .catch((err) => {
          console.error("[JLPT N2] Scan error:", err);
          sendResponse({ type: "SCAN_RESULT", matches: {} });
        });
      return true;
    }

    case "LOOKUP_KOREAN": {
      const stems = stemKorean(message.word);
      // 모든 어근 후보에서 검색
      Promise.all(stems.map((s) => lookupKorean(s)))
        .then((results) => {
          const seen = new Set<string>();
          const entries: DictEntry[] = [];
          for (const batch of results) {
            for (const entry of batch) {
              if (!seen.has(entry.id)) {
                seen.add(entry.id);
                entries.push(entry);
              }
            }
          }
          sendResponse({
            type: "LOOKUP_KOREAN_RESULT",
            entries,
            originalWord: message.word,
          });
        })
        .catch(() => {
          sendResponse({
            type: "LOOKUP_KOREAN_RESULT",
            entries: [],
            originalWord: message.word,
          });
        });
      return true;
    }

    case "ADD_SRS": {
      sendResponse({ type: "ADD_SRS_RESULT", success: true });
      return true;
    }

    case "GET_SETTINGS": {
      return true;
    }
  }
});

console.log("[JLPT N2] Service Worker started");
