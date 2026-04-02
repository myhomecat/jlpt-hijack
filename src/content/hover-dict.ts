import { sendMessage } from "@/shared/messages";
import { showPopup, hidePopup } from "./popup";

let isEnabled = true;

export function initHoverDict(): void {
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("keydown", handleKeyDown);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    hidePopup();
  }
}

let debounceTimer: number | null = null;

function handleMouseMove(e: MouseEvent): void {
  if (!isEnabled) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    handleHover(e.clientX, e.clientY);
  }, 50);
}

async function handleHover(x: number, y: number): Promise<void> {
  const range = getTextAtPoint(x, y);
  if (!range) {
    hidePopup();
    return;
  }

  const text = range.text;
  if (!text || !containsJapanese(text)) {
    hidePopup();
    return;
  }

  try {
    console.log("[JLPT N2] Looking up:", text);
    const response = await sendMessage({
      type: "LOOKUP_KOREAN",
      word: text,
    });

    console.log("[JLPT N2] Response:", response);

    if (response && response.type === "LOOKUP_KOREAN_RESULT" && response.entries.length > 0) {
      showPopup(response.entries, x, y);
    } else {
      hidePopup();
    }
  } catch (err) {
    console.error("[JLPT N2] Lookup failed:", err);
  }
}

function getTextAtPoint(
  x: number,
  y: number
): { text: string; node: Text } | null {
  // caretRangeFromPoint -> caretPositionFromPoint fallback
  let range: Range | null = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  }

  if (!range) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const textNode = node as Text;
  const offset = range.startOffset;
  const fullText = textNode.textContent || "";

  // 커서 위치부터 최대 10문자 추출
  const text = fullText.substring(offset, offset + 10);

  return text.trim() ? { text: text.trim(), node: textNode } : null;
}

function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  if (!enabled) hidePopup();
}
