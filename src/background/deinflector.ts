import type { DeinflectionCandidate, DeinflectionRule } from "@/shared/types";

// 품사 비트마스크
const enum WordType {
  IchidanVerb = 1 << 0, // 一段動詞 (る-verb)
  GodanVerb = 1 << 1, // 五段動詞 (う-verb)
  SuruVerb = 1 << 2, // する動詞
  KuruVerb = 1 << 3, // 来る動詞
  IAdjective = 1 << 4, // い形容詞
  NaAdjective = 1 << 5, // な形容詞
}

// 일본어 디인플렉션 규칙 (Yomitan japanese-transforms 참고, 자체 구현)
const rules: DeinflectionRule[] = [
  // === て形 (te-form) ===
  { from: "て", to: "る", type: WordType.IchidanVerb, reason: "te-form" },
  { from: "って", to: "う", type: WordType.GodanVerb, reason: "te-form" },
  { from: "って", to: "つ", type: WordType.GodanVerb, reason: "te-form" },
  { from: "って", to: "る", type: WordType.GodanVerb, reason: "te-form" },
  { from: "んで", to: "む", type: WordType.GodanVerb, reason: "te-form" },
  { from: "んで", to: "ぶ", type: WordType.GodanVerb, reason: "te-form" },
  { from: "んで", to: "ぬ", type: WordType.GodanVerb, reason: "te-form" },
  { from: "いて", to: "く", type: WordType.GodanVerb, reason: "te-form" },
  { from: "いで", to: "ぐ", type: WordType.GodanVerb, reason: "te-form" },
  { from: "して", to: "す", type: WordType.GodanVerb, reason: "te-form" },

  // === た形 (past) ===
  { from: "た", to: "る", type: WordType.IchidanVerb, reason: "past" },
  { from: "った", to: "う", type: WordType.GodanVerb, reason: "past" },
  { from: "った", to: "つ", type: WordType.GodanVerb, reason: "past" },
  { from: "った", to: "る", type: WordType.GodanVerb, reason: "past" },
  { from: "んだ", to: "む", type: WordType.GodanVerb, reason: "past" },
  { from: "んだ", to: "ぶ", type: WordType.GodanVerb, reason: "past" },
  { from: "んだ", to: "ぬ", type: WordType.GodanVerb, reason: "past" },
  { from: "いた", to: "く", type: WordType.GodanVerb, reason: "past" },
  { from: "いだ", to: "ぐ", type: WordType.GodanVerb, reason: "past" },
  { from: "した", to: "す", type: WordType.GodanVerb, reason: "past" },

  // === ない形 (negative) ===
  { from: "ない", to: "る", type: WordType.IchidanVerb, reason: "negative" },
  { from: "わない", to: "う", type: WordType.GodanVerb, reason: "negative" },
  { from: "たない", to: "つ", type: WordType.GodanVerb, reason: "negative" },
  { from: "らない", to: "る", type: WordType.GodanVerb, reason: "negative" },
  { from: "まない", to: "む", type: WordType.GodanVerb, reason: "negative" },
  { from: "ばない", to: "ぶ", type: WordType.GodanVerb, reason: "negative" },
  { from: "なない", to: "ぬ", type: WordType.GodanVerb, reason: "negative" },
  { from: "かない", to: "く", type: WordType.GodanVerb, reason: "negative" },
  { from: "がない", to: "ぐ", type: WordType.GodanVerb, reason: "negative" },
  { from: "さない", to: "す", type: WordType.GodanVerb, reason: "negative" },

  // === ます形 (polite) ===
  { from: "ます", to: "る", type: WordType.IchidanVerb, reason: "masu" },
  { from: "います", to: "う", type: WordType.GodanVerb, reason: "masu" },
  { from: "ちます", to: "つ", type: WordType.GodanVerb, reason: "masu" },
  { from: "ります", to: "る", type: WordType.GodanVerb, reason: "masu" },
  { from: "みます", to: "む", type: WordType.GodanVerb, reason: "masu" },
  { from: "びます", to: "ぶ", type: WordType.GodanVerb, reason: "masu" },
  { from: "にます", to: "ぬ", type: WordType.GodanVerb, reason: "masu" },
  { from: "きます", to: "く", type: WordType.GodanVerb, reason: "masu" },
  { from: "ぎます", to: "ぐ", type: WordType.GodanVerb, reason: "masu" },
  { from: "します", to: "す", type: WordType.GodanVerb, reason: "masu" },

  // === ている (progressive) ===
  {
    from: "ている",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "te-iru",
  },
  {
    from: "っている",
    to: "う",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "っている",
    to: "つ",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "っている",
    to: "る",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "んでいる",
    to: "む",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "んでいる",
    to: "ぶ",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "んでいる",
    to: "ぬ",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "いている",
    to: "く",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "いでいる",
    to: "ぐ",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },
  {
    from: "している",
    to: "す",
    type: WordType.GodanVerb,
    reason: "te-iru",
  },

  // === てる (colloquial progressive) ===
  { from: "てる", to: "る", type: WordType.IchidanVerb, reason: "te-ru" },
  { from: "ってる", to: "う", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "ってる", to: "つ", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "ってる", to: "る", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "んでる", to: "む", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "んでる", to: "ぶ", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "んでる", to: "ぬ", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "いてる", to: "く", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "いでる", to: "ぐ", type: WordType.GodanVerb, reason: "te-ru" },
  { from: "してる", to: "す", type: WordType.GodanVerb, reason: "te-ru" },

  // === 可能形 (potential) ===
  {
    from: "られる",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "potential",
  },
  { from: "える", to: "う", type: WordType.GodanVerb, reason: "potential" },
  { from: "てる", to: "つ", type: WordType.GodanVerb, reason: "potential" },
  { from: "れる", to: "る", type: WordType.GodanVerb, reason: "potential" },
  { from: "める", to: "む", type: WordType.GodanVerb, reason: "potential" },
  { from: "べる", to: "ぶ", type: WordType.GodanVerb, reason: "potential" },
  { from: "ねる", to: "ぬ", type: WordType.GodanVerb, reason: "potential" },
  { from: "ける", to: "く", type: WordType.GodanVerb, reason: "potential" },
  { from: "げる", to: "ぐ", type: WordType.GodanVerb, reason: "potential" },
  { from: "せる", to: "す", type: WordType.GodanVerb, reason: "potential" },

  // === 受身形 (passive) ===
  {
    from: "られる",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "passive",
  },
  { from: "われる", to: "う", type: WordType.GodanVerb, reason: "passive" },
  { from: "たれる", to: "つ", type: WordType.GodanVerb, reason: "passive" },
  { from: "られる", to: "る", type: WordType.GodanVerb, reason: "passive" },
  { from: "まれる", to: "む", type: WordType.GodanVerb, reason: "passive" },
  { from: "ばれる", to: "ぶ", type: WordType.GodanVerb, reason: "passive" },
  { from: "なれる", to: "ぬ", type: WordType.GodanVerb, reason: "passive" },
  { from: "かれる", to: "く", type: WordType.GodanVerb, reason: "passive" },
  { from: "がれる", to: "ぐ", type: WordType.GodanVerb, reason: "passive" },
  { from: "される", to: "す", type: WordType.GodanVerb, reason: "passive" },

  // === 使役形 (causative) ===
  {
    from: "させる",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "causative",
  },
  {
    from: "わせる",
    to: "う",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "たせる",
    to: "つ",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "らせる",
    to: "る",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "ませる",
    to: "む",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "ばせる",
    to: "ぶ",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "なせる",
    to: "ぬ",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "かせる",
    to: "く",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "がせる",
    to: "ぐ",
    type: WordType.GodanVerb,
    reason: "causative",
  },
  {
    from: "させる",
    to: "す",
    type: WordType.GodanVerb,
    reason: "causative",
  },

  // === 命令形 (imperative) ===
  { from: "ろ", to: "る", type: WordType.IchidanVerb, reason: "imperative" },
  { from: "え", to: "う", type: WordType.GodanVerb, reason: "imperative" },
  { from: "て", to: "つ", type: WordType.GodanVerb, reason: "imperative" },
  { from: "れ", to: "る", type: WordType.GodanVerb, reason: "imperative" },
  { from: "め", to: "む", type: WordType.GodanVerb, reason: "imperative" },
  { from: "べ", to: "ぶ", type: WordType.GodanVerb, reason: "imperative" },
  { from: "ね", to: "ぬ", type: WordType.GodanVerb, reason: "imperative" },
  { from: "け", to: "く", type: WordType.GodanVerb, reason: "imperative" },
  { from: "げ", to: "ぐ", type: WordType.GodanVerb, reason: "imperative" },
  { from: "せ", to: "す", type: WordType.GodanVerb, reason: "imperative" },

  // === 意向形 (volitional) ===
  {
    from: "よう",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "volitional",
  },
  { from: "おう", to: "う", type: WordType.GodanVerb, reason: "volitional" },
  { from: "とう", to: "つ", type: WordType.GodanVerb, reason: "volitional" },
  { from: "ろう", to: "る", type: WordType.GodanVerb, reason: "volitional" },
  { from: "もう", to: "む", type: WordType.GodanVerb, reason: "volitional" },
  { from: "ぼう", to: "ぶ", type: WordType.GodanVerb, reason: "volitional" },
  { from: "のう", to: "ぬ", type: WordType.GodanVerb, reason: "volitional" },
  { from: "こう", to: "く", type: WordType.GodanVerb, reason: "volitional" },
  { from: "ごう", to: "ぐ", type: WordType.GodanVerb, reason: "volitional" },
  { from: "そう", to: "す", type: WordType.GodanVerb, reason: "volitional" },

  // === 仮定形 (conditional ば) ===
  {
    from: "れば",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "conditional",
  },
  {
    from: "えば",
    to: "う",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "てば",
    to: "つ",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "れば",
    to: "る",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "めば",
    to: "む",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "べば",
    to: "ぶ",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "ねば",
    to: "ぬ",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "けば",
    to: "く",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "げば",
    to: "ぐ",
    type: WordType.GodanVerb,
    reason: "conditional",
  },
  {
    from: "せば",
    to: "す",
    type: WordType.GodanVerb,
    reason: "conditional",
  },

  // === たら (conditional) ===
  { from: "たら", to: "る", type: WordType.IchidanVerb, reason: "tara" },
  { from: "ったら", to: "う", type: WordType.GodanVerb, reason: "tara" },
  { from: "ったら", to: "つ", type: WordType.GodanVerb, reason: "tara" },
  { from: "ったら", to: "る", type: WordType.GodanVerb, reason: "tara" },
  { from: "んだら", to: "む", type: WordType.GodanVerb, reason: "tara" },
  { from: "んだら", to: "ぶ", type: WordType.GodanVerb, reason: "tara" },
  { from: "んだら", to: "ぬ", type: WordType.GodanVerb, reason: "tara" },
  { from: "いたら", to: "く", type: WordType.GodanVerb, reason: "tara" },
  { from: "いだら", to: "ぐ", type: WordType.GodanVerb, reason: "tara" },
  { from: "したら", to: "す", type: WordType.GodanVerb, reason: "tara" },

  // === する動詞 ===
  { from: "した", to: "する", type: WordType.SuruVerb, reason: "past" },
  { from: "して", to: "する", type: WordType.SuruVerb, reason: "te-form" },
  { from: "しない", to: "する", type: WordType.SuruVerb, reason: "negative" },
  { from: "します", to: "する", type: WordType.SuruVerb, reason: "masu" },
  { from: "される", to: "する", type: WordType.SuruVerb, reason: "passive" },
  {
    from: "させる",
    to: "する",
    type: WordType.SuruVerb,
    reason: "causative",
  },
  {
    from: "できる",
    to: "する",
    type: WordType.SuruVerb,
    reason: "potential",
  },
  { from: "しよう", to: "する", type: WordType.SuruVerb, reason: "volitional" },
  { from: "すれば", to: "する", type: WordType.SuruVerb, reason: "conditional" },
  {
    from: "している",
    to: "する",
    type: WordType.SuruVerb,
    reason: "te-iru",
  },
  { from: "しろ", to: "する", type: WordType.SuruVerb, reason: "imperative" },
  { from: "せよ", to: "する", type: WordType.SuruVerb, reason: "imperative" },

  // === 来る動詞 ===
  { from: "きた", to: "くる", type: WordType.KuruVerb, reason: "past" },
  { from: "きて", to: "くる", type: WordType.KuruVerb, reason: "te-form" },
  { from: "こない", to: "くる", type: WordType.KuruVerb, reason: "negative" },
  { from: "きます", to: "くる", type: WordType.KuruVerb, reason: "masu" },
  { from: "こられる", to: "くる", type: WordType.KuruVerb, reason: "passive" },
  {
    from: "こさせる",
    to: "くる",
    type: WordType.KuruVerb,
    reason: "causative",
  },
  {
    from: "こられる",
    to: "くる",
    type: WordType.KuruVerb,
    reason: "potential",
  },
  { from: "こよう", to: "くる", type: WordType.KuruVerb, reason: "volitional" },
  {
    from: "くれば",
    to: "くる",
    type: WordType.KuruVerb,
    reason: "conditional",
  },
  {
    from: "きている",
    to: "くる",
    type: WordType.KuruVerb,
    reason: "te-iru",
  },
  { from: "こい", to: "くる", type: WordType.KuruVerb, reason: "imperative" },

  // === い形容詞 ===
  {
    from: "くない",
    to: "い",
    type: WordType.IAdjective,
    reason: "negative",
  },
  { from: "かった", to: "い", type: WordType.IAdjective, reason: "past" },
  {
    from: "くなかった",
    to: "い",
    type: WordType.IAdjective,
    reason: "past-negative",
  },
  { from: "くて", to: "い", type: WordType.IAdjective, reason: "te-form" },
  { from: "く", to: "い", type: WordType.IAdjective, reason: "adverbial" },
  {
    from: "ければ",
    to: "い",
    type: WordType.IAdjective,
    reason: "conditional",
  },
  { from: "さ", to: "い", type: WordType.IAdjective, reason: "nominalize" },
  {
    from: "すぎる",
    to: "い",
    type: WordType.IAdjective,
    reason: "too-much",
  },
  { from: "そう", to: "い", type: WordType.IAdjective, reason: "appearance" },

  // === ましょう (let's) ===
  {
    from: "ましょう",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "mashou",
  },
  {
    from: "いましょう",
    to: "う",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "ちましょう",
    to: "つ",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "りましょう",
    to: "る",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "みましょう",
    to: "む",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "びましょう",
    to: "ぶ",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "にましょう",
    to: "ぬ",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "きましょう",
    to: "く",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "ぎましょう",
    to: "ぐ",
    type: WordType.GodanVerb,
    reason: "mashou",
  },
  {
    from: "しましょう",
    to: "す",
    type: WordType.GodanVerb,
    reason: "mashou",
  },

  // === ませんでした (polite past negative) ===
  {
    from: "ませんでした",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "polite-past-neg",
  },

  // === ません (polite negative) ===
  {
    from: "ません",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "polite-neg",
  },

  // === ました (polite past) ===
  {
    from: "ました",
    to: "る",
    type: WordType.IchidanVerb,
    reason: "polite-past",
  },
  {
    from: "いました",
    to: "う",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "ちました",
    to: "つ",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "りました",
    to: "る",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "みました",
    to: "む",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "びました",
    to: "ぶ",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "にました",
    to: "ぬ",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "きました",
    to: "く",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "ぎました",
    to: "ぐ",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },
  {
    from: "しました",
    to: "す",
    type: WordType.GodanVerb,
    reason: "polite-past",
  },

  // === 行く special (te/ta) ===
  { from: "って", to: "く", type: WordType.GodanVerb, reason: "te-form-iku" },
  { from: "った", to: "く", type: WordType.GodanVerb, reason: "past-iku" },
];

export function deinflect(text: string): DeinflectionCandidate[] {
  const results: DeinflectionCandidate[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (text.endsWith(rule.from)) {
      const stem = text.slice(0, -rule.from.length);
      const candidate = stem + rule.to;

      if (candidate.length > 0 && !seen.has(candidate)) {
        seen.add(candidate);
        results.push({
          term: candidate,
          rules: rule.type,
          reasons: [rule.reason],
        });
      }
    }
  }

  return results;
}

export function getRuleCount(): number {
  return rules.length;
}
