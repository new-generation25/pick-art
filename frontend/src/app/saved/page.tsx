"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EventList } from "@/components/ui/EventList";
import { formatPeriod, todayKST } from "@/lib/utils";
import { loginHref } from "@/lib/reports";

// 찜한 행사 (specs/008). 자기 찜만 읽는다(RLS). 끝난 행사는 뒤에 «종료»로
export default function SavedPage() {
    const [state, setState] = useState<"loading" | "login" | "ready">("loading");
    const [cards, setCards] = useState<any[]>([]);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setState("login"); return; }
            const { data } = await supabase.from("favorites")
                .select("created_at, events(id,title,category,event_date_start,event_date_end,venue,region,poster_image_url,poster_placeholder,source,is_free,status)")
                .order("created_at", { ascending: false });
            const today = todayKST();
            const rows = (data || []).map((f: any) => f.events).filter((e: any) => e && e.status === "PUBLISHED");
            const ended = (e: any) => !!(e.event_date_end || e.event_date_start) && (e.event_date_end || e.event_date_start) < today;
            rows.sort((a: any, b: any) => Number(ended(a)) - Number(ended(b)) || (a.event_date_start || "").localeCompare(b.event_date_start || ""));
            setCards(rows.map((e: any) => ({
                id: e.id, title: e.title, category: e.category,
                date: formatPeriod(e.event_date_start, e.event_date_end),
                location: e.venue || e.region, imageUrl: e.poster_image_url, posterPlaceholder: e.poster_placeholder, source: e.source, isFree: e.is_free, isEnded: ended(e),
            })));
            setState("ready");
        })();
    }, []);

    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
                <h1 className="pica-display text-[32px] leading-[1.2] text-ink sm:text-[40px]">찜한 행사</h1>
                {state === "login" && (
                    <p className="mt-4 text-[15px] text-ink-soft">
                        로그인하면 찜한 행사를 모아 볼 수 있어요.{" "}
                        <Link href={loginHref("/saved")} className="font-bold text-ink underline underline-offset-4">로그인</Link>
                    </p>
                )}
                {state === "ready" && cards.length === 0 && (
                    <p className="mt-4 text-[15px] text-ink-soft">아직 찜한 행사가 없어요. 행사 상세의 하트를 누르면 여기에 모입니다.</p>
                )}
                {state === "ready" && cards.length > 0 && (
                    <div className="mt-6">
                        <p className="mb-4 text-[14px] text-ink-soft">{cards.length}건 · 가까운 날짜 순, 끝난 행사는 뒤에</p>
                        <EventList initialEvents={cards} showEndNote={false} />
                    </div>
                )}
            </div>
        </main>
    );
}
