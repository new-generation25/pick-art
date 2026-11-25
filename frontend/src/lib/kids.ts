/**
 * 「아이와 같이 가기 좋은 곳」(specs/004-kids-friendly): 행사마다 아이와 구분과 관람 하한 나이를 정한다.
 * 규칙(낱말·나이 표기)은 이 파일 위쪽 KIDS_RULES 한 곳에만 둔다. AI 를 쓰지 않는다(헌장 IV).
 * 원문에 없는 나이는 만들지 않는다(헌장 I): 읽지 못하면 minMonths=null.
 * 가져오는 모듈이 없어 node 테스트로 바로 돌린다.
 */

export const KIDS_RULES = {
    /** 제목에 있으면 «아이 대상» */
    targetWords: ["어린이", "키즈", "kids", "유아", "아동", "가족", "패밀리", "family", "인형극", "동화", "그림책",
        "아이와", "아이랑", "꼬마", "동요", "어린이날", "부모", "초등", "자녀"],
    /** 위 낱말이 있어도 아이 대상으로 보지 않는 표기 */
    exceptWords: ["아이돌", "아이리스", "아이유", "아이디어", "아이템", "child of our time", "의사회", "회원",
        "성인", "어른", "대학"],
    /** 이 분야는 나이 제한이 없으면 «아이 대상» — 11/26 실데이터에서 성인 강좌가 섞여 쓰지 않는다(빈 목록) */
    targetCategories: [] as string[],
    /** 나이 구간(개월): 어린 아이 = 만 6세까지, 초등학생 = 만 12세까지 */
    youngMaxMonths: 83,
    schoolMaxMonths: 155,
};

export type KidsGroup = "target" | "ok";
export type KidsOverride = "target" | "ok" | "none" | null | undefined;
export type KidsAge = "young" | "school";

export type KidsInfo = {
    group: KidsGroup | null;   // null = 해당 없음
    minMonths: number | null;  // 관람 하한(개월). 0 = 전체 관람
    ageText: string | null;    // 원문 표기(상세 «관람 연령»에 그대로)
};

const YEAR = 12;

/** «관람연령: 만 7세 이상» 같은 표기에서 원문 조각을 찾는다 */
function findAgeText(desc: string): string | null {
    const marked = desc.match(/관람\s*(?:연령|등급|대상)\s*[:：]?\s*([^\n]{1,40})/);
    if (marked) return marked[1].trim().replace(/[\s,.;·]+$/, "");
    const loose = desc.match(/(전체\s*관람(?:가)?|만\s*\d{1,2}\s*세\s*(?:이상|부터)|\d{1,2}\s*세\s*이상(?:\s*관람)?|\d{1,2}\s*개월\s*(?:이상|부터)|초등학생\s*이상|중학생\s*이상|고등학생\s*이상|미취학\s*아동\s*입장\s*불가|청소년\s*관람\s*불가)/);
    return loose ? loose[1].trim() : null;
}

/** 원문 조각 → 하한(개월). 못 읽으면 null */
export function parseMinMonths(text: string | null): number | null {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ");
    if (/청소년\s*관람\s*불가|19\s*세|미성년/.test(t)) return 19 * YEAR;
    if (/전체\s*관람|전\s*연령|누구나|제한\s*없음/.test(t)) return 0;
    const m = t.match(/(\d{1,2})\s*개월/);
    if (m) return +m[1];
    const y = t.match(/(?:만\s*)?(\d{1,2})\s*세/);
    if (y) return +y[1] * YEAR;
    if (/미취학/.test(t) && /불가/.test(t)) return 7 * YEAR;
    if (/초등/.test(t)) return 7 * YEAR;
    if (/중학/.test(t)) return 13 * YEAR;
    if (/고등/.test(t)) return 16 * YEAR;
    return null;
}

function hasTargetWord(title: string): boolean {
    const t = title.toLowerCase();
    if (KIDS_RULES.exceptWords.some(w => t.includes(w.toLowerCase()))) return false;
    return KIDS_RULES.targetWords.some(w => t.includes(w.toLowerCase()));
}

export function kidsInfo(e: { title?: string | null; description?: string | null; category?: string | null; kids_override?: KidsOverride }): KidsInfo {
    const ageText = findAgeText(e.description || "");
    const minMonths = parseMinMonths(ageText);
    const tooOld = minMonths !== null && minMonths > KIDS_RULES.schoolMaxMonths;

    let group: KidsGroup | null = null;
    if (e.kids_override === "none") group = null;
    else if (e.kids_override === "target" || e.kids_override === "ok") group = e.kids_override;
    else if (!tooOld && (hasTargetWord(e.title || "") || KIDS_RULES.targetCategories.includes(e.category || ""))) group = "target";
    else if (!tooOld && minMonths !== null) group = "ok";

    return { group, minMonths, ageText };
}

/** 나이 고르기에 맞나. 나이를 모르는 «아이 대상»은 어느 나이에도 넣는다(카드에 «나이 정보 없음») */
export function fitsAge(info: KidsInfo, age: KidsAge | null): boolean {
    if (!info.group) return false;
    if (!age || info.minMonths === null) return true;
    return info.minMonths <= (age === "young" ? KIDS_RULES.youngMaxMonths : KIDS_RULES.schoolMaxMonths);
}

/** 카드에 보일 짧은 나이 표시 */
export function ageLabel(minMonths: number | null): string {
    if (minMonths === null) return "나이 정보 없음";
    if (minMonths === 0) return "전체 관람";
    if (minMonths < 48) return `${minMonths}개월+`;
    return `만 ${Math.floor(minMonths / 12)}세+`;
}

/** 주소의 kids 값(any · young · school) → 나이 고르기 (없으면 꺼짐) */
export function readKidsParam(v: string | undefined | null): { on: boolean; age: KidsAge | null } {
    if (v === "young" || v === "school") return { on: true, age: v };
    if (v === "any") return { on: true, age: null };
    return { on: false, age: null };
}
