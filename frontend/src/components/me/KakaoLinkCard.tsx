"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/** 카카오톡 채널 «행사 알리기» 제보를 이 회원과 잇는다(specs/017, 운영자 11/27 «연결 코드 방식»).
 *  회원이 6자리 코드(10분)를 받아 피카 채널 채팅방에 «연결 123456»을 보내면, 그 뒤 카카오로 보낸 제보가 이 회원 것으로 기록된다.
 *  포인트 약속은 여기서 하지 않는다(021 적용 전). */
const KAKAO_CHAT = "https://pf.kakao.com/_xoxdxkvX/chat";

export function KakaoLinkCard({ className }: { className: string }) {
    const [linked, setLinked] = useState<boolean | null>(null);
    const [code, setCode] = useState<{ code: string; until: string } | null>(null);
    const [msg, setMsg] = useState("");

    const loadLinked = async () => {
        const { data } = await supabase.rpc("kakao_link_status");
        return !!(data as { linked?: boolean } | null)?.linked;
    };
    const refresh = async () => setLinked(await loadLinked());
    useEffect(() => {
        let alive = true;
        loadLinked().then(v => { if (alive) setLinked(v); });
        return () => { alive = false; };
    }, []);

    const getCode = async () => {
        setMsg("");
        const { data, error } = await supabase.rpc("kakao_link_code");
        const d = data as { ok?: boolean; code?: string; expires_at?: string } | null;
        if (error || !d?.ok || !d.code) { setMsg("코드를 받지 못했어요. 잠시 뒤에 다시 눌러 주세요."); return; }
        setCode({ code: d.code, until: new Date(d.expires_at!).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }) });
    };
    const unlink = async () => {
        if (!confirm("카카오톡 제보 연결을 끊을까요? 이미 보낸 제보 기록은 그대로 남아요.")) return;
        const { error } = await supabase.rpc("kakao_unlink");
        setMsg(error ? "끊지 못했어요. 잠시 뒤에 다시 눌러 주세요." : "연결을 끊었어요.");
        setCode(null);
        refresh();
    };

    if (linked === null) return null;
    return (
        <div className={className}>
            <div className="flex min-h-14 items-center gap-3 py-2 text-[15px]">
                <MessageCircle className="h-5 w-5 flex-none text-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1">
                    <b className="block font-bold">카카오톡 제보 연결</b>
                    <small className="block text-[12.5px] leading-[1.4] text-ink-soft">
                        {linked ? "연결됨 · 피카 채널로 보낸 행사 제보가 내 기록에 남아요" : "피카 카카오톡 채널로 보낸 행사 제보를 내 기록에 남겨요"}
                    </small>
                </span>
                {linked
                    ? <button type="button" onClick={unlink} className="h-[34px] whitespace-nowrap rounded-full bg-card px-3 text-[13px] font-bold shadow-[inset_0_0_0_1.5px_var(--pk-line)]">연결 끊기</button>
                    : <button type="button" onClick={getCode} className="h-[34px] whitespace-nowrap rounded-full bg-accent-soft px-3 text-[13px] font-bold text-accent">연결 코드 받기</button>}
            </div>
            {code && !linked && (
                <div className="mb-3 rounded-[10px] bg-paper p-3 text-[14px]">
                    <p className="pica-num text-[26px] font-bold tracking-[0.2em] text-ink">{code.code}</p>
                    <p className="mt-1 text-ink-soft">{code.until}까지 피카 카카오톡 채널 채팅방에 <b className="text-ink">연결 {code.code}</b> 을 보내 주세요.</p>
                    <div className="mt-2 flex gap-2">
                        <a href={KAKAO_CHAT} target="_blank" rel="noopener noreferrer" className="flex h-[38px] flex-1 items-center justify-center rounded-[10px] bg-accent text-[14px] font-bold text-on-accent">카카오톡 채널 열기</a>
                        <button type="button" onClick={refresh} className="h-[38px] flex-1 rounded-[10px] bg-card text-[14px] font-bold shadow-[inset_0_0_0_1.5px_var(--pk-line)]">보냈어요</button>
                    </div>
                </div>
            )}
            {msg && <p className="pb-3 text-[12.5px] text-accent" aria-live="polite">{msg}</p>}
        </div>
    );
}
