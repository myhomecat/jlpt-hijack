// 사전 엔트리
export interface DictEntry {
  id: string;
  expression: string; // 漢字表記 (例: 食べる)
  reading: string; // ひらがな (例: たべる)
  meanings: string[]; // 한국어 뜻 (없으면 영어)
  meaningsEn: string[]; // 영어 뜻 (항상)
  jlpt: number; // JLPT 레벨 (2 = N2)
  pos: string[]; // 품사 (verb, noun, etc.)
}

// 디인플렉션 규칙
export interface DeinflectionRule {
  from: string; // 활용 어미 (例: ている)
  to: string; // 사전형 어미 (例: る)
  type: number; // 품사 타입 비트마스크
  reason: string; // 변환 이유 (例: "te-iru")
}

// 디인플렉션 결과 후보
export interface DeinflectionCandidate {
  term: string; // 사전형 후보 (例: 食べる)
  rules: number; // 적용된 규칙 타입
  reasons: string[]; // 적용된 변환 이유 목록
}

// SRS 카드
export interface SrsCard {
  wordId: string;
  interval: number; // 다음 복습까지 일수
  ease: number; // 난이도 계수 (기본 2.5)
  due: number; // 다음 복습 시각 (Unix timestamp ms)
  reps: number; // 복습 횟수
  lapses: number; // 틀린 횟수
  status: SrsStatus;
  updatedAt: number; // 마지막 수정 시각 (Unix timestamp ms)
}

export type SrsStatus = "new" | "learning" | "review" | "graduated";

// SRS 복습 등급
export type SrsGrade = "again" | "hard" | "good" | "easy";

// 단어 학습 상태 (하이라이트 색상 결정)
export type WordKnowledge = "unknown" | "learning" | "known" | "outOfScope";

// 한국어 단어 매칭 결과
export interface KoreanMatch {
  korean: string; // 매칭된 한국어 단어
  entry: DictEntry; // 대응하는 일본어 단어
}

// Content Script ↔ Service Worker 메시지
export type Message =
  | { type: "SCAN_WORDS"; words: string[]; levels: number[] }
  | { type: "SCAN_RESULT"; matches: Map<string, DictEntry[]> | Record<string, DictEntry[]> }
  | { type: "LOOKUP_KOREAN"; word: string }
  | { type: "LOOKUP_KOREAN_RESULT"; entries: DictEntry[]; originalWord: string }
  | { type: "ADD_SRS"; entry: DictEntry }
  | { type: "ADD_SRS_RESULT"; success: boolean }
  | { type: "GET_SETTINGS" }
  | { type: "SETTINGS"; settings: ExtensionSettings };

// 익스텐션 설정
export interface ExtensionSettings {
  hoverEnabled: boolean;
  highlightEnabled: boolean;
  jlptLevel: number[]; // 표시할 JLPT 레벨 [1, 2, 3, ...]
  highlightColors: {
    unknown: string;
    learning: string;
    known: string;
  };
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  hoverEnabled: true,
  highlightEnabled: true,
  jlptLevel: [2],
  highlightColors: {
    unknown: "#ffcccc",
    learning: "#ffffcc",
    known: "#ccffcc",
  },
};
