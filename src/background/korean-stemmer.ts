/**
 * 한국어 조사/어미 제거 (간단한 suffix stripping)
 *
 * 완벽한 형태소 분석이 아닌, N2 단어 매칭용 간단한 어근 추출.
 * "수출을" → "수출", "경험이" → "경험", "관계에서" → "관계"
 */

// 긴 것부터 매칭해야 "에서"가 "에" 보다 먼저 잡힘
const PARTICLES = [
  // 복합 조사 (3글자)
  "에서는", "으로는", "에서의", "으로의", "까지는", "부터는", "에게는", "한테는",
  "만으로", "까지의", "부터의",
  // 복합 조사 (2글자)
  "에서", "으로", "까지", "부터", "에게", "한테", "처럼", "만큼",
  "대로", "마다", "밖에", "조차", "마저",
  // 단순 조사 (1글자)
  "은", "는", "이", "가", "을", "를", "에", "의", "와", "과",
  "로", "도", "만", "야", "서",
];

// 용언 어미 (동사/형용사 활용)
const VERB_ENDINGS = [
  // 긴 것부터
  "했습니다", "됩니다", "합니다", "입니다",
  "하였다", "하는데", "하면서", "하지만",
  "했던", "하는", "하여", "했다", "한다", "하다", "된다", "되는",
  "하게", "하고", "하며", "하면", "해서", "하지",
  "적인", "적으로", "적이",
  "했고", "됐다", "된",
  "했", "한", "할", "함", "해",
];

/**
 * 한국어 단어에서 조사/어미를 제거하여 어근 후보를 반환
 * 원본도 후보에 포함
 */
export function stemKorean(word: string): string[] {
  if (word.length < 2) return [word];

  const candidates = new Set<string>();
  candidates.add(word);

  // 조사 제거
  for (const p of PARTICLES) {
    if (word.endsWith(p) && word.length > p.length) {
      const stem = word.slice(0, -p.length);
      if (stem.length >= 2) {
        candidates.add(stem);
      }
    }
  }

  // 어미 제거
  for (const e of VERB_ENDINGS) {
    if (word.endsWith(e) && word.length > e.length) {
      const stem = word.slice(0, -e.length);
      if (stem.length >= 2) {
        candidates.add(stem);
      }
    }
  }

  return [...candidates];
}

/**
 * 텍스트가 한국어를 포함하는지 확인
 */
export function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

/**
 * 한국어 텍스트를 단어 단위로 분리
 * 공백, 구두점, 괄호 등으로 분리
 */
export function splitKoreanWords(text: string): string[] {
  return text
    .split(/[\s,.!?;:'"()\[\]{}·…\-\/\u3000-\u303F]+/)
    .filter((w) => w.length >= 2 && containsKorean(w));
}
