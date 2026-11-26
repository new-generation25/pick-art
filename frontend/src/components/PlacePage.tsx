import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, CalendarPlus, Landmark, Users } from "lucide-react";
import { ShelfTile } from "@/components/ui/Shelf";
import { AdminPartnerControl } from "@/components/ui/AdminPartnerControl";
import { formatPeriod, todayKST } from "@/lib/utils";
import { isEndingSoon } from "@/lib/eventDetails";
import { SITE_URL } from "@/lib/site";
import type { Host, PlaceEvent } from "@/lib/places";

const LONG_DAYS = 32;
const days = (a: string, b: string) => (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000;

/** 협약 도장 (시안 f01 .seal) */
export function PartnerSeal({ label = "협약", small = false }: { label?: string; small?: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-accent font-bold text-white ${small ? "h-5 px-1.5 text-[11px]" : "h-6 pl-[7px] pr-[9px] text-[12px]"}`}>
            <BadgeCheck className={small ? "h-3 w-3" : "h-[15px] w-[15px]"} aria-hidden />{label}
        </span>
    );
}

/**
 * 공간·단체 페이지 공용 화면 (specs/012 → 014 시안 f01).
 * 머리 띠(«공간 · 지역», 협약 배지, 명조 이름, 객석·다가오는 행사 수·휴관일) → 길찾기·캘린더 → 다가오는 행사 선반 →
 * 상시 한 줄씩 → 이곳 행사를 여는 곳(공간만) → 지난 행사 최근 1년 → 안내. 작은 지도는 두지 않는다(운영자 «그냥 버튼»).
 */
export function PlacePage({ eyebrow, kindIcon = "venue", name, partnerSince, facts, actions, calendarQuery, upcoming, past, hosts, note, admin }: {
    eyebrow: string;
    kindIcon?: "venue" | "기관" | "단체";
    name: string;
    partnerSince?: string | null;
    facts: { label: string; value: React.ReactNode }[];
    actions?: React.ReactNode;
    calendarQuery?: string;
    upcoming: PlaceEvent[];
    past: PlaceEvent[];
    hosts?: Host[];
    note?: string;
    admin?: { table: "venues" | "orgs"; id: string };
}) {
    const ics = calendarQuery ? `${SITE_URL}/calendar.ics?${calendarQuery}` : null;
    const webcal = ics?.replace(/^https?:\/\//, "webcal://");
    const today = todayKST();
    const isLong = (e: PlaceEvent) => !!e.event_date_start && !!e.event_date_end && days(e.event_date_start, e.event_date_end) + 1 >= LONG_DAYS;
    const shelf = upcoming.filter(e => !isLong(e));
    const long = upcoming.filter(isLong);
    const toCard = (e: PlaceEvent) => ({
        id: e.id, title: e.title, category: e.category, start: e.event_date_start, end: e.event_date_end,
        venue: e.venue || e.region, imageUrl: e.poster_image_url, posterPlaceholder: e.poster_placeholder, source: e.source,
        price: e.is_free ? "무료" : null, endingSoon: isEndingSoon(e, today),
    });
    const KindIcon = kindIcon === "기관" ? Landmark : kindIcon === "단체" ? Users : Building2;

    return (
        <main className="min-h-screen pb-16">
            {/* 머리 띠 */}
            <div className="bg-soft px-4 pb-[22px]">
                <div className="mx-auto max-w-6xl">
                    <div className="-mx-2.5 flex h-[52px] items-center">
                        <Link href="/" className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-[14px] font-semibold text-ink-soft hover:text-ink">
                            <ArrowLeft className="h-5 w-5" aria-hidden /> 행사 목록
                        </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-[5px] text-[13px] font-bold text-ink-soft"><KindIcon className="h-[17px] w-[17px]" aria-hidden />{eyebrow}</span>
                        {partnerSince && <PartnerSeal label={kindIcon === "venue" ? "협약 공간" : "협약 단체"} />}
                    </div>
                    <h1 className="pica-display mt-2 text-[29px] leading-[1.25] tracking-[-0.5px] text-ink">{name}</h1>
                    <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[14px] text-ink-soft">
                        {facts.map(f => <span key={f.label}>{f.label} <b className="font-bold text-ink">{f.value}</b></span>)}
                        <span>다가오는 행사 <b className="pica-num font-bold text-ink">{upcoming.length}</b>건</span>
                    </p>
                    <div className="mt-3 flex gap-2">
                        {actions}
                        {ics && (
                            <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal!)}`} target="_blank" rel="noopener noreferrer"
                                className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-card text-[15px] font-bold text-ink shadow-[0_0_0_1px_var(--pk-line)]">
                                <CalendarPlus className="h-[18px] w-[18px]" aria-hidden /> 일정 캘린더로 받기
                            </a>
                        )}
                    </div>
                    {ics && <p className="mt-1.5 text-right text-[12px] text-ink-soft">애플·기타 캘린더: <a href={webcal!} className="underline">구독 주소 열기</a></p>}
                    {admin && <AdminPartnerControl table={admin.table} id={admin.id} since={partnerSince ?? null} />}
                </div>
            </div>

            <div className="mx-auto max-w-6xl">
                {/* 다가오는 행사 */}
                <section className="pt-[22px]">
                    <div className="flex items-end justify-between px-4 pb-3">
                        <h2 className="pica-display flex items-baseline gap-[7px] text-[22px] text-ink">다가오는 행사<span className="pica-num text-[20px] font-semibold text-accent">{shelf.length}</span></h2>
                        <span className="text-[12.5px] text-ink-soft">시작하는 날 순</span>
                    </div>
                    {shelf.length === 0 ? (
                        <p className="px-4 text-[15px] text-ink-soft">지금 올라온 행사가 없습니다.</p>
                    ) : (
                        <div className="pica-shelf-row">{shelf.slice(0, 20).map(e => <ShelfTile key={e.id} c={toCard(e)} />)}</div>
                    )}
                </section>

                {/* 상시·장기 */}
                {long.map(e => (
                    <Link key={e.id} href={`/events/${e.id}`} className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl bg-card px-3.5 py-3 text-[14px] text-ink no-underline shadow-[0_0_0_1px_var(--pk-line)]">
                        <em className="flex-none text-[12px] font-bold not-italic text-accent">상시</em>
                        <span className="min-w-0 flex-1 truncate font-semibold">{e.title}</span>
                        <small className="pica-num flex-none text-[12.5px] text-ink-soft">~{(e.event_date_end || "").slice(0, 7).replace("-", ".")}</small>
                    </Link>
                ))}

                {/* 이곳 행사를 여는 곳 (공간만) */}
                {hosts && hosts.length > 0 && (
                    <section className="pt-7">
                        <h2 className="pica-display px-4 pb-2 text-[22px] text-ink">이곳 행사를 여는 곳</h2>
                        <ul className="mx-4">
                            {hosts.map(h => (
                                <li key={h.org.id}>
                                    <Link href={`/orgs/${h.org.id}`} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line py-2.5 text-ink no-underline">
                                        <span className={`grid h-10 w-10 place-items-center rounded-full ${h.org.kind === "기관" ? "bg-ink text-white" : "bg-card shadow-[0_0_0_1px_var(--pk-line)]"}`}>
                                            {h.org.kind === "기관" ? <Landmark className="h-[19px] w-[19px]" aria-hidden /> : <Users className="h-[19px] w-[19px]" aria-hidden />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-bold leading-[1.35]">{h.org.name}{h.org.partner_since && <PartnerSeal small />}</span>
                                            <span className="mt-px block text-[12.5px] text-ink-soft">{h.org.kind === "기관" ? "기관" : "단체"} · {h.roles.join("·")}</span>
                                        </span>
                                        <span className="pica-num whitespace-nowrap text-[13px] font-semibold text-ink-soft">{h.count}건</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <p className="mx-4 mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12px] text-ink-soft">
                            <span className="inline-flex items-center gap-[5px]"><span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-ink text-white"><Landmark className="h-[13px] w-[13px]" aria-hidden /></span>기관</span>
                            <span className="inline-flex items-center gap-[5px]"><span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-card shadow-[0_0_0_1px_var(--pk-line)]"><Users className="h-[13px] w-[13px]" aria-hidden /></span>단체</span>
                            <span className="inline-flex items-center gap-[5px]"><PartnerSeal small />정보 제공 협약을 맺은 곳</span>
                        </p>
                    </section>
                )}

                {/* 지난 행사 */}
                {past.length > 0 && (
                    <section className="pt-7">
                        <h2 className="pica-display px-4 pb-1 text-[22px] text-ink">지난 행사 <span className="text-[14px] font-normal text-ink-soft" style={{ fontFamily: "inherit" }}>최근 1년 {past.length}건</span></h2>
                        <ul className="mx-4">
                            {past.map(e => (
                                <li key={e.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 border-b border-line py-2.5 text-[14px]">
                                    <span className="pica-num text-[13px] text-ink-soft">{formatPeriod(e.event_date_start, e.event_date_end).replace(/^\d{4}\./, "")}</span>
                                    <Link href={`/events/${e.id}`} className="min-w-0 truncate font-semibold text-ink hover:underline">{e.title}</Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {note && <p className="mx-4 mb-6 mt-5 rounded-xl border-[1.5px] border-dashed border-line px-3.5 py-3 text-[13px] leading-[1.6] text-ink-soft">{note}</p>}
            </div>
        </main>
    );
}
