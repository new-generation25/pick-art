/**
 * 피드 분야. 필터·설정의 관심 분야·가입 화면이 같은 목록을 쓴다.
 * hidden 분야는 코드(수집·분류)에는 있지만 화면에 노출하지 않는다: 필터 칩·관심 분야에 없고 공개 피드에서도 뺀다.
 */
export const ALL_CATEGORIES: { name: string; hidden?: boolean }[] = [
    { name: "공연" },
    { name: "전시" },
    { name: "축제" },
    { name: "체험·교육" },
    { name: "행사" },
    { name: "관광", hidden: true },
];

export const CATEGORIES = ALL_CATEGORIES.filter(c => !c.hidden).map(c => c.name);
export const HIDDEN_CATEGORIES = ALL_CATEGORIES.filter(c => c.hidden).map(c => c.name);
