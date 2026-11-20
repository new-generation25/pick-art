/**
 * 내 주변 행사 (specs/002-nearby-events): 직선거리·정렬·필터. 순수 함수만 둔다.
 * 방문자 위치는 이 함수들의 인자로만 쓰이고 어디에도 저장·전송하지 않는다.
 * 테스트: frontend/src/lib/__tests__/nearby.test.mjs (node --experimental-strip-types --test)
 */

export type LatLng = { lat: number; lng: number };

export type NearbyEvent = {
  id: string;
  title: string;
  category?: string | null;
  region?: string | null;
  venue?: string | null;
  event_date_start: string; // YYYY-MM-DD
  event_date_end: string; // YYYY-MM-DD
  coords?: LatLng | null; // 확인된 장소 좌표(없으면 「거리 확인 안 됨」)
};

export type WithDistance<T> = T & { distanceM: number };

export type Period = "today" | "weekend" | "week" | "2w";

/** 하버사인 직선거리(m) */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 850m · 1.2km · 23km. approx=true 면 앞에 「약 」 */
export function formatDistance(m: number, approx = false): string {
  let s: string;
  if (m < 1000) s = `${Math.max(10, Math.round(m / 10) * 10)}m`;
  else if (m < 10000) s = `${(Math.round(m / 100) / 10).toFixed(1)}km`;
  else s = `${Math.round(m / 1000)}km`;
  return approx ? `약 ${s}` : s;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 기간 → [시작, 끝] (오늘 기준, 한국 날짜 문자열). 주말 = 다가오는(오늘이 주말이면 이번) 토·일 */
export function periodRange(period: Period, today: string): [string, string] {
  if (period === "today") return [today, today];
  if (period === "week") return [today, addDays(today, 6)];
  if (period === "2w") return [today, addDays(today, 13)];
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일 … 6=토
  if (dow === 0) return [today, today];
  const sat = addDays(today, 6 - dow);
  return [dow === 6 ? today : sat, addDays(sat, 1)];
}

/** 기간 [from, to] 안에 하루라도 열리는 행사 */
export function overlaps(e: Pick<NearbyEvent, "event_date_start" | "event_date_end">, from: string, to: string): boolean {
  return e.event_date_end >= from && e.event_date_start <= to;
}

export type NearbyFilter = {
  origin: LatLng;
  today: string;
  period: Period;
  maxKm?: number | null; // null·undefined = 제한 없음
  category?: string | null;
};

export type NearbyResult<T extends NearbyEvent> = {
  near: WithDistance<T>[]; // 좌표 있음, 거리순
  unknown: T[]; // 좌표 없음(장소 이름은 있음), 날짜순
};

/** 정렬 키: 아직 시작 전이면 시작일, 진행 중이면 종료일(곧 끝나는 것이 앞) */
function dateKey(e: NearbyEvent, today: string): string {
  return e.event_date_start > today ? e.event_date_start : e.event_date_end;
}

export function buildNearby<T extends NearbyEvent>(events: T[], f: NearbyFilter): NearbyResult<T> {
  const [from, to] = periodRange(f.period, f.today);
  const inScope = events.filter(
    (e) => !!(e.venue && e.venue.trim()) && overlaps(e, from, to) && (!f.category || e.category === f.category),
  );
  const near: WithDistance<T>[] = [];
  const unknown: T[] = [];
  for (const e of inScope) {
    if (e.coords) near.push({ ...e, distanceM: distanceM(f.origin, e.coords) });
    else unknown.push(e);
  }
  const maxM = f.maxKm ? f.maxKm * 1000 : Infinity;
  const nearFiltered = near
    .filter((e) => e.distanceM <= maxM)
    .sort((a, b) => {
      // 같은 100m 구간(0~99m, 100~199m …)이면 날짜 순
      const da = Math.floor(a.distanceM / 100), db = Math.floor(b.distanceM / 100);
      if (da !== db) return da - db;
      return dateKey(a, f.today).localeCompare(dateKey(b, f.today));
    });
  unknown.sort((a, b) => dateKey(a, f.today).localeCompare(dateKey(b, f.today)));
  return { near: nearFiltered, unknown: f.maxKm ? [] : unknown };
}
