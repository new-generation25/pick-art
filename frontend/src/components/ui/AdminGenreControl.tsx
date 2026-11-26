"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SUBCATEGORIES } from "@/lib/categories";

/**
 * 세부 갈래 고르기 (specs/015 US3). 관리자에게만 보인다. 그 대분류의 세부만 고를 수 있고(DB CHECK 와 같은 목록),
 * 저장하면 subcategory_by='admin' 으로 남아 자동 판정이 덮어쓰지 않는다.
 */
export function AdminGenreControl({ eventId, category, sub, by, pending, evidence, compact = false, onSaved }: {
    eventId: string; category: string; sub: string | null; by: string | null; pending: boolean; evidence?: string | null;
    compact?: boolean; onSaved?: () => void;
}) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(compact); // 대시보드 목록(compact)은 이미 관리자 화면
    const [state, setState] = useState<"idle" | "saving" | "error">("idle");

    useEffect(() => {
        if (compact) return;
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
            if (!cancelled && profile?.role === "admin") setIsAdmin(true);
        })();
        return () => { cancelled = true; };
    }, [compact]);

    const options = SUBCATEGORIES[category] ?? [];
    if (!isAdmin || !options.length) return null;

    const save = async (value: string) => {
        setState("saving");
        const patch = value
            ? { subcategory: value, subcategory_by: "admin", subcategory_pending: false, subcategory_evidence: "운영자 확정" }
            : { subcategory: null, subcategory_by: null, subcategory_pending: false, subcategory_evidence: null }; // 비우면 다음 판정에서 다시 매긴다
        const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select("id");
        if (error || !data?.length) { setState("error"); return; }
        setState("idle");
        if (onSaved) onSaved(); else router.refresh();
    };

    return (
        <div className={compact ? "flex items-center gap-2" : "mt-3 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line px-3 py-2 text-[13px] text-ink-soft"}>
            {!compact && <span className="font-semibold">세부 갈래 (관리자)</span>}
            <select value={sub ?? ""} onChange={e => save(e.currentTarget.value)} disabled={state === "saving"}
                className="rounded-lg border border-line bg-paper px-2 py-1 text-[13px] text-ink" aria-label={`${category} 세부 갈래`}>
                <option value="">{pending ? "판정 대기 — 고르기" : "자동 판정에 맡기기"}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {!compact && <span>{by === "admin" ? "운영자 확정" : by === "kopis" ? "KOPIS 장르" : by === "rule" ? "규칙 판정" : pending ? "판정 대기" : ""}{evidence && by !== "admin" ? ` · ${evidence}` : ""}</span>}
            <span aria-live="polite">{state === "saving" ? "저장 중…" : state === "error" ? "저장하지 못했습니다" : ""}</span>
        </div>
    );
}
