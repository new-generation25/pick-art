/**
 * 홈의 기간 필터 값 (운영자 2026-11-27 «기간은 이번주를 기본값으로 보여줘»).
 * 주소에 기간(?date=)이 없으면 «이번 주». «전체»를 고르면 주소에 date=all 이 남아 기본값과 구분된다.
 * 찾기(?q=)와 묶음 «모두 보기»(?section=)는 기간을 따로 고르지 않았으면 전체 기간에서 본다
 * (찾는 말이 이번 주에만 걸리거나, «다음 주» 묶음이 비어 보이지 않게).
 * 돌려주는 값: "all" | "today" | "week" | "month" | "ending"
 */
export const DEFAULT_DATE = "week";

export function homeDate(date: string | null | undefined, q?: string | null, section?: string | null): string {
    if (date) return date;
    return q || section ? "all" : DEFAULT_DATE;
}
