/**
 * 한국어 페이지 스캐너
 *
 * 페이지의 한국어 텍스트를 스캔하여 N2 일본어 단어와 매칭되는
 * 한국어 단어를 하이라이트하고 일본어 루비를 표시합니다.
 */

import { sendMessage } from "@/shared/messages";
import type { DictEntry } from "@/shared/types";
import { showPopup, hidePopup } from "./popup";

const PROCESSED_ATTR = "data-jlpt-processed";
const MATCH_CLASS = "jlpt-match";
const RUBY_CLASS = "jlpt-ruby";
const BATCH_SIZE = 50;

// 표시 모드: "underline" | "ruby" | "force"
type DisplayMode = "underline" | "ruby" | "force";

let isEnabled = true;
let displayMode: DisplayMode = "underline";
let activeLevels: number[] = [2];
let observer: MutationObserver | null = null;

export function initScanner(): void {
  // 저장된 설정 로드
  chrome.storage.sync.get(["enabled", "displayMode", "levels"], (result) => {
    if (result.enabled === false) isEnabled = false;
    if (result.displayMode) displayMode = result.displayMode as DisplayMode;
    if (result.levels !== undefined) activeLevels = result.levels as number[];

    // 초기 스캔 (약간 지연)
    if (isEnabled) {
      setTimeout(() => scanPage(), 500);
    }
  });

  // 동적 콘텐츠 감지
  observer = new MutationObserver(
    debounce(() => {
      if (isEnabled) scanPage();
    }, 1000)
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 하이라이트된 단어 호버 이벤트
  document.addEventListener("mouseover", handleMatchHover);
  document.addEventListener("mouseout", handleMatchLeave);

  // 팝업에서 온/오프 메시지 수신
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "setEnabled") {
      setEnabled(msg.value);
      if (msg.value) scanPage();
    } else if (msg.action === "setDisplayMode") {
      setDisplayMode(msg.value);
    } else if (msg.action === "setLevels") {
      activeLevels = msg.value;
      removeAllHighlights();
      if (isEnabled) scanPage();
    }
  });
}

async function scanPage(): Promise<void> {
  if (!isEnabled) return;

  // 텍스트 노드 수집
  const textNodes = collectTextNodes();
  if (textNodes.length === 0) return;

  // 모든 텍스트에서 한국어 단어 추출
  const allWords = new Set<string>();
  const nodeWordMap = new Map<Text, string[]>();

  for (const node of textNodes) {
    const text = node.textContent || "";
    const words = splitKoreanWords(text);
    if (words.length > 0) {
      nodeWordMap.set(node, words);
      for (const w of words) allWords.add(w);
    }
  }

  if (allWords.size === 0) return;

  // Service Worker에 배치 검색 요청
  try {
    const response = await sendMessage({
      type: "SCAN_WORDS",
      words: [...allWords],
      levels: activeLevels,
    });

    if (response.type !== "SCAN_RESULT") return;

    const matches =
      response.matches instanceof Map
        ? response.matches
        : new Map(Object.entries(response.matches as Record<string, DictEntry[]>));

    if (matches.size === 0) return;

    console.log(`[JLPT N2] Found ${matches.size} matching Korean words`);

    // 배치 처리로 DOM 업데이트
    let processed = 0;
    const nodesToProcess = [...nodeWordMap.entries()].filter(([, words]) =>
      words.some((w) => matches.has(w))
    );

    for (const [node, words] of nodesToProcess) {
      if (!node.parentNode) continue; // 이미 제거된 노드
      highlightNode(node, words, matches);
      processed++;

      if (processed % BATCH_SIZE === 0) {
        await nextFrame();
      }
    }

    console.log(`[JLPT N2] Highlighted ${processed} text nodes`);
  } catch (err) {
    // Extension context invalidated 등 무시
  }
}

function collectTextNodes(): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // 이미 처리된 노드, 스크립트, 스타일, 우리 팝업 내부는 스킵
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`[${PROCESSED_ATTR}], script, style, noscript, #jlpt-n2-popup`)) {
        return NodeFilter.FILTER_REJECT;
      }
      // 빈 텍스트 스킵
      const text = node.textContent || "";
      if (text.trim().length < 2) return NodeFilter.FILTER_REJECT;
      // 한국어 포함 여부
      if (!/[\uAC00-\uD7AF]/.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    nodes.push(node);
  }
  return nodes;
}

function splitKoreanWords(text: string): string[] {
  return text
    .split(/[\s,.!?;:'"()\[\]{}·…\-\/\u3000-\u303F]+/)
    .filter((w) => w.length >= 2 && /[\uAC00-\uD7AF]/.test(w));
}

function highlightNode(
  textNode: Text,
  words: string[],
  matches: Map<string, DictEntry[]>
): void {
  const text = textNode.textContent || "";
  const parent = textNode.parentNode;
  if (!parent) return;

  // 이미 처리된 부모 스킵
  if ((parent as Element).closest?.(`[${PROCESSED_ATTR}]`)) return;

  // 매칭되는 단어 찾기 (긴 것 우선)
  const matchedWords = words
    .filter((w) => matches.has(w))
    .sort((a, b) => b.length - a.length);

  if (matchedWords.length === 0) return;

  // 정규식으로 매칭 단어 찾기
  const escaped = matchedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");

  const parts = text.split(regex);
  if (parts.length <= 1) return; // 매칭 없음

  const fragment = document.createDocumentFragment();

  for (const part of parts) {
    const entries = matches.get(part);
    if (entries && entries.length > 0) {
      const entry = entries[0]; // 첫 번째 매칭
      const span = document.createElement("span");
      span.className = MATCH_CLASS;
      span.setAttribute(PROCESSED_ATTR, "1");
      span.setAttribute("data-entry-id", entry.id);
      span.setAttribute("data-expression", entry.expression);
      span.setAttribute("data-reading", entry.reading);
      span.setAttribute("data-meanings", JSON.stringify(entry.meanings));
      span.setAttribute("data-meanings-en", JSON.stringify(entry.meaningsEn));
      span.setAttribute("data-pos", JSON.stringify(entry.pos));

      span.setAttribute("data-original", part);

      const needsReading = entry.expression !== entry.reading;

      switch (displayMode) {
        case "force":
          // 강제모드: 한국어를 일본어로 대체
          span.innerHTML = needsReading
            ? `<ruby class="${RUBY_CLASS} jlpt-force">${entry.expression}<rt>${entry.reading}</rt></ruby>`
            : `<span class="${RUBY_CLASS} jlpt-force">${entry.expression}</span>`;
          span.classList.add("jlpt-force-mode");
          break;
        case "ruby":
          // 루비모드: 한국어 + 일본어 루비
          span.innerHTML = needsReading
            ? `${part}<ruby class="${RUBY_CLASS}">${entry.expression}<rt>${entry.reading}</rt></ruby>`
            : `${part}<span class="${RUBY_CLASS}">${entry.expression}</span>`;
          break;
        default:
          // 밑줄모드: 한국어만
          span.textContent = part;
      }

      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  }

  parent.replaceChild(fragment, textNode);
}

// --- 호버 팝업 ---

function handleMatchHover(e: MouseEvent): void {
  const target = (e.target as Element).closest?.(`.${MATCH_CLASS}`);
  if (!target) return;

  const entry: DictEntry = {
    id: target.getAttribute("data-entry-id") || "",
    expression: target.getAttribute("data-expression") || "",
    reading: target.getAttribute("data-reading") || "",
    meanings: JSON.parse(target.getAttribute("data-meanings") || "[]"),
    meaningsEn: JSON.parse(target.getAttribute("data-meanings-en") || "[]"),
    jlpt: 2,
    pos: JSON.parse(target.getAttribute("data-pos") || "[]"),
  };

  const rect = target.getBoundingClientRect();
  showPopup([entry], rect.left, rect.bottom + 5);
}

function handleMatchLeave(e: MouseEvent): void {
  const target = e.target as Element;
  const related = e.relatedTarget as Element | null;

  // 팝업 자체로 이동하는 경우는 숨기지 않음
  if (related?.closest?.("#jlpt-n2-popup")) return;
  if (target.closest?.(`.${MATCH_CLASS}`) && !related?.closest?.(`.${MATCH_CLASS}`)) {
    hidePopup();
  }
}

// --- 유틸 ---

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: number;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  }) as T;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  if (!enabled) {
    removeAllHighlights();
  }
}

export function setDisplayMode(mode: DisplayMode): void {
  displayMode = mode;
  // 기존 하이라이트를 새 모드로 업데이트
  document.querySelectorAll(`.${MATCH_CLASS}`).forEach((el) => {
    const original = el.getAttribute("data-original") || "";
    const expr = el.getAttribute("data-expression") || "";
    const reading = el.getAttribute("data-reading") || "";

    el.classList.remove("jlpt-force-mode");

    const needsReading = expr !== reading;

    switch (mode) {
      case "force":
        el.innerHTML = needsReading
          ? `<ruby class="${RUBY_CLASS} jlpt-force">${expr}<rt>${reading}</rt></ruby>`
          : `<span class="${RUBY_CLASS} jlpt-force">${expr}</span>`;
        el.classList.add("jlpt-force-mode");
        break;
      case "ruby":
        el.innerHTML = needsReading
          ? `${original}<ruby class="${RUBY_CLASS}">${expr}<rt>${reading}</rt></ruby>`
          : `${original}<span class="${RUBY_CLASS}">${expr}</span>`;
        break;
      default:
        el.textContent = original;
    }
  });
}

function removeAllHighlights(): void {
  document.querySelectorAll(`.${MATCH_CLASS}`).forEach((el) => {
    // 원래 한국어 텍스트만 남김
    const firstText = el.firstChild;
    if (firstText && firstText.nodeType === Node.TEXT_NODE) {
      el.replaceWith(document.createTextNode(firstText.textContent || ""));
    }
  });
}
