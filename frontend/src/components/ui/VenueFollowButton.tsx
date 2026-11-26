"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loginHref } from "@/lib/reports";

/**
 * 장소 찜 (specs/018, 운영자 11/27 «행사가 열리는 장소에 대한 좋아요도 가능, 다음에도 그 장소에서 행사가 생기면 알림»).
 * 행사 찜(FavoriteButton)과 따로 venue_follows 에 둔다. 로그인 회원만. 알림은 휴대폰 알림을 켠 기기로 간다.
 * icon: 행사 상세의 버튼 줄처럼 좁은 곳에서는 아이콘 버튼으로
 */
export function VenueFollowButton({ venueId, icon = false }: { venueId: string; icon?: boolean }) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null | undefined>(undefined);
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            if (!uid) return;
            const { data } = await supabase.from("venue_follows").select("venue_id").eq("venue_id", venueId).maybeSingle();
            setOn(!!data);
        })();
    }, [venueId]);

    const toggle = async () => {
        if (!userId) { router.push(loginHref(window.location.pathname)); return; }
        setBusy(true);
        const { error } = on
            ? await supabase.from("venue_follows").delete().eq("venue_id", venueId).eq("user_id", userId)
            : await supabase.from("venue_follows").insert({ venue_id: venueId });
        if (!error) setOn(!on);
        setBusy(false);
    };

    const label = on ? "장소 찜 풀기" : "이 장소 찜하기(새 행사가 생기면 알림)";
    return (
        <button type="button" onClick={toggle} disabled={busy || userId === undefined} aria-pressed={on} aria-label={label} title={label}
            className={icon
                ? `inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-ink shadow-[0_0_0_1px_var(--pk-line)] transition-colors disabled:opacity-50 ${on ? "bg-accent-soft text-accent" : "bg-card hover:bg-soft"}`
                : `flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[15px] font-bold shadow-[0_0_0_1px_var(--pk-line)] transition-colors disabled:opacity-50 ${on ? "bg-accent-soft text-accent" : "bg-card text-ink hover:bg-soft"}`}>
            <Heart className="h-[18px] w-[18px]" fill={on ? "currentColor" : "none"} aria-hidden />
            {!icon && (on ? "찜한 장소" : "장소 찜")}
        </button>
    );
}
