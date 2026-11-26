"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * 포스터를 «안내 그림»으로 표시하거나 푼다 (specs/014 US2). 관리자에게만 보인다.
 * 표시는 그림 지문(events.poster_sha256) 단위라 같은 그림을 쓰는 모든 행사에 한꺼번에 적용된다(DB 트리거).
 * 지문이 없으면 collector/tools/poster_fingerprint.py --apply 를 먼저 돌려야 한다.
 */
export function AdminPosterControl({ sha256, placeholder }: { sha256: string | null; placeholder: boolean }) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [same, setSame] = useState<number | null>(null);
    const [note, setNote] = useState("");
    const [state, setState] = useState<"idle" | "saving" | "error">("idle");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
            if (cancelled || profile?.role !== "admin") return;
            setIsAdmin(true);
            if (sha256) {
                const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("poster_sha256", sha256);
                if (!cancelled) setSame(count ?? null);
            }
        })();
        return () => { cancelled = true; };
    }, [sha256]);

    if (!isAdmin) return null;

    const toggle = async () => {
        if (!sha256) return;
        setState("saving");
        const { error } = placeholder
            ? await supabase.from("placeholder_images").delete().eq("sha256", sha256)
            : await supabase.from("placeholder_images").insert({ sha256, note: note.trim().slice(0, 120) || null });
        if (error) { setState("error"); return; }
        setState("idle");
        router.refresh();
    };

    return (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border-[1.5px] border-dashed border-line px-3 py-2 text-[13px] text-ink-soft">
            <p className="font-semibold">포스터 자리 (관리자)</p>
            {!sha256 ? (
                <p>그림 지문이 없습니다. 수집기 <code>poster_fingerprint.py --apply</code>를 돌린 뒤 표시할 수 있습니다.</p>
            ) : (
                <>
                    <p>
                        {placeholder ? "«안내 그림»으로 표시돼 글자 포스터로 보입니다." : "포스터로 보입니다."}
                        {same !== null && <> 같은 그림을 쓰는 행사 <b className="text-ink">{same}건</b>에 함께 적용됩니다.</>}
                    </p>
                    {!placeholder && (
                        <input value={note} maxLength={120} onChange={e => setNote(e.currentTarget.value)}
                            placeholder="메모 (예: 김해서부문화센터 «공연 이미지 준비 중»)"
                            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] text-ink" />
                    )}
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={toggle} disabled={state === "saving"}
                            className="rounded-lg bg-ink px-3 py-1.5 font-bold text-white disabled:opacity-50">
                            {placeholder ? "안내 그림 표시 풀기" : "안내 그림으로 표시"}
                        </button>
                        <span aria-live="polite">{state === "saving" ? "저장 중…" : state === "error" ? "저장하지 못했습니다" : ""}</span>
                    </div>
                </>
            )}
        </div>
    );
}
