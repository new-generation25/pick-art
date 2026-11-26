/** 경남 18개 시군 + 부산(2026-11-16 추가). 필터·설정·자동 지역 적용이 같은 목록을 쓴다 */
export const GN_REGIONS = [
    "창원", "김해", "진주", "통영", "거제", "양산", "밀양", "사천", "함안",
    "고성", "합천", "거창", "함양", "창녕", "의령", "남해", "하동", "산청",
    "부산",
];

/**
 * 지역 고정 주소(검색 노출용, specs/010). 주소는 국어의 로마자 표기법 소문자(운영자 11/26 「지역명을 영어로해」),
 * 화면 글자는 한글 그대로. /region/gimhae, 부산 구·군은 /region/busan/haeundae
 */
export const REGION_SLUGS: Record<string, string> = {
    "창원": "changwon", "김해": "gimhae", "진주": "jinju", "통영": "tongyeong", "거제": "geoje",
    "양산": "yangsan", "밀양": "miryang", "사천": "sacheon", "함안": "haman", "고성": "goseong",
    "합천": "hapcheon", "거창": "geochang", "함양": "hamyang", "창녕": "changnyeong", "의령": "uiryeong",
    "남해": "namhae", "하동": "hadong", "산청": "sancheong", "부산": "busan",
};

/** 부산 16개 구·군(venues.district 값)과 주소 */
export const BUSAN_DISTRICTS: { name: string; slug: string }[] = [
    { name: "중구", slug: "jung" }, { name: "서구", slug: "seo" }, { name: "동구", slug: "dong" },
    { name: "영도구", slug: "yeongdo" }, { name: "부산진구", slug: "busanjin" }, { name: "동래구", slug: "dongnae" },
    { name: "남구", slug: "nam" }, { name: "북구", slug: "buk" }, { name: "해운대구", slug: "haeundae" },
    { name: "사하구", slug: "saha" }, { name: "금정구", slug: "geumjeong" }, { name: "강서구", slug: "gangseo" },
    { name: "연제구", slug: "yeonje" }, { name: "수영구", slug: "suyeong" }, { name: "사상구", slug: "sasang" },
    { name: "기장군", slug: "gijang" },
];

/** 시·군 이름 없이 구·옛 시 이름만 인쇄된 경우(«영도구», «마산») 그 지역. 다른 도시에도 있는 구 이름(중구·서구·동구·남구·북구·강서구)은
 *  어느 도시인지 알 수 없어 넣지 않는다. 카카오 제보 읽기 검증(11/27)에서 «영도구»만 인쇄된 포스터가 지역을 못 채운 것을 보고 더함 */
const DISTRICT_REGION: Record<string, string> = {
    ...Object.fromEntries(BUSAN_DISTRICTS.filter(d => !["중구", "서구", "동구", "남구", "북구", "강서구"].includes(d.name)).map(d => [d.name, "부산"])),
    "해운대": "부산", "기장": "부산",
    "성산구": "창원", "의창구": "창원", "마산합포구": "창원", "마산회원구": "창원", "진해구": "창원", "마산": "창원", "진해": "창원",
};

/** 인쇄된 지역 글자(«김해시 동상동», «부산광역시 중구», «영도구») → 지역 이름. 못 찾으면 null */
export function regionFromText(text?: string | null): string | null {
    const t = (text || "").replace(/\s+/g, "");
    if (!t) return null;
    const direct = GN_REGIONS.find(r => t.includes(r));
    if (direct) return direct;
    const key = Object.keys(DISTRICT_REGION).sort((a, b) => b.length - a.length).find(k => t.includes(k));
    return key ? DISTRICT_REGION[key] : null;
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** 주소 조각(로마자 또는 한글) → 지역 이름. 목록에 없으면 null */
export function regionFromSlug(raw: string): string | null {
    const s = safeDecode(raw);
    if (GN_REGIONS.includes(s)) return s;
    return Object.keys(REGION_SLUGS).find(k => REGION_SLUGS[k] === s.toLowerCase()) ?? null;
}

/** 주소 조각(로마자 또는 한글, 「해운대」도 받음) → 부산 구·군 이름 */
export function districtFromSlug(raw: string): string | null {
    const s = safeDecode(raw);
    const d = BUSAN_DISTRICTS.find(x => x.slug === s.toLowerCase() || x.name === s || x.name === `${s}구` || x.name === `${s}군`);
    return d?.name ?? null;
}

/** 지역(·부산 구·군) 고정 주소. 목록에 없으면 홈 */
export function regionPath(region?: string | null, district?: string | null): string {
    if (!region || !REGION_SLUGS[region]) return "/";
    const d = region === "부산" && district ? BUSAN_DISTRICTS.find(x => x.name === district) : undefined;
    return `/region/${REGION_SLUGS[region]}${d ? `/${d.slug}` : ""}`;
}

/** 주소 /region/<지역>[/<구>] 에서 지역과 구. 지역 주소가 아니면 region null */
export function regionFromPath(pathname: string | null | undefined): { region: string | null; district: string | null } {
    const m = (pathname || "").match(/^\/region\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (!m) return { region: null, district: null };
    const region = regionFromSlug(m[1]);
    const district = region === "부산" && m[2] ? districtFromSlug(m[2]) : null;
    return { region, district };
}

/** 주소의 여러 값(«김해,양산»)을 목록으로. 빈 값·공백은 뺀다 (필터 창 여러 개 고르기, 2026-11-26) */
export function splitList(v?: string | null): string[] {
    return [...new Set((v || "").split(",").map(x => x.trim()).filter(Boolean))];
}

/** 주소의 region 값 → 알려진 지역만 (「전체」는 빠진다) */
export function regionList(v?: string | null): string[] {
    return splitList(v).filter(r => GN_REGIONS.includes(r));
}

/** 주소의 gu 값 → 부산 구·군 이름만 */
export function guList(v?: string | null): string[] {
    return splitList(v).filter(g => BUSAN_DISTRICTS.some(d => d.name === g));
}
