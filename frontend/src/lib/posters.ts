/**
 * 포스터 자리에 무엇을 그릴지 (specs/014).
 * - 포스터 주소가 없거나, 운영자가 «안내 그림»으로 표시한 그림(events.poster_placeholder)이면 글자 포스터를 그린다.
 * - 글자 포스터에는 DB 의 날짜·제목·출처만 넣는다. 지어낸 문구는 넣지 않는다(헌장 I).
 * 가져오는 모듈 없이 node 테스트로 바로 돌린다.
 */

export type PosterInput = {
    poster_image_url?: string | null;
    poster_placeholder?: boolean | null;
};

/** 글자 포스터를 그려야 하는가 */
export function needsTextPoster(e: PosterInput): boolean {
    const url = (e.poster_image_url || "").trim();
    return !url || !!e.poster_placeholder;
}

/** 글자 포스터·선반 칸의 짧은 날짜: «11.28», «11.27–28», «11.30–12.06», 날짜가 없으면 «일정 미정» */
export function shortPeriod(start?: string | null, end?: string | null): string {
    const md = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
    const s = start || end;
    const e = end || start;
    if (!s || !e) return "일정 미정";
    if (s === e) return md(s);
    if (s.slice(0, 7) === e.slice(0, 7)) return `${md(s)}–${e.slice(8, 10)}`;
    if (s.slice(0, 4) !== e.slice(0, 4)) return `${md(s)}–${e.slice(0, 4)}.${md(e)}`;
    return `${md(s)}–${md(e)}`;
}

/** 글자 포스터의 «정보: …» 에 쓸 이름. 장소 → 출처(웹검색·KOPIS 같은 모음 출처는 쓰지 않음) 순서 */
const AGGREGATORS = new Set(["KOPIS", "웹검색", "인스타그램", "행사일정"]);
export function posterSourceName(e: { venue?: string | null; source?: string | null }): string | null {
    const venue = (e.venue || "").trim();
    if (venue) return venue;
    const src = (e.source || "").trim();
    if (!src || AGGREGATORS.has(src)) return null;
    // «단체 제공 · 단체 이름» 은 그대로 둔다
    return src;
}
