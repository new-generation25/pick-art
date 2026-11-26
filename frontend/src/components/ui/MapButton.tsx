"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import type { SheetEvent } from "./MapSheet";

// 지도 시트는 누를 때만 내려받는다 (홈 첫 화면에 지도 코드·지도 요청 0건, specs/014 SC-002)
const MapSheet = dynamic(() => import("./MapSheet"), { ssr: false });

/** 홈 아래 가운데에 떠 있는 «지도» 버튼 하나 (시안 f01, 운영자: 목록 맨 아래 지도 칸·늘 떠 있는 지도는 넣지 않음) */
export function MapButton({ events, summary }: { events: SheetEvent[]; summary: string }) {
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    if (!events.length) return null;
    return (
        <>
            {!open && (
                <button type="button" onClick={() => setOpen(true)}
                    className="fixed bottom-[18px] left-1/2 z-[70] flex h-[46px] -translate-x-1/2 items-center gap-[7px] rounded-full bg-ink pl-4 pr-5 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(20,23,28,.3)]">
                    <MapIcon size={18} aria-hidden /> 지도
                </button>
            )}
            {open && <MapSheet events={events} summary={summary} onClose={close} />}
        </>
    );
}
