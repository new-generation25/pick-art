// 이미 공개된 행사와 같은 행사인지 보는 제목 규칙 — collector/dedupe.py 의 loose·similar·words 를 그대로 옮겼다.
// 공개 단계(collector/tools/publish_verified.py)와 같은 기준이어야 하므로, 한쪽을 고치면 다른 쪽도 고친다.
// 바깥 모듈을 읽지 않는다(node --test 로 바로 돌린다: src/lib/__tests__/dupRules.test.mjs).

const REGION_WORDS = new Set([
    "경남", "부산", "창원", "마산", "진해", "진주", "통영", "사천", "김해", "밀양", "거제", "양산", "의령", "함안", "창녕",
    "고성", "남해", "하동", "산청", "함양", "거창", "합천", "중구", "서구", "동구", "영도", "영도구", "부산진", "부산진구",
    "동래", "동래구", "남구", "북구", "해운대", "해운대구", "사하", "사하구", "금정", "금정구", "강서", "강서구", "연제",
    "연제구", "수영", "수영구", "사상", "사상구", "기장", "기장군", "서울", "대구", "울산", "광주", "대전", "인천", "세종",
]);

function norm(title: string): string {
    let t = (title || "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").toLowerCase();
    t = t.replace(/[×⨉✕]/g, "x").replace(/(?<=\s)x(?=\s)/g, " ");
    return t.replace(/[^0-9a-z가-힣]/g, "");
}

function stripRegionBrackets(title: string): string {
    return (title || "").replace(/\[([^\]]*)\]/g, (_, inner: string) => (REGION_WORDS.has(inner.trim().replace(/ /g, "")) ? " " : ` ${inner} `));
}

export function loose(title: string): string {
    let t = stripRegionBrackets(title).trim();
    t = t.replace(/^(연극|뮤지컬|오페라)\s*/, "");
    t = t.replace(/(?<!\d)20\d\d(?!\d)/g, "").replace(/×/g, "x");
    const out = norm(t);
    return out || (title || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

export function similar(a: string, b: string): boolean {
    if (!a || !b) return false;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short === long || (short.length >= 3 && long.includes(short));
}

function words(title: string): string {
    let t = stripRegionBrackets(title).replace(/\([^)]*\)/g, " ").toLowerCase();
    t = t.replace(/(?<!\d)20\d\d(?!\d)/g, " ");
    return [...new Set(t.split(/\s+/).map(w => w.replace(/[^0-9a-z가-힣]/g, "")).filter(Boolean))].sort().join(" ");
}

export function sameEvent(a: string, b: string): boolean {
    if (similar(loose(a), loose(b))) return true;
    const wa = words(a), wb = words(b);
    return !!wa && wa.split(" ").length >= 2 && wa === wb;
}
