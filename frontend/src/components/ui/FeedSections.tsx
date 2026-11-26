"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Shelf, ShelfTile, type ShelfCard } from "./Shelf";
import { supabase } from "@/lib/supabase";
import { SECTION_LABELS, SectionKey } from "@/lib/feedOrder";

export type FeedCard = ShelfCard & { kidRank?: number };

/** 묶음 머리 아래 정렬 기준 (시안 f01: «끝나는 날이 가까운 순», «시작하는 날 순») */
const SORT_NOTE: Record<SectionKey, string> = {
    today: "끝나는 날이 가까운 순",
    week: "내일부터 7일 안에 시작 · 시작하는 날 순",
    next: "8~14일 뒤에 시작 · 시작하는 날 순",
    later: "보름 뒤부터 시작 · 시작하는 날 순",
    long: "한 달 넘게 하는 전시·행사 · 곧 끝나는 것부터",
    ended: "종료 1개월 이내 · 최근에 끝난 순",
};

/**
 * 날짜 묶음별 선반 (specs/014 US1). 묶음과 순서는 서버(lib/feedOrder.ts)가 정하고,
 * 로그인 사용자가 관심 분야를 골라 두었으면 묶음 안에서 그 분야를 앞으로 당긴다.
 * 포스터 없는 행사가 뒤에 있는 규칙은 지킨다: [포스터·관심] [포스터·그 외] [무포스터·관심] [무포스터·그 외]
 * «상시·장기»는 접힌 한 줄로 두고 누르면 펼친다. 묶음마다 앞 12장만 그리고 나머지는 «모두 보기»(?section=)로 보낸다.
 */
export function FeedSections({ sections, moreBase }: { sections: { key: SectionKey; cards: FeedCard[] }[]; moreBase: string }) {
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

    // 「아이」 필터가 켜졌으면 «아이 대상»(kidRank 0)이 늘 먼저다. 그다음 포스터·관심 분야 규칙
    const rank = (c: FeedCard) => (c.kidRank ?? 0) * 4 + (c.imageUrl ? 0 : 2) + (interests.includes(c.category) ? 0 : 1);
    const ordered = sections.map(s => ({
        ...s,
        // Array.sort 는 안정 정렬이라 같은 순위 안에서는 서버가 정한 순서가 그대로 남는다
        cards: interests.length ? [...s.cards].sort((a, b) => rank(a) - rank(b)) : s.cards,
    }));

    const more = (key: SectionKey) => `${moreBase}${moreBase.includes("?") ? "&" : "?"}section=${key}`;
    const firstKey = ordered.find(s => s.key !== "long")?.key;

    return (
        <>
            {interests.length > 0 && (
                <p className="mb-2 px-4 text-[12.5px] text-ink-soft">
                    관심 분야(<b className="text-ink">{interests.join("·")}</b>)를 묶음마다 먼저 보여 줍니다.
                </p>
            )}
            {ordered.map(s => s.key === "long" ? (
                <details key={s.key} className="group mx-4 mt-4 border-t border-line">
                    <summary className="flex h-[54px] cursor-pointer list-none items-center justify-between border-b border-line [&::-webkit-details-marker]:hidden">
                        <span className="flex items-baseline gap-[7px]">
                            <span className="pica-display text-[18px] text-ink">{SECTION_LABELS.long.title}</span>
                            <span className="pica-num text-[16px] font-semibold text-accent">{s.cards.length}</span>
                            <small className="text-[12.5px] font-medium text-ink-soft">곧 끝나는 것부터</small>
                        </span>
                        <ChevronDown size={20} className="text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="-mx-4 pb-2 pt-3">
                        <div className="pica-shelf-row">
                            {s.cards.slice(0, 12).map(c => <ShelfTile key={c.id} c={c} wide />)}
                        </div>
                        <Link href={more(s.key)} className="mx-4 mt-3 inline-block text-[13px] font-semibold text-ink-soft hover:text-ink">상시·장기 모두 보기 ({s.cards.length}건)</Link>
                    </div>
                </details>
            ) : (
                <Shelf
                    key={s.key}
                    id={s.key}
                    title={SECTION_LABELS[s.key].title}
                    count={s.cards.length}
                    sub={SORT_NOTE[s.key]}
                    moreHref={more(s.key)}
                    cards={s.cards}
                    wide={s.key !== firstKey}
                    firstShelf={s.key === firstKey}
                />
            ))}
        </>
    );
}
