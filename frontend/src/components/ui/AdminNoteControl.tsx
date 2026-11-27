"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/** 상세 「피카가 본 이유」 쓰기 (specs/009). 관리자에게만 보인다. events.pica_note(120자) */
export function AdminNoteControl({ eventId, note }: { eventId: string; note: string | null }) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [value, setValue] = useState(note ?? "");
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

    const save = async () => {
        setState("saving");
        const next = value.trim() || null;
        const { data, error } = await supabase.from("events").update({ pica_note: next }).eq("id", eventId).select("pica_note");
        if (error || !data?.length || (data[0].pica_note ?? null) !== next) { setState("error"); return; }
        setState("saved");
        router.refresh();
    };

    return (
        <div className="mt-3 flex flex-col gap-2 border-[1.5px] border-dashed border-line px-3 py-2 text-[13px] text-ink-soft">
            <label htmlFor="pica-note" className="font-semibold">피카가 본 이유(관리자 · 120자)</label>
            <textarea
                id="pica-note"
                value={value}
                maxLength={120}
                rows={2}
                onChange={e => { const v = e.currentTarget.value; setValue(v); setState("idle"); }}
                placeholder="예) 동네 서점에서 여는 작은 북토크. 작가와 둘러앉아 이야기할 수 있어요."
                className="w-full border-[1.5px] border-line bg-paper p-2 text-[14px] text-ink"
            />
            <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={state === "saving"} className="rounded-full border-[1.5px] border-ink bg-ink px-3.5 py-1 font-bold text-paper disabled:opacity-50">저장</button>
                <span aria-live="polite">{state === "saving" ? "저장 중…" : state === "saved" ? "저장했습니다" : state === "error" ? "저장하지 못했습니다" : `${value.length}/120`}</span>
            </div>
        </div>
    );
}
