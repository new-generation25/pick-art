import type { Metadata } from "next";
import Link from "next/link";
import { getInstaEvents } from "@/lib/supabase";
import { formatPeriod, todayKST } from "@/lib/utils";
import { INSTA_DAYS, dayLabel, groupByPostedDay, regionCounts } from "@/lib/instaFeed";
import { EventList } from "@/components/ui/EventList";
import { INSTAGRAM_URL, InstagramIcon } from "@/components/ui/InstagramLink";

// 인스타 캡션의 「프로필 링크(피카 사이트)」로 들어온 사람이 방금 본 행사를 찾는 곳 (docs/plan/insta_inflow_design.md ②)
export const metadata: Metadata = {
    title: "인스타에서 본 행사 | 피카 pica",
    description: `피카 인스타그램 @picka.news 에 최근 ${INSTA_DAYS}일 동안 소개한 공연·전시·축제를 소개한 날 순서로 모았습니다.`,
    alternates: { canonical: "/insta" },
};

export const revalidate = 600;

export default async function InstaPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
    const { region } = await searchParams;
    const today = todayKST();
    const all = await getInstaEvents(INSTA_DAYS);
    const rows = region ? all.filter((e: any) => e.region === region) : all;
    const groups = groupByPostedDay(rows, today);
    const regions = regionCounts(all);

    const toCard = (e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        date: formatPeriod(e.event_date_start, e.event_date_end),
        location: e.venue || e.region,
        imageUrl: e.poster_image_url,
        isFree: e.is_free,
        isEnded: !!(e.event_date_end || e.event_date_start) && (e.event_date_end || e.event_date_start) < today,
    });
    const href = (r?: string) => (r ? `/insta?region=${encodeURIComponent(r)}` : "/insta");

    return (
        <main className="min-h-screen pb-20">
            <section className="border-b-2 border-line bg-paper">
                <div className="mx-auto max-w-6xl px-4 pb-6 pt-20 sm:px-6 sm:pt-24">
                    <p className="flex items-center gap-1.5 text-[14px] font-bold text-accent">
                        <InstagramIcon size={16} /> @picka.news
                    </p>
                    <h1 className="pica-display mt-2 text-[34px] leading-[1.15] text-ink sm:text-[48px]">인스타에서 본 행사</h1>
                    <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
                        최근 {INSTA_DAYS}일 동안 피카 인스타그램에 소개한 행사{" "}
                        <strong className="font-bold text-ink">{all.length}건</strong>
                        {region ? <>, 그중 {region} <strong className="font-bold text-ink">{rows.length}건</strong></> : null}을 소개한 날 순서로 모았습니다.
                        행사를 누르면 날짜·장소와 원본 안내 페이지가 나옵니다.
                    </p>
                    {regions.length > 1 && (
                        <nav aria-label="지역" className="pica-chiprow mt-5">
                            <Link href={href()} className="pica-chip" aria-current={!region ? "page" : undefined}>전체</Link>
                            {regions.map(({ region: r, n }) => (
                                <Link key={r} href={href(r)} className="pica-chip" aria-current={region === r ? "page" : undefined}>
                                    {r} <span className="tabular-nums opacity-70">{n}</span>
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
                {groups.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-[16px] text-ink">
                            {region ? `${region}에서 최근 ${INSTA_DAYS}일 동안 소개한 행사가 없습니다.` : `최근 ${INSTA_DAYS}일 동안 소개한 행사가 없습니다.`}
                        </p>
                        <p className="mt-2 text-[14px] text-ink-soft">
                            <Link href="/" className="font-bold text-ink underline underline-offset-4">전체 행사 보기</Link>
                        </p>
                    </div>
                ) : (
                    groups.map(g => (
                        <section key={g.day} className="mb-12 last:mb-0" aria-labelledby={`day-${g.day}`}>
                            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-line pb-2">
                                <h2 id={`day-${g.day}`} className="pica-display text-[24px] leading-none text-ink sm:text-[28px]">
                                    {dayLabel(g.day)}
                                </h2>
                                <span className="text-[14px] font-bold text-ink">{g.items.length}건</span>
                                <span className="text-[13px] text-ink-soft">{g.day === today ? "오늘 소개" : "소개"}</span>
                            </div>
                            <EventList initialEvents={g.items.map(toCard)} showEndNote={false} />
                        </section>
                    ))
                )}

                <p className="mt-12 text-center text-[14px] text-ink-soft">
                    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-ink underline underline-offset-4">
                        <InstagramIcon size={16} /> 인스타그램 @picka.news 에서 더 보기
                    </a>
                    {" · "}
                    <Link href="/" className="font-bold text-ink underline underline-offset-4">전체 행사</Link>
                </p>
            </div>
        </main>
    );
}
