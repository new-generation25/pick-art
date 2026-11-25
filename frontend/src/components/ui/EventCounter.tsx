"use client";

import { useEffect } from "react";
import { countEvent, countViewOnce, type CountKind } from "@/lib/countEvent";

/** 상세 화면에 두면 조회 1회를 센다 (specs/011). 화면에는 아무것도 그리지 않는다 */
export function EventViewCounter({ eventId }: { eventId: string }) {
    useEffect(() => { countViewOnce(eventId); }, [eventId]);
    return null;
}

/** 누르면 종류별로 세는 링크 (원본 안내 페이지 열기·캘린더 추가) */
export function CountedLink({ eventId, kind, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { eventId: string; kind: CountKind }) {
    return <a {...props} onClick={(e) => { countEvent(eventId, kind); props.onClick?.(e); }} />;
}
