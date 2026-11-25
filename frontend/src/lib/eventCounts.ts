/** 행사별 조회·클릭 합계 (specs/011). event_counts_daily 줄 → 행사별 줄. 순수 함수 */
export type CountRow = { event_id: string; day: string; kind: "view" | "outbound" | "calendar" | "share"; n: number };
export type EventTotal = { event_id: string; view: number; outbound: number; calendar: number; share: number; clicks: number };

/** 「2026-11」 → 그달 첫날·마지막 날 (YYYY-MM-DD) */
export function monthRange(month: string): { from: string; to: string } {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, "0");
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** 행사별로 더한다. 클릭 = 원본 열기 + 캘린더 + 공유. 노출(상세 조회) 많은 순 */
export function totalsByEvent(rows: CountRow[]): EventTotal[] {
    const by = new Map<string, EventTotal>();
    for (const r of rows) {
        const t = by.get(r.event_id) ?? { event_id: r.event_id, view: 0, outbound: 0, calendar: 0, share: 0, clicks: 0 };
        t[r.kind] += r.n;
        if (r.kind !== "view") t.clicks += r.n;
        by.set(r.event_id, t);
    }
    return [...by.values()].sort((a, b) => b.view - a.view || b.clicks - a.clicks);
}

/** 표 → CSV(엑셀에서 한글이 깨지지 않게 BOM). 칸 안의 따옴표·쉼표는 감싼다 */
export function toCsv(header: string[], rows: (string | number)[][]): string {
    const cell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "﻿" + [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
}
