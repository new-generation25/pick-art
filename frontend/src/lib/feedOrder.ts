/**
 * 공개 피드의 노출 순서.
 *
 * 1) 날짜로 묶는다: 오늘 / 이번 주(내일~7일) / 다음 주(8~14일) / 그 이후 / 상시·장기(32일 이상) / 최근 끝난 행사
 * 2) 묶음 안에서는 날짜 규칙으로 정렬한다
 *    - 오늘: 끝나는 날이 가까운 순(오늘 마지막인 행사가 맨 앞)
 *    - 예정 묶음: 시작일 순
 *    - 상시·장기: 끝나는 날이 가까운 순
 *    - 끝난 행사: 최근에 끝난 순
 * 3) 날짜가 같으면 포스터가 있는 행사를 앞에 둔다
 * 4) 같은 출처가 3건 넘게 연달아 나오지 않게 섞는다
 */

export interface FeedRow {
    id: string;
    event_date_start: string | null;
    event_date_end: string | null;
    poster_image_url?: string | null;
    source?: string | null;
    venue?: string | null;
}

export type SectionKey = "today" | "week" | "next" | "later" | "long" | "ended";

export const SECTION_LABELS: Record<SectionKey, { title: string; note: string }> = {
    today: { title: "오늘", note: "오늘 볼 수 있는 행사. 오늘이 마지막인 것부터" },
    week: { title: "이번 주", note: "내일부터 7일 안에 시작" },
    next: { title: "다음 주", note: "8~14일 뒤에 시작" },
    later: { title: "그 이후", note: "보름 뒤부터 시작" },
    long: { title: "상시·장기", note: "한 달 넘게 하는 전시·행사. 곧 끝나는 것부터" },
    ended: { title: "최근 끝난 행사", note: "종료 1개월 이내" },
};

const ORDER: SectionKey[] = ["today", "week", "next", "later", "long", "ended"];
const LONG_DAYS = 32;
const MAX_RUN = 3;

const toDay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

export function addDays(day: string, n: number): string {
    return new Date((toDay(day) + n) * 86400000).toISOString().slice(0, 10);
}

function sectionOf(e: FeedRow, today: string): SectionKey {
    const start = e.event_date_start || e.event_date_end || today;
    const end = e.event_date_end || start;
    if (end < today) return "ended";
    if (toDay(end) - toDay(start) + 1 >= LONG_DAYS) return "long";
    if (start <= today) return "today";
    if (start <= addDays(today, 7)) return "week";
    if (start <= addDays(today, 14)) return "next";
    return "later";
}

function dateKey(e: FeedRow, key: SectionKey): string {
    const start = e.event_date_start || "";
    const end = e.event_date_end || start;
    if (key === "today" || key === "long") return `${end}|${start}`;
    if (key === "ended") return `${9999 - +end.slice(0, 4)}${end.slice(4)}`; // 최근에 끝난 순
    return `${start}|${end}`;
}

/** 같은 출처가 MAX_RUN 건 넘게 이어지면 뒤에서 다른 출처를 당겨 온다 (순서는 최대한 유지) */
function diversify<T extends FeedRow>(rows: T[]): T[] {
    const pool = [...rows];
    const out: T[] = [];
    const group = (r: T) => r.source || r.venue || "";
    while (pool.length) {
        const tail = out.slice(-MAX_RUN);
        const blocked = tail.length === MAX_RUN && tail.every(r => group(r) === group(tail[0])) ? group(tail[0]) : null;
        const i = blocked === null ? 0 : pool.findIndex(r => group(r) !== blocked);
        out.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
    }
    return out;
}

export function orderFeed<T extends FeedRow>(rows: T[], today: string): { key: SectionKey; items: T[] }[] {
    const buckets = new Map<SectionKey, T[]>(ORDER.map(k => [k, []]));
    rows.forEach(r => buckets.get(sectionOf(r, today))!.push(r));
    return ORDER.map(key => {
        const items = buckets.get(key)!.slice().sort((a, b) => {
            const d = dateKey(a, key).localeCompare(dateKey(b, key));
            if (d) return d;
            return Number(!a.poster_image_url) - Number(!b.poster_image_url);
        });
        return { key, items: diversify(items) };
    }).filter(s => s.items.length > 0);
}
