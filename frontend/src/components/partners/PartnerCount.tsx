"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 지금까지 맺은 파트너십 수 (운영자 2026-11-27 «파트너 협약 페이지에 현재까지 맺은 파트너십 숫자 표시해줘»).
 * 운영자가 «협약 확인»을 한 단체(orgs.partner_since 가 있는 줄)만 센다 — 신청만 한 곳은 세지 않는다(헌장 I).
 * 0곳이거나 못 읽으면 아무것도 그리지 않는다.
 */
export function PartnerCount({ className = "" }: { className?: string }) {
    const [n, setN] = useState<number | null>(null);
    useEffect(() => {
        supabase.from("orgs").select("id", { count: "exact", head: true }).not("partner_since", "is", null)
            .then(({ count, error }) => { if (!error && typeof count === "number") setN(count); });
    }, []);
    if (!n) return null;
    return (
        <p className={`text-[15px] leading-relaxed text-ink ${className}`}>
            지금까지 <b className="pica-num text-[20px] text-accent">{n}</b><b>곳</b>과 파트너십을 맺었어요.
        </p>
    );
}
