/**
 * 오류 신고·행사 제보 (specs/007). 표: public.reports (supabase/migrations/20261126020000_reports.sql)
 * 로그인 회원만 보낸다. 관리자가 확인한 뒤에만 공개 피드에 반영한다(헌장 I).
 */

export const ERROR_CATEGORIES = ["날짜·시간", "장소", "관람료", "링크", "취소·변경", "포스터", "기타"] as const;

export type TipInput = {
    title: string;
    date_start: string;
    date_end: string;
    venue: string;
    region: string;
    url: string;
    body: string;
};

/** 제보 입력 검사. 문제가 없으면 빈 배열 */
export function checkTip(t: TipInput): string[] {
    const errs: string[] = [];
    if (t.title.trim().length < 2) errs.push("행사 이름을 적어 주세요.");
    if (!/^20\d\d-\d\d-\d\d$/.test(t.date_start)) errs.push("시작 날짜를 골라 주세요.");
    if (t.date_end && t.date_end < t.date_start) errs.push("끝나는 날짜가 시작보다 앞입니다.");
    if (t.venue.trim().length < 2) errs.push("장소를 적어 주세요.");
    if (!/^https?:\/\/\S+\.\S+/.test(t.url.trim())) errs.push("공식 안내 주소(http로 시작)를 넣어 주세요. 확인한 정보만 올리기 위해 필요합니다.");
    return errs;
}

/** 로그인 화면으로 보낸 뒤 이 자리로 돌아오는 주소 */
export function loginHref(path: string): string {
    return `/login?next=${encodeURIComponent(path)}`;
}
