"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { checkTip, loginHref, type TipInput } from "@/lib/reports";

const EMPTY: TipInput = { title: "", date_start: "", date_end: "", venue: "", region: "", url: "", body: "" };

export function TipForm() {
    const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
    const [form, setForm] = useState<TipInput>(EMPTY);
    const [errors, setErrors] = useState<string[]>([]);
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session?.user));
    }, []);

    // 값은 이벤트 처리 중에 먼저 읽는다(나중에 도는 상태 갱신 함수 안에서는 currentTarget 이 비어 있다)
    const set = (k: keyof TipInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.currentTarget.value;
        setForm(f => ({ ...f, [k]: value }));
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = checkTip(form);
        setErrors(errs);
        if (errs.length) return;
        setState("sending");
        const { body, ...tip } = form;
        const { error } = await supabase.from("reports").insert({
            kind: "tip",
            body: body.trim() || "(설명 없음)",
            tip: { ...tip, title: tip.title.trim(), venue: tip.venue.trim(), url: tip.url.trim(), date_end: tip.date_end || tip.date_start },
        });
        if (error) {
            setState("error");
            setErrors([error.message.includes("row-level security") ? "오늘은 더 보낼 수 없어요(하루 10건). 내일 다시 알려 주세요." : "보내지 못했습니다. 잠시 뒤 다시 해 주세요."]);
            return;
        }
        setState("sent");
        setForm(EMPTY);
    };

    if (loggedIn === null) return null;
    if (!loggedIn) {
        return (
            <div className="pica-box p-5 text-[15px]">
                <p className="text-ink">제보는 로그인한 뒤 보낼 수 있어요. 누가 알려 주셨는지 알아야 확인할 때 다시 여쭐 수 있습니다.</p>
                <Link href={loginHref("/tip")} className="mt-4 inline-flex h-12 items-center border-[1.5px] border-ink bg-accent px-5 font-bold text-on-accent">로그인하고 제보하기</Link>
            </div>
        );
    }
    if (state === "sent") {
        return (
            <div className="pica-box p-5 text-[15px]">
                <p className="font-bold text-ink">고맙습니다. 제보를 받았어요.</p>
                <p className="mt-2 text-ink-soft">공식 안내로 날짜·장소를 확인한 뒤 피카에 올립니다. 확인이 안 되면 올리지 않을 수 있어요.</p>
                <button type="button" onClick={() => setState("idle")} className="mt-4 text-ink underline underline-offset-4">하나 더 제보하기</button>
            </div>
        );
    }

    const field = "w-full border-[1.5px] border-line bg-paper px-3 py-2.5 text-[15px] text-ink";
    const label = "mb-1.5 block text-[14px] font-semibold text-ink";
    return (
        <form onSubmit={send} className="flex flex-col gap-5" noValidate>
            <div>
                <label htmlFor="tip-title" className={label}>행사 이름 *</label>
                <input id="tip-title" value={form.title} onChange={set("title")} maxLength={120} className={field} placeholder="예) 골목 버스킹 〈겨울밤 어쿠스틱〉" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="tip-start" className={label}>시작 날짜 *</label>
                    <input id="tip-start" type="date" value={form.date_start} onChange={set("date_start")} className={field} />
                </div>
                <div>
                    <label htmlFor="tip-end" className={label}>끝나는 날짜</label>
                    <input id="tip-end" type="date" value={form.date_end} onChange={set("date_end")} className={field} />
                </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                <div>
                    <label htmlFor="tip-venue" className={label}>장소 *</label>
                    <input id="tip-venue" value={form.venue} onChange={set("venue")} maxLength={120} className={field} placeholder="예) 봉황동 ○○카페 2층" />
                </div>
                <div>
                    <label htmlFor="tip-region" className={label}>지역</label>
                    <select id="tip-region" value={form.region} onChange={set("region")} className={field}>
                        <option value="">고르기</option>
                        {GN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <label htmlFor="tip-url" className={label}>공식 안내 주소 *</label>
                <input id="tip-url" type="url" value={form.url} onChange={set("url")} maxLength={500} className={field} placeholder="https:// 단체 누리집·인스타그램 게시물·예매 페이지" />
            </div>
            <div>
                <label htmlFor="tip-body" className={label}>더 알려 줄 것</label>
                <textarea id="tip-body" value={form.body} onChange={set("body")} maxLength={2000} rows={4} className={field} placeholder="시간, 관람료, 아이와 갈 만한지 등" />
            </div>
            {errors.length > 0 && (
                <ul className="list-disc pl-5 text-[14px] text-ink" role="alert">
                    {errors.map(e => <li key={e}>{e}</li>)}
                </ul>
            )}
            <button type="submit" disabled={state === "sending"} className="h-12 border-[1.5px] border-ink bg-accent px-5 text-[15px] font-bold text-on-accent disabled:opacity-50">
                {state === "sending" ? "보내는 중…" : "제보 보내기"}
            </button>
        </form>
    );
}
