import Link from "next/link";
import { PosterOrText } from "./PosterOrText";
import { shortPeriod } from "@/lib/posters";
import { categoryLabel } from "@/lib/categories";

export type ShelfCard = {
    id: string;
    title: string;
    category: string;
    subcategory?: string | null;
    start: string | null;
    end: string | null;
    venue: string | null;
    imageUrl: string | null;
    posterPlaceholder?: boolean | null;
    source?: string | null;
    price?: string | null;   // 짧은 관람료 (없으면 숨김)
    note?: string | null;    // 피카가 본 이유 (사람이 쓴 값만)
    kidMark?: boolean;
    endingSoon?: boolean;
    isEnded?: boolean;
};

/** 선반 칸 하나 (시안 f01 .tile). 첫 묶음은 좁은 칸(104px), 나머지는 넓은 칸(146px) */
export function ShelfTile({ c, wide = false, priority = false }: { c: ShelfCard; wide?: boolean; priority?: boolean }) {
    // 꼬리표: «공연 · 뮤지컬», 세부가 없으면 «공연». 아이와는 뒤에 (specs/015 FR-009). 좁은 칸은 말줄임
    const base = categoryLabel(c.category, c.subcategory);
    const tag = c.kidMark ? `${base} · 아이와` : base;
    return (
        <Link href={`/events/${c.id}`} className={`block flex-none text-ink no-underline ${wide ? "w-[146px]" : "w-[104px]"}`}>
            <PosterOrText
                event={{ title: c.title, event_date_start: c.start, event_date_end: c.end, poster_image_url: c.imageUrl, poster_placeholder: c.posterPlaceholder, venue: c.venue, source: c.source }}
                className={c.isEnded ? "grayscale opacity-70" : ""}
                priority={priority}
            />
            <p className="mt-2 flex items-center gap-1.5 whitespace-nowrap text-[12px] font-bold text-accent">
                <span className="truncate">{tag}</span>
                <span className="pica-num text-[12.5px] font-semibold text-ink">{shortPeriod(c.start, c.end)}</span>
            </p>
            {c.endingSoon && !c.isEnded && <p className="text-[11.5px] font-bold text-ink">곧 끝남</p>}
            {c.isEnded && <p className="text-[11.5px] font-bold text-ink-soft">종료</p>}
            <h3 className={`mt-0.5 text-[14px] font-bold leading-[1.3] ${wide ? "pica-clamp-2" : "pica-clamp-3"}`}>{c.title}</h3>
            {c.venue && <p className="pica-clamp-2 mt-0.5 text-[12px] leading-[1.35] text-ink-soft">{c.venue}</p>}
            {c.price && <p className="mt-0.5 truncate text-[12px] font-bold">{c.price}</p>}
            {c.note && (
                <p className="mt-1.5 rounded-lg bg-accent-soft px-2 py-1.5 text-[12px] leading-[1.4]">
                    <b className="block text-[11px] font-bold text-accent">피카가 본 이유</b>
                    <span className="pica-clamp-3">{c.note}</span>
                </p>
            )}
        </Link>
    );
}

/** 날짜 묶음 선반 (specs/014 US1): 명조 묶음 이름 · 건수 · 정렬 기준 · «모두 보기», 아래 좌우로 넘기는 칸 */
export function Shelf({ id, title, count, sub, moreHref, cards, wide = false, firstShelf = false, max = 12 }: {
    id: string;
    title: string;
    count: number;
    sub?: string;
    moreHref?: string;
    cards: ShelfCard[];
    wide?: boolean;
    firstShelf?: boolean;
    max?: number;
}) {
    return (
        <section className="py-2.5" aria-labelledby={`sec-${id}`}>
            <div className="flex items-end justify-between gap-3 px-4 pb-3">
                <div className="min-w-0">
                    <h2 id={`sec-${id}`} className="pica-display flex items-baseline gap-[7px] text-[25px] leading-[1.15] tracking-[-0.5px] text-ink">
                        {title}<span className="pica-num text-[22px] font-semibold text-accent">{count}</span>
                    </h2>
                    {sub && <p className="mt-[3px] text-[12.5px] text-ink-soft">{sub}</p>}
                </div>
                {moreHref && (
                    <Link href={moreHref} className="shrink-0 whitespace-nowrap pb-0.5 text-[13px] font-semibold text-ink-soft hover:text-ink">모두 보기</Link>
                )}
            </div>
            <div className="pica-shelf-row">
                {cards.slice(0, max).map((c, i) => (
                    <ShelfTile key={c.id} c={c} wide={wide} priority={firstShelf && i < 3} />
                ))}
            </div>
        </section>
    );
}
