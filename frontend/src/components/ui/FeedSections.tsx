"use client";

import { useEffect, useRef, useState } from "react";
import { EventList } from "./EventList";
import { supabase } from "@/lib/supabase";
import { SECTION_LABELS, SectionKey } from "@/lib/feedOrder";

const PAGE = 20;

interface Card {
    id: string;
    title: string;
    category: string;
    date: string;
    location: string;
    imageUrl: string;
    isFree: boolean;
    isEnded?: boolean;
}

/**
 * 날짜 묶음별 목록. 순서는 서버(lib/feedOrder.ts)가 정하고,
 * 로그인 사용자가 관심 분야를 골라 두었으면 묶음 안에서 그 분야를 앞으로 당긴다.
 * 포스터 없는 행사가 뒤에 있는 규칙은 지킨다: [포스터·관심] [포스터·그 외] [무포스터·관심] [무포스터·그 외]
 */
export function FeedSections({ sections, filters }: { sections: { key: SectionKey; cards: Card[] }[]; filters: any }) {
    const [interests, setInterests] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase.from("profiles").select("interests").eq("id", session.user.id).maybeSingle();
            if (!cancelled && profile?.interests?.length) setInterests(profile.interests);
        })();
        return () => { cancelled = true; };
    }, []);

    const rank = (c: Card) => (c.imageUrl ? 0 : 2) + (interests.includes(c.category) ? 0 : 1);
    const ordered = sections.map(s => ({
        ...s,
        // Array.sort 는 안정 정렬이라 같은 순위 안에서는 서버가 정한 순서가 그대로 남는다
        cards: interests.length ? [...s.cards].sort((a, b) => rank(a) - rank(b)) : s.cards,
    }));

    // 처음에는 묶음 순서대로 PAGE 건만 그리고, 목록 끝이 보이면 PAGE 건씩 더 그린다.
    // (행사 470여 건을 한 번에 그리면 HTML 1.7MB·화면 요소 1만 개라 첫 화면이 늦었다)
    const total = ordered.reduce((n, s) => n + s.cards.length, 0);
    const [shown, setShown] = useState(PAGE);
    const sentinel = useRef<HTMLDivElement>(null);

    useEffect(() => { setShown(PAGE); }, [sections]); // 필터가 바뀌면 처음부터

    useEffect(() => {
        const el = sentinel.current;
        if (!el || shown >= total) return;
        const io = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) setShown(n => Math.min(n + PAGE, total));
        }, { rootMargin: "600px 0px" }); // 끝에 닿기 조금 전에 미리 붙인다
        io.observe(el);
        return () => io.disconnect();
    }, [shown, total]);

    let budget = shown;
    const visible = ordered
        .map(s => {
            const cards = s.cards.slice(0, Math.max(0, budget));
            budget -= cards.length;
            return { ...s, visibleCards: cards };
        })
        .filter(s => s.visibleCards.length > 0);

    if (ordered.length === 0) return <EventList initialEvents={[]} filters={filters} />;

    return (
        <>
            {interests.length > 0 && !filters?.category && (
                <p className="mb-6 text-[13px] text-ink-soft">
                    관심 분야(<b className="text-ink">{interests.join("·")}</b>)를 묶음마다 먼저 보여 줍니다. 설정에서 바꿀 수 있습니다.
                </p>
            )}
            {visible.map(s => (
                <section key={s.key} className="mb-12 last:mb-0" aria-labelledby={`sec-${s.key}`}>
                    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-line pb-2">
                        <h2 id={`sec-${s.key}`} className="pica-display text-[24px] leading-none text-ink sm:text-[28px]">
                            {SECTION_LABELS[s.key].title}
                        </h2>
                        <span className="text-[14px] font-bold text-ink">{s.cards.length}건</span>
                        <span className="text-[13px] text-ink-soft">{SECTION_LABELS[s.key].note}</span>
                    </div>
                    <EventList initialEvents={s.visibleCards} filters={filters} showEndNote={false} />
                </section>
            ))}
            {shown < total ? (
                <div ref={sentinel} className="py-8 text-center text-[13px] text-ink-soft">
                    {total - shown}건 더 불러오는 중...
                </div>
            ) : (
                <p className="py-8 text-center text-[13px] text-ink-soft">모든 행사를 보여 드렸습니다 ({total}건)</p>
            )}
        </>
    );
}
