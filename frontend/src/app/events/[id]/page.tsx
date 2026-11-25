import { Header } from "@/components/ui/Header";
import { formatPeriod, todayKST } from "@/lib/utils";
import { getEventById, getPublishedEvents } from "@/lib/supabase";
import { Calendar, MapPin, ExternalLink, ArrowLeft, Info, Ticket, Baby } from "lucide-react";
import { kidsInfo } from "@/lib/kids";
import { splitDescription } from "@/lib/eventDetails";
import { Clock } from "lucide-react";
import { AdminKidsControl } from "@/components/ui/AdminKidsControl";
import { ShareButton } from "@/components/ui/ShareButton";
import { PosterViewer } from "@/components/ui/PosterViewer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { EventCard } from "@/components/ui/EventCard";
import { DEFAULT_OG_IMAGE } from "@/lib/site";
import { AdminInstaMark } from "@/components/ui/AdminInstaMark";

interface EventPageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
    const { id } = await params;
    const event = await getEventById(id);

    if (!event) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };

    const where = [event.venue, event.region].filter(Boolean).join(", ");
    const description = event.description?.trim().slice(0, 160)
        || `${formatPeriod(event.event_date_start, event.event_date_end)}${where ? ` · ${where}` : ""}`;
    const url = `/events/${event.id}`;
    // 포스터가 없으면 기본 공유 이미지
    const images = event.poster_image_url ? [event.poster_image_url] : [DEFAULT_OG_IMAGE.url];

    return {
        title: `${event.title} | 피카 pica`,
        description,
        alternates: { canonical: url },
        openGraph: {
            title: event.title,
            description,
            url,
            type: "article",
            siteName: "피카 pica",
            locale: "ko_KR",
            images,
        },
        twitter: {
            card: "summary_large_image",
            title: event.title,
            description,
            images,
        }
    };
}

export default async function EventDetailPage({ params }: EventPageProps) {
    const { id } = await params;
    const event = await getEventById(id);

    // 없는 행사·비공개 행사(RLS로 익명 조회 결과 없음) 모두 404
    if (!event) notFound();

    // Related Events (Same category or region, excluding current)
    const allRelated = await getPublishedEvents({ category: event.category });
    const suggestions = allRelated
        .filter(e => e.id !== event.id)
        .slice(0, 3)
        .map(e => ({
            id: e.id,
            title: e.title,
            category: e.category,
            date: formatPeriod(e.event_date_start, e.event_date_end),
            location: e.venue || e.region,
            imageUrl: e.poster_image_url,
            isFree: e.is_free,
        }));

    const isEnded = !!event.event_date_end && event.event_date_end < todayKST();
    const facts: { icon: typeof Calendar; label: string; value: string }[] = [
        { icon: Calendar, label: "기간", value: formatPeriod(event.event_date_start, event.event_date_end) },
        { icon: MapPin, label: "장소", value: event.venue || "정보 없음" },
        { icon: Ticket, label: "관람료", value: event.price_info || (event.is_free ? "무료" : "정보 없음") },
        { icon: Info, label: "출처", value: event.source || "정보 없음" },
    ];
    // 원본에 관람 연령이 적혀 있으면 원문 그대로 (specs/004 FR-008). 운영자 수정 전의 규칙 결과는 관리자 칸에 보인다
    const kids = kidsInfo(event);
    const ruleKids = kidsInfo({ ...event, kids_override: null });
    if (kids.ageText) facts.splice(3, 0, { icon: Baby, label: "관람 연령", value: kids.ageText });
    // 설명의 「일시·러닝타임·출연·장르: 값」 줄은 칸으로 (specs/006). 상세 안내에는 나머지 글만
    const detail = splitDescription(event.description);
    facts.splice(1, 0, ...detail.rows.map(r => ({ icon: r.label === "공연 시각" ? Clock : Info, label: r.label, value: r.value })));

    return (
        <main className="min-h-screen pb-20">
            {/* layout.tsx에 이미 Header가 있으므로 여기서 제거합니다. */}
            <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 rounded-md py-1 text-[14px] font-semibold text-ink-soft hover:text-ink"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    행사 목록
                </Link>

                <div className="mt-4 grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-12">
                    {/* 포스터 + 바로가기 */}
                    <div>
                        <div className="lg:sticky lg:top-24">
                            <PosterViewer src={event.poster_image_url} alt={event.title} ended={isEnded} />

                            <div className="mx-auto mt-4 flex max-w-[400px] gap-2">
                                <a
                                    href={event.original_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 border-[1.5px] border-ink bg-accent px-5 text-[15px] font-bold text-on-accent transition-colors hover:bg-ink"
                                >
                                    <ExternalLink className="h-4 w-4" aria-hidden />
                                    원본 안내 페이지 열기
                                </a>
                                <ShareButton title={event.title} />
                            </div>
                        </div>
                    </div>

                    {/* 행사 정보 */}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                            <span className="pica-cat" data-cat={event.category}>{event.category}</span>
                            <span className="text-ink-soft">{event.region}</span>
                            {event.is_free && (
                                <span className="pica-cat text-ink" style={{ borderColor: "currentColor" }}>무료</span>
                            )}
                            {isEnded && (
                                <span className="bg-ink px-2 py-0.5 text-[13px] font-bold text-paper">종료</span>
                            )}
                        </div>

                        <h1 className="pica-display mt-3 text-[30px] leading-[1.2] text-ink sm:text-[44px]">
                            {event.title}
                        </h1>

                        {/* 기간, 장소, 관람료, 출처 */}
                        <dl className="pica-box mt-6 divide-y divide-line">
                            {facts.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 px-4 py-3.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:px-5">
                                    <dt className="flex items-center gap-2 text-[14px] font-semibold text-ink-soft">
                                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                                        {label}
                                    </dt>
                                    <dd
                                        className={[
                                            "min-w-0",
                                            label === "기간" ? "pica-display text-[22px] text-accent tabular-nums" : "text-[15px] font-semibold text-ink",
                                        ].join(" ")}
                                    >
                                        {label === "출처" && typeof event.original_url === "string" && /^https?:\/\//.test(event.original_url) ? (
                                            <a href={event.original_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
                                                {value}
                                            </a>
                                        ) : value}
                                        {/* 피카 인스타에 소개한 행사: 관리자에게만 아이콘 (events.insta_post_url) */}
                                        {label === "출처" && typeof event.insta_post_url === "string" && (
                                            <AdminInstaMark url={event.insta_post_url} postedAt={event.insta_posted_at} />
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <AdminKidsControl eventId={event.id} override={event.kids_override ?? null} ruleGroup={ruleKids.group} />

                        {/* 상세 안내: 설명이 전부 정보 표 칸으로 옮겨졌으면(KOPIS) 따로 두지 않는다 */}
                        {(detail.rest || detail.rows.length === 0) && (
                            <section className="mt-10">
                                <h2 className="pica-display text-[24px] text-ink">상세 안내</h2>
                                <div className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[16px] leading-[1.85] text-ink sm:text-[17px]">
                                    {detail.rest || "상세 안내가 없습니다. 원본 안내 페이지에서 확인해 주세요."}
                                </div>
                            </section>
                        )}

                        <p className="mt-10 flex gap-2.5 border-[1.5px] border-dashed border-line px-4 py-3.5 text-[14px] leading-relaxed text-ink">
                            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                            <span>
                                수집한 정보를 정리한 것이라 주최 측 사정으로 바뀔 수 있습니다. 일정과 예매는{" "}
                                <b>원본 안내 페이지</b>에서 확인해 주세요.
                            </span>
                        </p>
                    </div>
                </div>

                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                    <section className="mt-16 border-t-2 border-line pt-10">
                        <h2 className="pica-display text-[26px] text-ink">같은 분야의 다른 행사</h2>
                        <p className="mt-1 text-[14px] text-ink-soft">가까운 곳에서 열리는 {event.category} 행사를 더 골랐습니다.</p>
                        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                            {suggestions.map((suggestion) => (
                                <EventCard key={suggestion.id} event={suggestion} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
