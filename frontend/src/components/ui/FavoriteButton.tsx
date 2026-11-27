"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loginHref } from "@/lib/reports";

/** 찜 (specs/008). 로그인 회원만. 로그아웃이면 로그인 뒤 이 행사로 돌아온다 */
export function FavoriteButton({ eventId }: { eventId: string }) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null | undefined>(undefined);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            if (!uid) return;
            const { data } = await supabase.from("favorites").select("event_id").eq("event_id", eventId).maybeSingle();
            setSaved(!!data);
        })();
    }, [eventId]);

    const toggle = async () => {
        if (!userId) {
            router.push(loginHref(window.location.pathname));
            return;
        }
        setBusy(true);
        const { error } = saved
            ? await supabase.from("favorites").delete().eq("event_id", eventId).eq("user_id", userId)
            : await supabase.from("favorites").insert({ event_id: eventId });
        if (!error) setSaved(!saved);
        setBusy(false);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={busy || userId === undefined}
            aria-pressed={saved}
            aria-label={saved ? "찜 풀기" : "찜하기"}
            title={saved ? "찜 풀기" : "찜하기"}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-colors hover:bg-soft disabled:opacity-50"
        >
            <Heart className="h-5 w-5" fill={saved ? "currentColor" : "none"} aria-hidden />
        </button>
    );
}
