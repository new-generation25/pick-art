/**
 * 「인스타에서 본 행사」(/insta): 피카 인스타(@picka.news)에 소개한 행사를 소개한 날별로 묶는다.
 * 데이터는 events.insta_post_url · insta_posted_at (정기 수집의 sync_insta_posts.py 가 채운다).
 * 가져오는 모듈이 없어 node 테스트로 바로 돌릴 수 있다.
 */

export const INSTA_DAYS = 14; // 최근 몇 일 동안 소개한 행사를 보여 주나

export type InstaRow = {
    id: string;
    insta_posted_at: string | null;
    event_date_start: string | null;
    event_date_end: string | null;
    region: string | null;
};

export function addDaysISO(day: string, n: number): string {
    const d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** 소개한 날 최신순으로 묶는다. 같은 날 안에서는 끝나지 않은 행사 먼저, 그다음 빨리 열리는 순 */
export function groupByPostedDay<T extends InstaRow>(rows: T[], today: string): { day: string; items: T[] }[] {
    const ended = (r: T) => {
        const end = r.event_date_end || r.event_date_start;
        return !!end && end < today;
    };
    const byDay = new Map<string, T[]>();
    for (const r of rows) {
        const day = (r.insta_posted_at || "").slice(0, 10);
        if (!day) continue;
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(r);
    }
    return [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([day, items]) => ({
            day,
            items: items.sort((a, b) =>
                Number(ended(a)) - Number(ended(b))
                || (a.event_date_start || "9999").localeCompare(b.event_date_start || "9999")),
        }));
}

/** 'YYYY-MM-DD' → '11월 25일 (화)' */
export function dayLabel(day: string): string {
    const d = new Date(day + "T00:00:00Z");
    const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
}

/** 지역 칩: 목록에 있는 지역만, 행사 많은 순 */
export function regionCounts(rows: InstaRow[]): { region: string; n: number }[] {
    const m = new Map<string, number>();
    for (const r of rows) if (r.region) m.set(r.region, (m.get(r.region) || 0) + 1);
    return [...m].map(([region, n]) => ({ region, n })).sort((a, b) => b.n - a.n || a.region.localeCompare(b.region));
}
