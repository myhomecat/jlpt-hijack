/**
 * 번역 오역 검증 스크립트
 *
 * 1. 같은 한국어에 3개 이상 매칭되는 단어 탐지
 * 2. 한자어인데 한국 한자음과 안 맞는 단어 탐지
 * 3. 결과를 .cache/errors.json에 저장
 *
 * 사용법: npx tsx scripts/verify-translations.ts
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const DICT_FILE = join(import.meta.dirname, "..", "public", "data", "jmdict-n2.json");
const ERRORS_FILE = join(CACHE_DIR, "errors.json");

interface DictEntry {
  id: string;
  expression: string;
  reading: string;
  meanings: string[];
  meaningsEn: string[];
  jlpt: number;
  pos: string[];
}

// 한자 → 한국 한자음 매핑 (주요 한자)
// KANJIDIC2 기반 상위 500자
const KANJI_TO_KOREAN: Record<string, string[]> = {
  // 가나다 순으로 자주 쓰는 한자
  "家": ["가"], "加": ["가"], "可": ["가"], "価": ["가"], "果": ["과"],
  "科": ["과"], "課": ["과"], "過": ["과"], "関": ["관"], "観": ["관"],
  "管": ["관"], "間": ["간"], "感": ["감"], "減": ["감"],
  "強": ["강"], "講": ["강"], "開": ["개"], "改": ["개"], "客": ["객"],
  "格": ["격"], "決": ["결"], "結": ["결"], "経": ["경"], "景": ["경"],
  "警": ["경"], "計": ["계"], "届": ["계"],
  "古": ["고"], "故": ["고"], "高": ["고"], "告": ["고"],
  "公": ["공"], "工": ["공"], "共": ["공"], "空": ["공"],
  "果": ["과"], "官": ["관"],
  "教": ["교"], "交": ["교"], "校": ["교"],
  "国": ["국"], "軍": ["군"], "権": ["권"],
  "近": ["근"], "金": ["금"], "急": ["급"], "給": ["급"],
  "記": ["기"], "期": ["기"], "機": ["기"], "技": ["기"], "気": ["기"],
  "内": ["내"], "南": ["남"],
  "年": ["년"], "念": ["념"],
  "農": ["농"], "能": ["능"],
  "大": ["대"], "代": ["대"], "対": ["대"], "待": ["대"],
  "道": ["도"], "度": ["도"], "都": ["도"], "動": ["동"], "同": ["동"], "東": ["동"],
  "得": ["득"],
  "力": ["력", "역"], "連": ["련"], "例": ["례"],
  "理": ["리", "이"], "利": ["리", "이"], "立": ["립"],
  "馬": ["마"], "万": ["만"], "末": ["말"],
  "名": ["명"], "明": ["명"], "命": ["명"],
  "母": ["모"], "目": ["목"], "木": ["목"],
  "文": ["문"], "問": ["문"], "物": ["물"],
  "民": ["민"], "米": ["미"],
  "反": ["반"], "半": ["반"], "発": ["발"], "方": ["방"], "放": ["방"],
  "法": ["법"], "別": ["별"], "変": ["변"], "病": ["병"],
  "保": ["보"], "報": ["보"], "部": ["부"], "北": ["북"], "分": ["분"],
  "不": ["불", "부"],
  "事": ["사"], "社": ["사"], "死": ["사"], "使": ["사"], "思": ["사"],
  "産": ["산"], "山": ["산"],
  "上": ["상"], "商": ["상"], "相": ["상"],
  "生": ["생"], "西": ["서"], "書": ["서"],
  "先": ["선"], "選": ["선"], "設": ["설"], "説": ["설"],
  "成": ["성"], "性": ["성"], "声": ["성"],
  "世": ["세"], "税": ["세"],
  "小": ["소"], "少": ["소"], "所": ["소"],
  "速": ["속"], "手": ["수"], "数": ["수"], "水": ["수"],
  "収": ["수"], "受": ["수"], "首": ["수"], "術": ["술"],
  "市": ["시"], "始": ["시"], "時": ["시"], "示": ["시"], "視": ["시"],
  "食": ["식"], "新": ["신"], "身": ["신"], "信": ["신"],
  "実": ["실"], "室": ["실"], "心": ["심"],
  "安": ["안"], "案": ["안"],
  "野": ["야"], "夜": ["야"],
  "約": ["약"], "薬": ["약"],
  "洋": ["양"], "様": ["양"],
  "語": ["어"], "業": ["업"],
  "女": ["여"], "然": ["연"], "年": ["연"],
  "熱": ["열"], "営": ["영"], "英": ["영"], "映": ["영"],
  "予": ["예"], "五": ["오"],
  "温": ["온"], "外": ["외"],
  "要": ["요"], "用": ["용"],
  "運": ["운"], "員": ["원"], "院": ["원"], "園": ["원"], "原": ["원"],
  "月": ["월"], "位": ["위"], "委": ["위"],
  "有": ["유"], "由": ["유"], "油": ["유"],
  "育": ["육"], "銀": ["은"],
  "意": ["의"], "医": ["의"], "議": ["의"],
  "二": ["이"], "人": ["인"],
  "日": ["일"], "一": ["일"],
  "入": ["입"],
  "自": ["자"], "子": ["자"], "者": ["자"],
  "作": ["작"], "場": ["장"], "長": ["장"],
  "在": ["재"], "材": ["재"], "財": ["재"],
  "的": ["적"], "全": ["전"], "前": ["전"], "電": ["전"], "戦": ["전"],
  "点": ["점"], "店": ["점"],
  "正": ["정"], "政": ["정"], "定": ["정"], "情": ["정"], "整": ["정"],
  "精": ["정"], "静": ["정"], "停": ["정"],
  "制": ["제"], "題": ["제"], "際": ["제"],
  "助": ["조"], "調": ["조"], "組": ["조"], "条": ["조"],
  "族": ["족"], "存": ["존"],
  "主": ["주"], "住": ["주"], "注": ["주"], "州": ["주"],
  "中": ["중"], "重": ["중"], "増": ["증"], "証": ["증"],
  "地": ["지"], "知": ["지"], "止": ["지"], "持": ["지"], "指": ["지"],
  "直": ["직"], "職": ["직"],
  "質": ["질"],
  "集": ["집"],
  "次": ["차"], "差": ["차"], "車": ["차"],
  "参": ["참"], "着": ["착"],
  "天": ["천"], "千": ["천"],
  "鉄": ["철"],
  "体": ["체"],
  "初": ["초"],
  "最": ["최"],
  "出": ["출"], "取": ["취"],
  "親": ["친"],
  "通": ["통"], "投": ["투"], "特": ["특"],
  "判": ["판"], "半": ["반"],
  "平": ["평"], "表": ["표"],
  "品": ["품"],
  "必": ["필"],
  "下": ["하"], "学": ["학"], "韓": ["한"], "限": ["한"],
  "海": ["해"], "解": ["해"], "害": ["해"],
  "行": ["행"], "向": ["향"],
  "現": ["현"], "形": ["형"],
  "号": ["호"], "好": ["호"],
  "化": ["화"], "話": ["화"], "画": ["화"],
  "確": ["확"], "活": ["활"], "会": ["회"], "回": ["회"],
  "効": ["효"],
  "後": ["후"],
  "輸": ["수"], "験": ["험"], "見": ["견"],
};

async function main(): Promise<void> {
  const raw = await readFile(DICT_FILE, "utf-8");
  const entries: DictEntry[] = JSON.parse(raw);

  const errors: Array<{
    id: string;
    expression: string;
    reading: string;
    currentKo: string[];
    reason: string;
    suggestedKo?: string;
  }> = [];

  // --- 검증 1: 같은 한국어에 3개 이상 매칭 ---
  const koToEntries = new Map<string, DictEntry[]>();
  for (const entry of entries) {
    if (entry.jlpt === 0) continue;
    for (const m of entry.meanings) {
      if (!/[\uAC00-\uD7AF]/.test(m)) continue;
      const existing = koToEntries.get(m) || [];
      existing.push(entry);
      koToEntries.set(m, existing);
    }
  }

  let overlapCount = 0;
  for (const [ko, matched] of koToEntries) {
    if (matched.length >= 3) {
      overlapCount++;
      for (const entry of matched) {
        errors.push({
          id: entry.id,
          expression: entry.expression,
          reading: entry.reading,
          currentKo: entry.meanings,
          reason: `"${ko}"에 ${matched.length}개 단어 매칭: ${matched.map((e) => e.expression).join(", ")}`,
        });
      }
    }
  }

  // --- 검증 2: 한자어 한자음 불일치 ---
  let kanjiMismatch = 0;
  for (const entry of entries) {
    if (entry.jlpt === 0) continue;
    if (!entry.meanings.some((m) => /[\uAC00-\uD7AF]/.test(m))) continue;

    // 한자로만 구성된 표현인지 확인
    if (!/^[\u4E00-\u9FFF]+$/.test(entry.expression)) continue;

    // 한자음 추정
    const expectedKo = entry.expression
      .split("")
      .map((ch) => KANJI_TO_KOREAN[ch]?.[0] || "?")
      .join("");

    if (expectedKo.includes("?")) continue; // 매핑 없는 한자 스킵

    // 현재 한국어 뜻에 한자음이 포함돼있는지 확인
    const hasMatch = entry.meanings.some((m) => m.includes(expectedKo));

    if (!hasMatch) {
      kanjiMismatch++;
      errors.push({
        id: entry.id,
        expression: entry.expression,
        reading: entry.reading,
        currentKo: entry.meanings,
        reason: `한자음 불일치: 예상 "${expectedKo}" but got "${entry.meanings.join("; ")}"`,
        suggestedKo: expectedKo,
      });
    }
  }

  // 중복 제거
  const seen = new Set<string>();
  const uniqueErrors = errors.filter((e) => {
    const key = e.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`=== 검증 결과 ===`);
  console.log(`같은 한국어에 3개+ 매칭: ${overlapCount}건`);
  console.log(`한자음 불일치: ${kanjiMismatch}건`);
  console.log(`총 오역 후보: ${uniqueErrors.length}건`);

  await writeFile(ERRORS_FILE, JSON.stringify(uniqueErrors, null, 2));
  console.log(`\n저장: ${ERRORS_FILE}`);

  // 샘플 출력
  console.log(`\n--- 한자음 불일치 샘플 ---`);
  uniqueErrors
    .filter((e) => e.reason.startsWith("한자음"))
    .slice(0, 10)
    .forEach((e) => {
      console.log(`  ${e.expression} (${e.reading}) → 현재: "${e.currentKo.join("; ")}" / 예상: "${e.suggestedKo}"`);
    });
}

main().catch(console.error);
