"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { appendOrgNote } from "@/lib/orgNotes";

/**
 * 협약 표시 (specs/014 US5). 관리자에게만 보인다. 공간(venues)·단체(orgs)의 partner_since(맺은 날).
 * 표시가 있는 곳에만 «협약» 배지가 보인다. 풀면 partner_since 를 비우고 메모에 «맺은 날~오늘 해지»를 덧붙인다.
 * 메모 자리: 공간은 venues.partner_note(관리자만 읽는 표), 단체는 org_admin_notes(orgs 는 누구나 읽는 표라 메모 칸을 쓰지 않는다, specs/019 A0).
 */
export function AdminPartnerControl({ table, id, since }: { table: "venues" | "orgs"; id: string; since: string | null }) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [date, setDate] = useState(todayKST());
    const [state, setState] = useState<"idle" | "saving" | "error">("idle");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
            if (!cancelled && profile?.role === "admin") setIsAdmin(true);
        })();
        return () => { cancelled = true; };
    }, []);

    if (!isAdmin) return null;

    const save = async (on: boolean) => {
        setState("saving");
        let patch: Record<string, unknown>;
        if (on) {
            patch = { partner_since: date };
        } else {
            const line = `${since ? since + "~" : ""}${todayKST()} 해지`;   // 맺은 날을 남긴다(풀면 partner_since 가 지워지므로)
            if (table === "orgs") {
                if (await appendOrgNote(id, line)) { setState("error"); return; }
                patch = { partner_since: null };
            } else {
                const { data } = await supabase.from(table).select("partner_note").eq("id", id).maybeSingle();
                patch = { partner_since: null, partner_note: [data?.partner_note, line].filter(Boolean).join(" / ").slice(-200) };
            }
        }
        const { data, error } = await supabase.from(table).update(patch).eq("id", id).select("id");
        if (error || !data?.length) { setState("error"); return; }
        setState("idle");
        router.refresh();
    };

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line px-3 py-2 text-[13px] text-ink-soft">
            <span className="font-semibold">협약 (관리자)</span>
            {since ? (
                <>
                    <span>{since}부터 협약</span>
                    <button type="button" onClick={() => save(false)} disabled={state === "saving"} className="rounded-lg border border-ink px-2.5 py-1 font-bold text-ink disabled:opacity-50">협약 풀기</button>
                </>
            ) : (
                <>
                    <input type="date" value={date} max={todayKST()} onChange={e => setDate(e.currentTarget.value)} className="rounded-lg border border-line bg-paper px-2 py-1 text-ink" aria-label="협약 맺은 날" />
                    <button type="button" onClick={() => save(true)} disabled={state === "saving" || !date} className="rounded-lg bg-ink px-2.5 py-1 font-bold text-white disabled:opacity-50">협약 맺음</button>
                </>
            )}
            <span aria-live="polite">{state === "saving" ? "저장 중…" : state === "error" ? "저장하지 못했습니다" : ""}</span>
        </div>
    );
}
