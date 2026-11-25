/** 경남 18개 시군 + 부산(2026-11-16 추가). 필터·설정·자동 지역 적용이 같은 목록을 쓴다 */
export const GN_REGIONS = [
    "창원", "김해", "진주", "통영", "거제", "양산", "밀양", "사천", "함안",
    "고성", "합천", "거창", "함양", "창녕", "의령", "남해", "하동", "산청",
    "부산",
];

/** 지역 고정 주소(검색 노출용, 2026-11-26). 목록에 있는 지역이면 /region/김해, 아니면 홈 */
export function regionPath(region?: string | null): string {
    return region && GN_REGIONS.includes(region) ? `/region/${encodeURIComponent(region)}` : "/";
}

/** 주소의 /region/<이름> 에서 지역. 목록에 없으면 null */
export function regionFromPath(pathname: string | null | undefined): string | null {
    const m = (pathname || "").match(/^\/region\/([^/?#]+)/);
    if (!m) return null;
    let name = m[1];
    try { name = decodeURIComponent(name); } catch { /* 이미 풀린 글자 */ }
    return GN_REGIONS.includes(name) ? name : null;
}
