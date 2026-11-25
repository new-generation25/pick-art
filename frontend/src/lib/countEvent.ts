import { supabase } from "@/lib/supabase";

/**
 * 행사별 조회·클릭 집계 (specs/011). 날짜별 숫자 하나만 올린다 — 사람·기기·IP·쿠키는 남기지 않는다.
 * 서버 함수 count_event 가 공개 행사만, 관리자 접속은 빼고 센다.
 */
export type CountKind = "view" | "outbound" | "calendar" | "share";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|headless|lighthouse/i;

export function countEvent(eventId: string, kind: CountKind) {
    if (typeof navigator === "undefined" || navigator.webdriver || BOT.test(navigator.userAgent)) return;
    // 기다리지 않는다: 숫자 하나가 빠져도 화면에는 영향이 없다
    void supabase.rpc("count_event", { p_event: eventId, p_kind: kind }).then(() => undefined, () => undefined);
}

/** 상세 조회는 같은 창에서 새로 고침할 때마다 늘지 않게 한 번만 (창을 닫으면 사라지는 sessionStorage, 서버로 보내지 않음) */
export function countViewOnce(eventId: string) {
    try {
        const key = `pica-viewed-${eventId}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
    } catch { /* 저장소를 못 쓰면 그냥 센다 */ }
    countEvent(eventId, "view");
}
