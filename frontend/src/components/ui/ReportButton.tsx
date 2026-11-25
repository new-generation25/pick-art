"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ERROR_CATEGORIES, loginHref } from "@/lib/reports";

/** 행사 상세의 「정보가 틀렸어요」 (specs/007). 로그인 회원만 보낸다 */
export function ReportButton({ eventId }: { eventId: string }) {
    const [open, setOpen] = useState(false);
    const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
    const [category, setCategory] = useState<string>(ERROR_CATEGORIES[0]);
    const [body, setBody] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session?.user));
    }, []);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (body.trim().length < 2) {
            setState("error");
            setMessage("무엇이 틀렸는지 한 줄이라도 적어 주세요.");
            return;
        }
        setState("sending");
        const { error } = await supabase.from("reports").insert({ kind: "error", event_id: eventId, category, body: body.trim() });
        if (error) {
            setState("error");
            setMessage(error.message.includes("row-level security") ? "오늘은 더 보낼 수 없어요(하루 10건). 내일 다시 알려 주세요." : "보내지 못했습니다. 잠시 뒤 다시 해 주세요.");
            return;
        }
        setState("sent");
    };

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                <Flag className="h-3.5 w-3.5" aria-hidden /> 정보가 틀렸어요
            </button>
        );
    }

    return (
        <div className="pica-box p-4 text-[14px]">
            <p className="font-bold text-ink">정보가 틀렸나요?</p>
            {loggedIn === false ? (
                <p className="mt-2 text-ink-soft">
                    로그인하면 알려 주실 수 있어요. 확인한 뒤 바로 고칩니다.{" "}
                    <Link href={loginHref(window.location.pathname)} className="font-bold text-ink underline underline-offset-4">로그인하고 알리기</Link>
                </p>
            ) : state === "sent" ? (
                <p className="mt-2 text-ink">고맙습니다. 공식 안내로 확인한 뒤 고칠게요.</p>
            ) : (
                <form onSubmit={send} className="mt-3 flex flex-col gap-3">
                    <div className="pica-chiprow" role="group" aria-label="틀린 곳">
                        {ERROR_CATEGORIES.map(c => (
                            <button key={c} type="button" className="pica-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
                        ))}
                    </div>
                    <label htmlFor="report-body" className="sr-only">무엇이 틀렸는지</label>
                    <textarea
                        id="report-body"
                        value={body}
                        onChange={e => setBody(e.currentTarget.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="예) 공연 시간이 19:30이 아니라 19:00이에요. 공식 안내 주소가 있으면 같이 적어 주세요."
                        className="w-full border-[1.5px] border-line bg-paper p-2.5 text-ink"
                    />
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={state === "sending"} className="h-10 border-[1.5px] border-ink bg-ink px-4 font-bold text-paper disabled:opacity-50">
                            {state === "sending" ? "보내는 중…" : "알리기"}
                        </button>
                        <button type="button" onClick={() => setOpen(false)} className="text-ink-soft underline underline-offset-4">닫기</button>
                        {state === "error" && <span className="text-[13px] text-ink" role="alert">{message}</span>}
                    </div>
                </form>
            )}
        </div>
    );
}
