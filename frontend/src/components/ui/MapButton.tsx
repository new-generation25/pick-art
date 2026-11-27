"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Map as MapIcon, PencilLine } from "lucide-react";
import type { SheetEvent } from "./MapSheet";

// 지도 시트는 누를 때만 내려받는다 (홈 첫 화면에 지도 코드·지도 요청 0건, specs/014 SC-002)
const MapSheet = dynamic(() => import("./MapSheet"), { ssr: false });

/**
 * 홈 아래 가운데에 떠 있는 알약 (시안 f01, 운영자: 목록 맨 아래 지도 칸·늘 떠 있는 지도는 넣지 않음).
 * «지도» 옆에 «제보하기»(운영자 2026-11-27 «지도 옆에 제보하기 버튼 만들어. 피카에서 어디로 제보를 보내는거야 이게 있어야지»).
 * 제보하기는 /tip 으로 간다(로그인 안 했으면 그 화면이 로그인을 안내). 지도 시트가 열리면 둘 다 숨는다(시트의 «목록» 알약만).
 * hideFromId: 그 칸(홈의 «새 소식 받아 보기»)이 화면에 들어온 뒤로는 알약을 숨긴다 — 아래쪽 칩·제보 띠·꼬리말과 겹치고
 * 초록끼리 섞여 보였다(운영자 2026-11-28 «컬러 상으로도 많이 겹치고»). 목록으로 다시 올라오면 보인다.
 */
export function MapButton({ events, summary, showTip = false, hideFromId }: { events: SheetEvent[]; summary: string; showTip?: boolean; hideFromId?: string }) {
    const [open, setOpen] = useState(false);
    const [below, setBelow] = useState(false);   // 숨길 칸이 화면에 들어왔거나 이미 지나갔다
    const close = useCallback(() => setOpen(false), []);
    useEffect(() => {
        const el = hideFromId ? document.getElementById(hideFromId) : null;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(([entry]) => setBelow(entry.isIntersecting || entry.boundingClientRect.top < 0));
        io.observe(el);
        return () => io.disconnect();
    }, [hideFromId]);
    if (!events.length && !showTip) return null;
    const pill = "flex h-[46px] flex-none items-center gap-[7px] rounded-full pl-4 pr-[18px] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(20,23,28,.3)]";
    return (
        <>
            {!open && (
                <div aria-hidden={below} className={`fixed bottom-[18px] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 ${below ? "pointer-events-none invisible" : ""}`}>
                    {events.length > 0 && (
                        <button type="button" onClick={() => setOpen(true)} className={`${pill} bg-ink`}>
                            <MapIcon size={18} aria-hidden /> 지도
                        </button>
                    )}
                    {showTip && (
                        <Link href="/tip" className={`${pill} bg-accent no-underline`}>
                            <PencilLine size={18} aria-hidden /> 제보하기
                        </Link>
                    )}
                </div>
            )}
            {open && <MapSheet events={events} summary={summary} onClose={close} />}
        </>
    );
}
