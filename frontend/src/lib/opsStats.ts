/**
 * 관리자 운영 대시보드(/admin)의 계산. 화면과 떼어 두어 테스트할 수 있게 한다(가져오는 모듈 없음).
 * 날짜는 모두 'YYYY-MM-DD' 글자(KST)로 비교한다. events 의 날짜 칸이 TEXT 이기 때문이다.
 */

export type OpsEvent = {
    event_date_start: string | null;
    event_date_end: string | null;
    region: string | null;
    category: string | null;
    poster_image_url: string | null;
    source: string | null;
    created_at: string | null;
};

export type SourceKind = "KOPIS" | "기관 공식" | "인스타그램" | "큐레이션";
export const SOURCE_KINDS: SourceKind[] = ["KOPIS", "기관 공식", "인스타그램", "큐레이션"];

/** events.source 를 네 갈래로 묶는다. '웹검색'은 큐레이션(공식 페이지를 사람이 확인해 넣은 것)이다 */
export function sourceKind(source: string | null): SourceKind {
    if (source === "KOPIS") return "KOPIS";
    if (source === "인스타그램") return "인스타그램";
    if (source === "웹검색") return "큐레이션";
    return "기관 공식";
}

export function addDaysISO(day: string, n: number): string {
    const d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** created_at(UTC ISO) → KST 날짜 */
export function kstDay(iso: string): string {
    return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 끝나는 날(없으면 시작일)이 오늘 이후면 활성. insta_report.py 의 「활성 행사 수」와 같은 정의 */
export function isActive(e: OpsEvent, today: string): boolean {
    const end = e.event_date_end || e.event_date_start;
    return !!end && end >= today;
}

/** 오늘부터 n일 안에 볼 수 있는 행사(진행 중 포함) */
export function openWithin(e: OpsEvent, today: string, n: number): boolean {
    const start = e.event_date_start || e.event_date_end;
    return isActive(e, today) && !!start && start <= addDaysISO(today, n);
}

export type Supply = {
    active: number;
    within7: number;
    within30: number;
    within60: number;
    noPoster: number;
    byRegion: { label: string; n: number }[];
    emptyRegions: string[];
    byCategory: { label: string; n: number }[];
};

export function computeSupply(events: OpsEvent[], today: string, regions: string[]): Supply {
    const act = events.filter(e => isActive(e, today));
    const count = (key: (e: OpsEvent) => string) => {
        const m = new Map<string, number>();
        for (const e of act) m.set(key(e), (m.get(key(e)) || 0) + 1);
        return m;
    };
    const reg = count(e => e.region || "(지역 없음)");
    const cat = count(e => e.category || "(분야 없음)");
    const byRegion = [...regions.map(r => ({ label: r, n: reg.get(r) || 0 })),
        ...[...reg].filter(([k]) => !regions.includes(k)).map(([label, n]) => ({ label, n }))]
        .sort((a, b) => b.n - a.n);
    return {
        active: act.length,
        within7: events.filter(e => openWithin(e, today, 7)).length,
        within30: events.filter(e => openWithin(e, today, 30)).length,
        within60: events.filter(e => openWithin(e, today, 60)).length,
        noPoster: act.filter(e => !e.poster_image_url).length,
        byRegion,
        emptyRegions: regions.filter(r => !reg.get(r)),
        byCategory: [...cat].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    };
}

export type DayKinds = { day: string } & Record<SourceKind, number>;

/** 최근 n일(오늘 포함) 날짜별·출처 종류별로 새로 들어온(created_at) 행사 수. 오래된 날이 앞 */
export function newByDay(events: OpsEvent[], today: string, n: number): DayKinds[] {
    const days: DayKinds[] = [];
    for (let i = n - 1; i >= 0; i--) {
        days.push({ day: addDaysISO(today, -i), KOPIS: 0, "기관 공식": 0, 인스타그램: 0, 큐레이션: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.day, i]));
    for (const e of events) {
        if (!e.created_at) continue;
        const i = idx.get(kstDay(e.created_at));
        if (i !== undefined) days[i][sourceKind(e.source)] += 1;
    }
    return days;
}

/** 출처 종류별로 마지막에 새 행사가 들어온 KST 날짜(없으면 null) */
export function lastNewByKind(events: OpsEvent[]): Record<SourceKind, string | null> {
    const out: Record<SourceKind, string | null> = { KOPIS: null, "기관 공식": null, 인스타그램: null, 큐레이션: null };
    for (const e of events) {
        if (!e.created_at) continue;
        const k = sourceKind(e.source);
        const d = kstDay(e.created_at);
        if (!out[k] || d > out[k]!) out[k] = d;
    }
    return out;
}

/** 두 KST 날짜 사이의 날 수(b - a) */
export function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export type Alert = { level: "bad" | "warn" | "info"; text: string; href?: string };

/** 자동으로 「이상」을 판정하는 규칙. 기준을 바꾸려면 여기만 고친다 */
export const ALERT_RULES = {
    kopisQuietDays: 2,        // KOPIS 는 정기 실행마다 새 공연이 들어오는 편이다. 이틀 넘게 0건이면 수집 이상을 의심
    officialQuietDays: 3,     // 기관 게시판 28곳 합쳐 사흘 넘게 0건이면 의심
    snapshotStaleHours: 30,   // 인스타 숫자는 정기 실행(하루 2번)마다 올라온다
    rawQuietHours: 24,        // 마지막 새 수집분이 이보다 오래되면 정기 실행을 의심
};
