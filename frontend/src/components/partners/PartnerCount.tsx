"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 지금까지 맺은 파트너십 수 (운영자 2026-11-27 «파트너 협약 페이지에 현재까지 맺은 파트너십 숫자 표시해줘»).
 * 운영자가 «협약 확인»을 한 단체(orgs.partner_since 가 있는 줄)만 센다 — 신청만 한 곳은 세지 않는다(헌장 I).
 * 0곳이거나 못 읽으면 아무것도 그리지 않는다.
 * 2026-11-28 운영자 «파트너 신청 링크 맨 위에 협력 예술인 숫자 노출»: /partners 맨 위(size="lg")에 크게,
 * 인스타 프로필 링크(#join)로 양식에 바로 내려오는 사람을 위해 양식 머리에 작은 줄(size="sm")을 하나 더 둔다.
 */
export function PartnerCount({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
    const [n, setN] = useState<number | null>(null);
    useEffect(() => {
        supabase.from("orgs").select("id", { count: "exact", head: true }).not("partner_since", "is", null)
            .then(({ count, error }) => { if (!error && typeof count === "number") setN(count); });
    }, []);
    if (!n) return null;
    if (size === "sm") {
        return (
            <p className={`text-[14px] leading-relaxed text-ink-soft ${className}`}>
                지금까지 <b className="pica-num text-accent">{n}</b>곳이 함께하고 있어요.
            </p>
        );
    }
    const big = size === "lg";
    return (
        <p className={`${big ? "text-[17px]" : "text-[15px]"} leading-relaxed text-ink ${className}`}>
            지금까지 <b className={`pica-num ${big ? "text-[30px]" : "text-[20px]"} leading-none text-accent`}>{n}</b><b>곳</b>과 파트너십을 맺었어요.
        </p>
    );
}
