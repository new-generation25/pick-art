import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { EventCard } from "@/components/ui/EventCard";
import { formatPeriod } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import type { PlaceEvent } from "@/lib/places";

/** 공간·단체 페이지 공용 화면 (specs/012). 다가오는 행사는 카드, 지난 행사는 날짜·제목 줄 */
export function PlacePage({ eyebrow, name, facts, actions, calendarQuery, upcoming, past, note }: {
    eyebrow: string;
    name: string;
    facts: { label: string; value: React.ReactNode }[];
    actions?: React.ReactNode;
    calendarQuery?: string; // 예: venue=<id>
    upcoming: PlaceEvent[];
    past: PlaceEvent[];
    note?: string;
}) {
    const ics = calendarQuery ? `${SITE_URL}/calendar.ics?${calendarQuery}` : null;
    const webcal = ics?.replace(/^https?:\/\//, "webcal://");
    const link = "inline-flex items-center gap-1 underline-offset-4 hover:text-ink hover:underline";
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
                <Link href="/" className="inline-flex items-center gap-1.5 rounded-md py-1 text-[14px] font-semibold text-ink-soft hover:text-ink">
                    <ArrowLeft className="h-4 w-4" aria-hidden /> 행사 목록
                </Link>
                <p className="mt-4 text-[14px] font-bold text-accent">{eyebrow}</p>
                <h1 className="pica-display mt-1 text-[30px] leading-[1.2] text-ink sm:text-[44px]">{name}</h1>

                {facts.length > 0 && (
                    <dl className="pica-box mt-6 max-w-[720px] divide-y divide-line">
                        {facts.map(f => (
                            <div key={f.label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:px-5">
                                <dt className="text-[14px] font-semibold text-ink-soft">{f.label}</dt>
                                <dd className="min-w-0 text-[15px] font-semibold text-ink">{f.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
                {actions && <div className="mt-4 max-w-[400px]">{actions}</div>}
                {ics && (
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-ink-soft">
                        <span className="inline-flex items-center gap-1"><CalendarPlus className="h-4 w-4" aria-hidden /> 이곳 일정 캘린더로 받기</span>
                        <a className={link} href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal!)}`} target="_blank" rel="noopener noreferrer">구글</a>
                        <a className={link} href={webcal!}>애플·기타</a>
                    </p>
                )}

                <section className="mt-10">
                    <h2 className="pica-display text-[24px] text-ink">다가오는 행사 <span className="text-[18px] text-ink-soft">{upcoming.length}건</span></h2>
                    {upcoming.length === 0 ? (
                        <p className="mt-3 text-[15px] text-ink-soft">지금 올라온 행사가 없습니다.</p>
                    ) : (
                        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                            {upcoming.map(e => (
                                <EventCard key={e.id} event={{
                                    id: e.id, title: e.title, category: e.category,
                                    date: formatPeriod(e.event_date_start, e.event_date_end),
                                    location: e.venue || e.region || "", imageUrl: e.poster_image_url ?? "", isFree: !!e.is_free,
                                }} />
                            ))}
                        </div>
                    )}
                </section>

                {past.length > 0 && (
                    <section className="mt-12">
                        <h2 className="pica-display text-[22px] text-ink">지난 행사 <span className="text-[16px] text-ink-soft">최근 1년</span></h2>
                        <ul className="mt-3 max-w-[720px] divide-y divide-line border-y border-line">
                            {past.map(e => (
                                <li key={e.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5 text-[15px]">
                                    <span className="tabular-nums text-ink-soft">{formatPeriod(e.event_date_start, e.event_date_end)}</span>
                                    <Link href={`/events/${e.id}`} className="min-w-0 truncate font-semibold text-ink hover:underline">{e.title}</Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {note && <p className="mt-10 max-w-[720px] border-[1.5px] border-dashed border-line px-4 py-3 text-[14px] leading-relaxed text-ink">{note}</p>}
            </div>
        </main>
    );
}
