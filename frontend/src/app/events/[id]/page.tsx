import { formatPeriod, todayKST } from "@/lib/utils";
import { getEventById, getPublishedEvents } from "@/lib/supabase";
import { Calendar, MapPin, ExternalLink, ArrowLeft, Info, Ticket, Baby } from "lucide-react";
import { kidsInfo } from "@/lib/kids";
import { splitDescription } from "@/lib/eventDetails";
import { Clock, CalendarX, Armchair } from "lucide-react";
import { AdminNoteControl } from "@/components/ui/AdminNoteControl";
import { getVenueInfo } from "@/lib/supabase";
import { AdminKidsControl } from "@/components/ui/AdminKidsControl";
import { ReportButton } from "@/components/ui/ReportButton";
import { PosterViewer } from "@/components/ui/PosterViewer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { PosterOrText } from "@/components/ui/PosterOrText";
import { StickyActions } from "@/components/ui/StickyActions";
import { RouteButtons } from "@/components/ui/RouteButtons";
import { AdminPosterControl } from "@/components/ui/AdminPosterControl";
import { AdminGenreControl } from "@/components/ui/AdminGenreControl";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { AdminInstaMark } from "@/components/ui/AdminInstaMark";
import { CountedLink, EventViewCounter } from "@/components/ui/EventCounter";
import { getEventOrgs } from "@/lib/places";
import { isGroupProvided } from "@/lib/leaflets";
import { maskPersonalPhones } from "@/lib/privacy";
import { Users, Building2 } from "lucide-react";

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
    const description = maskPersonalPhones(event.description)?.trim().slice(0, 160)
        || `${formatPeriod(event.event_date_start, event.event_date_end)}${where ? ` · ${where}` : ""}`;
    const url = `/events/${event.id}`;
    // 포스터가 없으면 기본 공유 이미지
    // 포스터가 없거나 안내 그림(specs/014)이면 기본 공유 이미지
    const images = event.poster_image_url && !event.poster_placeholder ? [event.poster_image_url] : [DEFAULT_OG_IMAGE.url];

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

    // 같은 지역에서 이 행사와 가까운 날에 시작하는 행사 4건 (시안 f01 «같은 주 ○○ 행사»)
    const sameRegion = event.region ? await getPublishedEvents({ region: event.region }) : [];
    const pivot = event.event_date_start || event.event_date_end || todayKST();
    const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
    const nearby = sameRegion
        .filter((e: any) => e.id !== event.id && e.event_date_start && Math.abs(dayNum(e.event_date_start) - dayNum(pivot)) <= 7)
        .sort((a: any, b: any) => Math.abs(dayNum(a.event_date_start) - dayNum(pivot)) - Math.abs(dayNum(b.event_date_start) - dayNum(pivot)))
        .slice(0, 4);

    const isEnded = !!event.event_date_end && event.event_date_end < todayKST();
    // 원본 안내 주소가 있는 행사만 «원본 안내 페이지 열기». 단체 제공(specs/013)은 공식 페이지가 없을 수 있다
    const hasOriginal = typeof event.original_url === "string" && /^https?:\/\//.test(event.original_url);
    const groupProvided = isGroupProvided(event.source);
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
    // 개인 휴대전화는 피카 화면에 보이지 않게 가리고 원본 안내에서 확인하게 한다(운영자 11/26)
    const detail = splitDescription(maskPersonalPhones(event.description));
    facts.splice(1, 0, ...detail.rows.map(r => ({ icon: r.label === "공연 시각" ? Clock : Info, label: r.label, value: r.value })));
    // 장소 정보 (specs/009): 휴관일은 전시에, 객석 수는 공연에. 공식 안내로 확인해 넣은 값만 있다
    const venueInfo = await getVenueInfo(event.venue_id);
    const placeAt = facts.findIndex(f => f.label === "장소") + 1;
    const placeRows: typeof facts = [];
    if (venueInfo?.closed_days && event.category === "전시") placeRows.push({ icon: CalendarX, label: "휴관일", value: venueInfo.closed_days });
    if (venueInfo?.capacity && event.category === "공연") placeRows.push({ icon: Armchair, label: "객석", value: `${venueInfo.capacity.toLocaleString()}석` });
    if (placeRows.length) facts.splice(placeAt, 0, ...placeRows);
    // 주최·주관 (specs/012): 이 행사에 이어진 기관·단체. 단체 페이지로 잇는다 (인스타 게시 계정은 «올린 곳»)
    const eventOrgs = await getEventOrgs(event.id);
    const hostOrgs = eventOrgs.filter(o => o.role !== "게시");
    const postOrgs = eventOrgs.filter(o => o.role === "게시");
    const orgLinks = (list: typeof eventOrgs) => [...new Map(list.map(o => [o.org.id, o.org])).values()];
    const orgRows: { label: string; orgs: { id: string; name: string }[] }[] = [];
    if (hostOrgs.length) orgRows.push({ label: "주최·주관", orgs: orgLinks(hostOrgs) });
    if (postOrgs.length) orgRows.push({ label: "올린 곳", orgs: orgLinks(postOrgs) });
    const hasVenuePage = !!venueInfo && !!event.venue_id;

    const timeRow = detail.rows.find(r => r.label === "공연 시각");
    const infoRows = facts.filter(f => f.label !== "기간" && f.label !== "장소" && f.label !== "공연 시각");
    const where = event.venue || event.region || "장소 정보 없음";
    const posterEvent = {
        title: event.title, event_date_start: event.event_date_start, event_date_end: event.event_date_end,
        poster_image_url: event.poster_image_url, poster_placeholder: event.poster_placeholder, venue: event.venue, source: event.source,
    };
    const longDate = (() => {
        const W = ["일", "월", "화", "수", "목", "금", "토"];
        const s0 = event.event_date_start || event.event_date_end;
        const e0 = event.event_date_end || s0;
        if (!s0) return "일정 미정";
        const wd = (d: string) => W[new Date(d + "T00:00:00Z").getUTCDay()];
        const f = (d: string) => d.replace(/-/g, ".");
        return s0 === e0 ? `${f(s0)} ${wd(s0)}요일` : `${f(s0)} ~ ${e0.slice(0, 4) === s0.slice(0, 4) ? f(e0).slice(5) : f(e0)}`;
    })();

    return (
        <main className="min-h-screen">
            {/* 조회 수 (specs/011): 날짜별 숫자만 센다 */}
            <EventViewCounter eventId={event.id} />

            {/* 맨 위 띠: 가운데 포스터 (시안 f01) */}
            <div className="bg-soft pb-10">
                <div className="mx-auto flex h-[52px] max-w-3xl items-center justify-between px-2">
                    <Link href="/" className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-[14px] font-semibold text-ink-soft hover:text-ink">
                        <ArrowLeft className="h-5 w-5" aria-hidden /> 행사 목록
                    </Link>
                    <span className="pr-3 text-[13px] font-semibold text-ink-soft">{event.region}</span>
                </div>
                <PosterViewer src={event.poster_image_url} alt={event.title} ended={isEnded} event={posterEvent} />
                <div className="mx-auto max-w-[400px] px-4">
                    <AdminPosterControl sha256={event.poster_sha256 ?? null} placeholder={!!event.poster_placeholder} />
                </div>
            </div>

            {/* 겹쳐 올라오는 요약 카드 */}
            <div className="relative mx-auto -mt-[22px] max-w-3xl rounded-t-[22px] bg-paper px-4 pb-2 pt-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-[5px]">
                    <span className="pica-cat" data-cat={event.category}>{event.category}</span>
                    {event.subcategory && <span className="pica-cat" data-cat={event.category}>{event.subcategory}</span>}
                    {kids.group === "target" && <span className="pica-cat" data-cat={event.category}>아이와</span>}
                    {event.is_free && <span className="inline-flex h-[22px] items-center rounded-md px-[7px] text-[12px] font-bold text-ink shadow-[inset_0_0_0_1px_#CFC5B4]">무료</span>}
                    {isEnded && <span className="inline-flex h-[22px] items-center rounded-md bg-ink px-[7px] text-[12px] font-bold text-white">종료</span>}
                    {groupProvided && (
                        <span className="inline-flex h-[22px] items-center rounded-md px-[7px] text-[12px] font-bold text-ink shadow-[inset_0_0_0_1px_#CFC5B4]" title="단체가 피카에 리플렛으로 직접 알려 준 행사">단체 제공</span>
                    )}
                </div>
                <h1 className="pica-display mt-2 text-[26px] leading-[1.3] tracking-[-0.5px] text-ink sm:text-[32px]">{event.title}</h1>
                <p className="pica-num mt-1.5 text-[15.5px] font-semibold text-ink">{longDate}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-ink-soft">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    {hasVenuePage ? <Link href={`/venues/${event.venue_id}`} className="hover:text-ink hover:underline">{where}</Link> : where}
                </p>

                {/* 길찾기 · 공간 정보 (작은 지도는 두지 않는다 — 운영자 11/26 «그냥 버튼») */}
                <div className="mt-3.5 flex gap-2">
                    {(event.venue || venueInfo?.name) && (
                        <RouteButtons block appname={new URL(SITE_URL).host}
                            e={{ venue: venueInfo?.name || event.venue, title: event.title, region: event.region, coords: venueInfo?.lat && venueInfo?.lng ? { lat: venueInfo.lat, lng: venueInfo.lng } : null }} />
                    )}
                    {hasVenuePage && (
                        <Link href={`/venues/${event.venue_id}`} className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-card text-[15px] font-bold text-ink shadow-[0_0_0_1px_var(--pk-line)]">
                            <Building2 className="h-[18px] w-[18px]" aria-hidden /> 공간 정보
                        </Link>
                    )}
                </div>

                {/* 정보 줄: 시각 · 관람료 · 관람 · 공간 · 출처 · 주최·주관 */}
                <ul className="mt-4 border-t border-line">
                    {timeRow && <InfoRow icon={Clock} label="시각" value={timeRow.value} />}
                    {infoRows.map(f => (
                        <InfoRow key={f.label} icon={f.icon} label={f.label === "관람 연령" ? "관람" : f.label}
                            value={f.label === "출처" && hasOriginal ? (
                                <CountedLink eventId={event.id} kind="outbound" href={event.original_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">{f.value}</CountedLink>
                            ) : f.value}
                            extra={f.label === "출처" && typeof event.insta_post_url === "string" ? <AdminInstaMark url={event.insta_post_url} postedAt={event.insta_posted_at} /> : null} />
                    ))}
                    {orgRows.map(r => (
                        <InfoRow key={r.label} icon={Users} label={r.label} value={
                            <span className="flex flex-wrap gap-x-3 gap-y-1">
                                {r.orgs.map(o => <Link key={o.id} href={`/orgs/${o.id}`} className="underline underline-offset-4 hover:text-accent">{o.name}</Link>)}
                            </span>
                        } />
                    ))}
                </ul>
                <AdminGenreControl eventId={event.id} category={event.category} sub={event.subcategory ?? null} by={event.subcategory_by ?? null} pending={!!event.subcategory_pending} evidence={event.subcategory_evidence} />
                <AdminKidsControl eventId={event.id} override={event.kids_override ?? null} ruleGroup={ruleKids.group} />

                {/* 피카가 본 이유 (specs/009): 사람이 쓴 한 줄. 없으면 보이지 않는다 */}
                {typeof event.pica_note === "string" && event.pica_note.trim() && (
                    <p className="mt-4 rounded-[14px] bg-[#F8FBF9] px-4 py-3.5 text-[15px] leading-[1.6] text-ink shadow-[inset_0_0_0_1.5px_var(--pk-accent)]">
                        <em className="mb-[3px] block text-[12px] font-bold not-italic text-accent">피카가 본 이유</em>
                        {event.pica_note}
                    </p>
                )}
                <AdminNoteControl eventId={event.id} note={event.pica_note ?? null} />

                <p className="mt-3 text-[13px] leading-[1.6] text-ink-soft">
                    수집한 정보를 정리한 것이라 바뀔 수 있어요. 일정과 예매는 원본 안내 페이지에서 확인해 주세요.{" "}
                    <Link href="/about" className="font-bold text-ink underline underline-offset-[3px]">피카가 고르는 기준</Link>
                </p>

                {/* 상세 안내: 설명이 전부 정보 칸으로 옮겨졌으면(KOPIS) 따로 두지 않는다. 개인 휴대전화는 가림 */}
                {(detail.rest || detail.rows.length === 0) && (
                    <section className="mt-7">
                        <h2 className="pica-display text-[19px] tracking-[-0.3px] text-ink">상세 안내</h2>
                        <div className="mt-2 max-w-[68ch] whitespace-pre-wrap text-[15.5px] leading-[1.8] text-ink">
                            {detail.rest || (hasOriginal ? "상세 안내가 없습니다. 원본 안내 페이지에서 확인해 주세요." : "상세 안내가 없습니다.")}
                        </div>
                    </section>
                )}

                {/* 같은 주 같은 지역 행사 */}
                {nearby.length > 0 && (
                    <section className="mt-7">
                        <h2 className="pica-display text-[19px] tracking-[-0.3px] text-ink">같은 주 {event.region} 행사</h2>
                        <ul className="mt-1">
                            {nearby.map((e: any) => (
                                <li key={e.id}>
                                    <Link href={`/events/${e.id}`} className="flex items-center gap-3 border-b border-line py-3 text-ink no-underline">
                                        <PosterOrText event={e} size="row" className="!w-[44px] flex-none !rounded-md" />
                                        <span className="min-w-0">
                                            <span className="pica-num block text-[12.5px] font-semibold text-accent">{formatPeriod(e.event_date_start, e.event_date_end)}</span>
                                            <span className="block truncate text-[14.5px] font-bold leading-[1.4]">{e.title}</span>
                                            <span className="block truncate text-[12.5px] text-ink-soft">{[e.venue, e.is_free ? "무료" : e.price_info].filter(Boolean).join(" · ")}</span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 캘린더 추가 · 오류 신고 (specs/008·007) */}
                <div className="mt-6"><AddToCalendar event={{ ...event, url: `${SITE_URL}/events/${event.id}` }} /></div>
                <div className="mt-3"><ReportButton eventId={event.id} /></div>

                {/* 아래 고정 막대: 찜 · 공유 · 원본 안내 페이지 열기 */}
                <StickyActions eventId={event.id} title={event.title} originalUrl={hasOriginal ? event.original_url : null} groupProvided={groupProvided} />
            </div>
        </main>
    );
}

function InfoRow({ icon: Icon, label, value, extra }: { icon: typeof Calendar; label: string; value: React.ReactNode; extra?: React.ReactNode }) {
    return (
        <li className="grid grid-cols-[22px_58px_minmax(0,1fr)] items-start gap-2 border-b border-line py-[13px] text-[14.5px] leading-[1.55]">
            <Icon className="mt-0.5 h-[18px] w-[18px] text-ink-soft" aria-hidden />
            <span className="pt-px text-[13.5px] text-ink-soft">{label}</span>
            <span className="min-w-0 font-semibold text-ink">{value}{extra}</span>
        </li>
    );
}
