import { MapPin } from "lucide-react";
import Link from "next/link";
import { ImageWithFallback } from "./ImageWithFallback";
import { todayKST } from "@/lib/utils";

interface EventProps {
    id: string;
    title: string;
    category: string;
    date: string;
    location: string;
    imageUrl: string;
    isFree?: boolean;
    isEnded?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * formatPeriod 가 만든 문자열('2026.11.04 ~ 11.06', '2026.11.04', '2025.01.01 ~ 2026.11.30')을
 * 날짜 표에 쓸 모양으로 나눈다. 표시만 바꾸고 날짜 값은 그대로다. 모양이 다르면(예: '일정 미정') null.
 */
function readPeriod(date: string, isEnded?: boolean) {
    const [startRaw, endRaw] = date.split(" ~ ");
    const s = startRaw?.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (!s) return null;
    const start = `${s[1]}.${s[2]}.${s[3]}`;
    const end = !endRaw ? start : endRaw.length === 5 ? `${s[1]}.${endRaw}` : endRaw;
    const today = todayKST().replace(/-/g, ".");
    const weekday = (d: string) => WEEKDAYS[new Date(d.replace(/\./g, "-") + "T00:00:00Z").getUTCDay()];

    if (isEnded || end < today) {
        return { top: end.slice(0, 4), big: end.slice(5), bottom: "끝난 날", tone: "ended" as const };
    }
    if (start <= today && end !== start) {
        // 이미 시작한 행사는 끝나는 날이 더 쓸모 있다
        const until = end === today ? "오늘까지" : end.slice(0, 4) === today.slice(0, 4) ? `${weekday(end)}요일까지` : `${end.slice(0, 4)}년까지`;
        return { top: "진행 중", big: end.slice(5), bottom: until, tone: "ongoing" as const };
    }
    if (end === start) {
        return { top: s[1], big: start.slice(5), bottom: `${weekday(start)}요일`, tone: "upcoming" as const };
    }
    const endShort = end.slice(0, 4) === s[1] ? end.slice(5) : end.slice(2);
    return { top: s[1], big: start.slice(5), bottom: `~ ${endShort}`, tone: "upcoming" as const };
}

export function EventCard({ event, priority = false, disableNavigation = false }: { event: EventProps; priority?: boolean; disableNavigation?: boolean }) {
    const period = readPeriod(event.date, event.isEnded);

    const CardContent = (
        <article
            className={[
                "pica-box group relative h-full overflow-hidden transition-colors",
                "flex flex-row sm:flex-col",
                disableNavigation ? "" : "hover:bg-paper",
            ].join(" ")}
            style={{ cursor: disableNavigation ? "pointer" : undefined }}
        >
            {/* 포스터: 모바일은 왼쪽 작은 썸네일, 넓은 화면은 위쪽 3:4 */}
            <div className="relative w-[92px] shrink-0 self-stretch bg-paper sm:w-full sm:self-auto sm:border-b-[length:var(--pk-border)] sm:border-line">
                <div className="relative h-full min-h-[124px] w-full sm:aspect-[3/4] sm:h-auto">
                    <ImageWithFallback
                        src={event.imageUrl || `https://picsum.photos/seed/${event.id}/400/600`}
                        alt={event.title}
                        fill
                        className={event.isEnded ? "object-cover grayscale opacity-70" : "object-cover"}
                        sizes="(max-width: 640px) 92px, (max-width: 1200px) 50vw, 25vw"
                        priority={priority}
                        fallbackText="포스터 없음"
                    />
                </div>
                {event.isEnded && (
                    <span className="absolute left-2 top-2 bg-ink px-2 py-0.5 text-[12px] font-bold text-paper">
                        종료
                    </span>
                )}
            </div>

            {/* 날짜 칸 + 정보 */}
            <div className="flex min-w-0 flex-1 flex-row">
                <div
                    className="pica-stub flex w-[78px] shrink-0 flex-col items-center justify-center px-1 py-3 text-center sm:border-l-0"
                    data-tone={period?.tone}
                    aria-label={event.date}
                >
                    {period ? (
                        <>
                            <span className="text-[11px] font-semibold leading-none text-ink-soft">{period.top}</span>
                            <span className="pica-stub-num mt-1.5 text-[24px] leading-none">{period.big}</span>
                            <span className="mt-1.5 text-[11px] font-medium leading-tight text-ink-soft">{period.bottom}</span>
                        </>
                    ) : (
                        <span className="text-[12px] font-semibold leading-tight text-ink-soft">{event.date}</span>
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="pica-cat" data-cat={event.category} data-ended={event.isEnded ? "true" : undefined}>
                            {event.category}
                        </span>
                        {event.isFree && (
                            <span className="pica-cat border-ink text-ink" style={{ borderColor: "currentColor" }}>무료</span>
                        )}
                    </div>
                    <h3
                        className={[
                            "line-clamp-2 text-[16px] font-bold leading-snug tracking-[-0.01em]",
                            event.isEnded ? "text-ink-soft" : "text-ink",
                        ].join(" ")}
                    >
                        {event.title}
                    </h3>
                    <p className="mt-auto flex min-w-0 items-center gap-1 text-[13px] text-ink-soft">
                        <MapPin size={13} className="shrink-0" aria-hidden />
                        <span className="truncate">{event.location}</span>
                    </p>
                </div>
            </div>
        </article>
    );

    if (disableNavigation) {
        return CardContent;
    }

    return (
        <Link
            href={`/events/${event.id}`}
            className="block h-full"
            style={{
                textDecoration: 'none',
                color: 'inherit',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
            }}
        >
            {CardContent}
        </Link>
    );
}
