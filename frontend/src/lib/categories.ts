/**
 * 피드 분야(대분류)와 세부 갈래 (specs/015, 사용자 결정 2026-11-26 docs/plan/genre_taxonomy_2026-11-26.md).
 * 필터·설정의 관심 분야·가입 화면이 같은 목록을 쓴다.
 * hidden 분야는 코드(수집·분류)에는 있지만 화면에 노출하지 않는다: 필터 칩·관심 분야에 없고 공개 피드에서도 뺀다.
 */
export const ALL_CATEGORIES: { name: string; hidden?: boolean }[] = [
    { name: "공연" },
    { name: "전시" },
    { name: "축제" },
    { name: "체험" },
    { name: "행사" },
    { name: "관광", hidden: true },
];

export const CATEGORIES = ALL_CATEGORIES.filter(c => !c.hidden).map(c => c.name);
export const HIDDEN_CATEGORIES = ALL_CATEGORIES.filter(c => c.hidden).map(c => c.name);

/** 대분류별 세부 갈래 (DB CHECK events_subcategory_valid 와 같은 목록) */
export const SUBCATEGORIES: Record<string, string[]> = {
    공연: ["연극", "뮤지컬", "클래식·오페라", "국악·전통연희", "대중음악", "무용", "서커스·마술", "복합·기타"],
    전시: ["회화·드로잉", "사진", "조각·설치", "미디어", "공예", "디자인·건축", "서예", "역사·박물관", "여러 갈래", "기타"],
    축제: ["문화예술축제", "지역축제"],
    행사: ["강연·북토크", "상영회", "마켓", "기타"],
    체험: ["체험·워크숍", "교육·강좌"],
};

/** 예전 분야 이름 → 지금 이름 (체험·교육 → 체험). 예전 주소·관심 분야 설정을 읽을 때 쓴다 */
const ALIAS: Record<string, string> = { "체험·교육": "체험" };
export function normalizeCategory(c: string): string;
export function normalizeCategory(c: string | null | undefined): string | null | undefined;
export function normalizeCategory(c: string | null | undefined) {
    return c ? ALIAS[c] ?? c : c;
}

/** 꼬리표 글자: «공연 · 뮤지컬», 세부가 없으면 «공연» */
export function categoryLabel(category: string, sub?: string | null): string {
    return sub ? `${category} · ${sub}` : category;
}
