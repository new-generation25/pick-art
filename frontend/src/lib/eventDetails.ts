/**
 * 행사 상세 보강(specs/006): 설명의 「라벨: 값」 줄을 정보 표 칸으로, 「곧 끝남」 판정.
 * 가져오는 모듈이 없어 node 테스트로 바로 돌린다.
 */

/** 정보 표에 칸으로 옮기는 줄 머리 → 칸 이름 */
export const DETAIL_LABELS: Record<string, string> = {
    "일시": "공연 시각",
    "러닝타임": "러닝타임",
    "출연": "출연",
    "장르": "장르",
};
/** 이미 다른 칸(관람료·관람 연령)에 보이므로 상세 안내에서만 빼는 줄 머리 */
const ALREADY_SHOWN = ["관람료", "관람연령", "관람 연령"];

export type DetailRow = { label: string; value: string };

/** 설명에서 칸으로 옮길 줄과, 칸으로 옮긴 줄을 뺀 나머지 글 */
export function splitDescription(desc: string | null | undefined): { rows: DetailRow[]; rest: string } {
    const rows: DetailRow[] = [];
    const rest: string[] = [];
    for (const line of (desc || "").split("\n")) {
        const m = line.match(/^\s*([가-힣 ]{2,6})\s*[:：]\s*(.+?)\s*$/);
        const key = m?.[1].trim();
        if (m && key && DETAIL_LABELS[key] && !rows.some(r => r.label === DETAIL_LABELS[key])) {
            rows.push({ label: DETAIL_LABELS[key], value: m[2] });
        } else if (!(m && key && ALREADY_SHOWN.includes(key))) {
            rest.push(line);
        }
    }
    return { rows, rest: rest.join("\n").trim() };
}

const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

export const ENDING_SOON = { minDays: 7, withinDays: 7 };

/** 곧 끝남: 기간 7일 이상 + 끝나는 날이 오늘~7일 뒤 */
export function isEndingSoon(e: { event_date_start?: string | null; event_date_end?: string | null }, today: string): boolean {
    const end = e.event_date_end;
    const start = e.event_date_start || end;
    if (!end || !start) return false;
    const left = day(end) - day(today);
    return day(end) - day(start) + 1 >= ENDING_SOON.minDays && left >= 0 && left <= ENDING_SOON.withinDays;
}
