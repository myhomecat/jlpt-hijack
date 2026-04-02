import type { DictEntry } from "@/shared/types";

const POPUP_ID = "jlpt-n2-popup";
let popupEl: HTMLElement | null = null;

export function showPopup(entries: DictEntry[], x: number, y: number): void {
  hidePopup();

  if (entries.length === 0) return;

  popupEl = document.createElement("div");
  popupEl.id = POPUP_ID;

  for (const entry of entries.slice(0, 3)) {
    const entryEl = document.createElement("div");
    entryEl.className = "jlpt-entry";

    // 일본어 표기 + 읽기
    const header = document.createElement("div");
    header.className = "jlpt-entry-header";

    const expression = document.createElement("span");
    expression.className = "jlpt-expression";
    expression.textContent = entry.expression;

    const reading = document.createElement("span");
    reading.className = "jlpt-reading";
    reading.textContent = entry.reading;

    const badge = document.createElement("span");
    badge.className = "jlpt-badge";
    badge.textContent = "N2";

    header.append(expression, reading, badge);

    // 한국어 뜻
    const meanings = document.createElement("div");
    meanings.className = "jlpt-meanings";
    meanings.textContent = entry.meanings.join("; ");

    // 영어 뜻
    const meaningsEn = document.createElement("div");
    meaningsEn.className = "jlpt-meanings-en";
    meaningsEn.textContent = entry.meaningsEn.join("; ");

    // 품사
    const pos = document.createElement("div");
    pos.className = "jlpt-pos";
    pos.textContent = entry.pos.join(", ");

    entryEl.append(header, meanings, meaningsEn, pos);
    popupEl.append(entryEl);
  }

  document.body.append(popupEl);
  positionPopup(popupEl, x, y);
}

function positionPopup(el: HTMLElement, x: number, y: number): void {
  // 먼저 화면에 표시해서 크기 측정
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.visibility = "hidden";

  const rect = el.getBoundingClientRect();
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  let left = x;
  let top = y;

  if (left + rect.width > viewW - 10) {
    left = viewW - rect.width - 10;
  }
  if (top + rect.height > viewH - 10) {
    top = y - rect.height - 30;
  }

  el.style.left = `${Math.max(5, left)}px`;
  el.style.top = `${Math.max(5, top)}px`;
  el.style.visibility = "visible";
}

export function hidePopup(): void {
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
}
