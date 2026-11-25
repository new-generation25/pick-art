/**
 * 내 주변 지도(specs/005): 행사를 장소(좌표)별로 묶고, 축소했을 때 가까운 장소를 격자로 다시 묶는다.
 * 가져오는 모듈이 없어 node 테스트로 바로 돌린다.
 */

export type MapItem = {
    id: string;
    title: string;
    event_date_start: string;
    event_date_end: string;
    venue: string | null;
    region: string | null;
    coords: { lat: number; lng: number } | null;
    distanceM?: number;
};

export type VenueGroup<T extends MapItem> = {
    key: string;
    lat: number;
    lng: number;
    venue: string;
    items: T[];          // 날짜 순 (끝나는 날이 가까운 진행 중 → 시작일 순)
    distanceM: number | null;
};

/** 좌표가 같은 행사를 한 장소로. 좌표 없는 행사는 뺀다(추측 좌표 금지, 헌장 I) */
export function groupByVenue<T extends MapItem>(items: T[]): VenueGroup<T>[] {
    const map = new Map<string, VenueGroup<T>>();
    for (const it of items) {
        if (!it.coords) continue;
        const key = `${it.coords.lat.toFixed(5)},${it.coords.lng.toFixed(5)}`;
        const g = map.get(key) ?? { key, lat: it.coords.lat, lng: it.coords.lng, venue: it.venue || it.region || "", items: [], distanceM: null };
        g.items.push(it);
        if (typeof it.distanceM === "number") g.distanceM = g.distanceM === null ? it.distanceM : Math.min(g.distanceM, it.distanceM);
        map.set(key, g);
    }
    for (const g of map.values()) {
        g.items.sort((a, b) => (a.event_date_start || "").localeCompare(b.event_date_start || "") || (a.event_date_end || "").localeCompare(b.event_date_end || ""));
    }
    return [...map.values()];
}

export type Cluster<T extends MapItem> = { key: string; lat: number; lng: number; groups: VenueGroup<T>[]; count: number };

/**
 * 화면 셀(cellPx, 기본 56px) 크기의 격자로 장소를 묶는다. zoom 은 웹 메르카토르 확대 단계(네이버 지도 getZoom()).
 * 위도에 따라 셀 높이가 조금 달라지지만 부산·경남 범위에서는 표시용으로 충분하다.
 */
export function clusterGroups<T extends MapItem>(groups: VenueGroup<T>[], zoom: number, cellPx = 56): Cluster<T>[] {
    const deg = (360 / Math.pow(2, zoom)) * (cellPx / 256);
    const cells = new Map<string, Cluster<T>>();
    for (const g of groups) {
        const key = `${Math.floor(g.lat / deg)}:${Math.floor(g.lng / deg)}`;
        const c = cells.get(key) ?? { key, lat: 0, lng: 0, groups: [], count: 0 };
        c.groups.push(g);
        c.count += g.items.length;
        cells.set(key, c);
    }
    for (const c of cells.values()) {
        c.lat = c.groups.reduce((s, g) => s + g.lat, 0) / c.groups.length;
        c.lng = c.groups.reduce((s, g) => s + g.lng, 0) / c.groups.length;
    }
    return [...cells.values()];
}

/** 거리 조건 → 처음 확대 단계 */
export function zoomForRange(range: string): number {
    return range === "3" ? 14 : range === "10" ? 12 : range === "30" ? 10 : 9;
}

/** 표시에 쓰는 개수 글자 */
export function countLabel(n: number): string {
    return n > 20 ? "20+" : String(n);
}
