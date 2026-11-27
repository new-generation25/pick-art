import { ExternalLink } from "lucide-react";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { CountedLink } from "./EventCounter";

/**
 * 상세 아래 고정 막대 (specs/014 시안 f01 .bar): 찜 · 공유 · 초록 «원본 안내 페이지 열기».
 * 원본 안내 주소가 없는 «단체 제공» 행사(specs/013)는 그 사실을 적는다. 원본으로 나가는 것은 지금처럼 센다(outbound).
 */
export function StickyActions({ eventId, title, originalUrl, groupProvided }: {
    eventId: string;
    title: string;
    originalUrl: string | null;
    groupProvided: boolean;
}) {
    return (
        <div className="sticky bottom-0 z-[60] -mx-4 mt-8 flex items-center gap-2 border-t border-line bg-paper/95 px-3 pb-3 pt-2.5 backdrop-blur sm:mx-0 sm:rounded-t-2xl">
            <FavoriteButton eventId={eventId} />
            <ShareButton title={title} eventId={eventId} />
            {originalUrl ? (
                <CountedLink
                    eventId={eventId}
                    kind="outbound"
                    href={originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[16px] font-bold text-on-accent no-underline"
                >
                    <ExternalLink size={18} aria-hidden /> 원본 안내 페이지 열기
                </CountedLink>
            ) : (
                <span className="flex h-12 flex-1 items-center justify-center rounded-full border border-dashed border-ink-soft px-3 text-center text-[14px] font-bold text-ink">
                    {groupProvided ? "단체 제공 — 원본 안내 없음" : "원본 안내 없음"}
                </span>
            )}
        </div>
    );
}
