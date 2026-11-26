"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, BellOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";

/**
 * «휴대폰 알림 켜기» (specs/018). 찜한 행사 전날 · 금요일 주말 행사 요약을 이 기기로 받는다.
 * 로그인 회원만(찜·내 지역을 알아야 보낼 수 있다). 아이폰은 홈 화면에 추가한 앱에서만 된다.
 * compact: 홈 띠에 칩 모양으로. 아니면 내 정보 화면의 한 줄 버튼
 */
export function PushButton({ compact = false }: { compact?: boolean }) {
    const [state, setState] = useState<PushState>("checking");
    const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setLoggedIn(!!session?.user);
            setState(await pushState());
        })();
    }, []);

    const click = async () => {
        setNote("");
        if (!loggedIn) return;
        setBusy(true);
        try {
            setState(state === "on" ? await disablePush() : await enablePush());
        } catch (e) {
            setNote(`알림을 켜지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setBusy(false);
        }
    };

    const chip = "pica-chip";
    if (state === "checking" || loggedIn === null) return null;

    if (state === "unsupported") {
        return compact ? null : <p className="py-2 text-[13px] text-ink-soft">이 브라우저는 알림을 받을 수 없어요. 크롬·사파리 최신판에서 열어 주세요.</p>;
    }
    if (state === "ios-install") {
        return <p className={compact ? "basis-full text-[12.5px] text-ink-soft" : "py-2 text-[13px] leading-[1.5] text-ink-soft"}>
            아이폰은 사파리 아래 <b className="text-ink">공유 버튼 → 홈 화면에 추가</b>로 피카를 설치한 뒤, 그 앱에서 알림을 켤 수 있어요.
        </p>;
    }
    if (!loggedIn) {
        return <Link href="/login" className={compact ? chip : "flex h-[42px] items-center justify-center rounded-[10px] bg-accent-soft text-[14px] font-bold text-accent"}>
            <BellRing size={15} aria-hidden />로그인하고 알림 받기
        </Link>;
    }
    if (state === "denied") {
        return <p className="py-2 text-[13px] text-ink-soft">알림이 막혀 있어요. 브라우저(또는 휴대폰) 설정에서 picka.news 알림을 허용해 주세요.</p>;
    }
    return (
        <>
            <button type="button" onClick={click} disabled={busy} aria-pressed={state === "on"}
                className={compact ? chip : `flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-bold ${state === "on" ? "bg-soft text-ink" : "bg-accent text-on-accent"}`}>
                {state === "on" ? <BellOff size={15} aria-hidden /> : <BellRing size={15} aria-hidden />}
                {busy ? "잠시만요…" : state === "on" ? (compact ? "알림 켜짐" : "이 기기 알림 끄기") : "휴대폰 알림 켜기"}
            </button>
            {note && <p className="basis-full text-[12.5px] text-[var(--pk-accent)]" role="status">{note}</p>}
        </>
    );
}
