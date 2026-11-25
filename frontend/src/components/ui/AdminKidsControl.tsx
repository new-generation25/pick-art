"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * 행사 상세의 「아이 분류」 고치기 (specs/004 FR-009). 관리자에게만 보인다.
 * events.kids_override 에 저장한다. 비우면 규칙대로(lib/kids.ts). 정기 수집은 이 칸을 쓰지 않는다.
 */
const OPTIONS = [
    { value: "", label: "규칙대로" },
    { value: "target", label: "아이 대상" },
    { value: "ok", label: "아이도 볼 수 있음" },
    { value: "none", label: "해당 없음" },
];
const RULE_LABEL: Record<string, string> = { target: "아이 대상", ok: "아이도 볼 수 있음", none: "해당 없음" };

export function AdminKidsControl({ eventId, override, ruleGroup }: { eventId: string; override: string | null; ruleGroup: string | null }) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [value, setValue] = useState(override ?? "");
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

    const save = async (next: string) => {
        setValue(next);
        setState("saving");
        const { data, error } = await supabase.from("events").update({ kids_override: next || null }).eq("id", eventId).select("kids_override");
        // 저장됐는지 돌아온 값으로 확인한다(RLS 로 막히면 빈 배열)
        if (error || !data?.length || (data[0].kids_override ?? "") !== next) {
            setState("error");
            return;
        }
        setState("saved");
        router.refresh();
    };

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-[1.5px] border-dashed border-line px-3 py-2 text-[13px] text-ink-soft">
            <label htmlFor="kids-override" className="font-semibold">아이 분류(관리자)</label>
            <select
                id="kids-override"
                value={value}
                onChange={(e) => save(e.currentTarget.value)}
                disabled={state === "saving"}
                className="border-[1.5px] border-line bg-paper px-2 py-1 text-ink"
            >
                {OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                        {o.value === "" ? `규칙대로 (지금: ${RULE_LABEL[ruleGroup ?? "none"]})` : o.label}
                    </option>
                ))}
            </select>
            <span aria-live="polite">
                {state === "saving" ? "저장 중…" : state === "saved" ? "저장했습니다" : state === "error" ? "저장하지 못했습니다" : ""}
            </span>
        </div>
    );
}
