import Link from "next/link";
import { KAKAO_CHAT, TIP_EVENT_NAME, TIP_POINTS, couponOpen } from "@/lib/reports";
import { todayKST } from "@/lib/utils";

/**
 * 띠는 홈에만 둔다 (specs/023, 운영자 2026-11-27 «제보하기 기능이나 내용이 너무 많은데 좀 줄일 수 있는지»).
 * 홈 = `/` 와 지역 홈 `/region/…`(내 지역이 있는 사람은 그 화면이 홈이다). 상세·소개·단체 안내 등에는 두지 않는다
 */
export function showTipBand(pathname: string | null): boolean {
    const p = pathname || "/";
    return p === "/" || p.startsWith("/region/");
}

/** 홈 꼬리말 위 제보 띠 (specs/020, 이름·포인트 021). 사이트에서 직접 보내기 + 카카오톡 채널로 보내기 */
export function TipBand() {
    return (
        <section aria-labelledby="tip-band-title" className="border-t-2 border-line bg-[var(--pk-accent-soft)]">
            <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-9 sm:px-6 md:flex-row md:items-center md:justify-between md:py-11">
                <div className="min-w-0">
                    <h2 id="tip-band-title" className="pica-display text-[26px] leading-[1.25] text-ink sm:text-[30px]">{TIP_EVENT_NAME}</h2>
                    <p className="mt-2 text-[15.5px] leading-relaxed text-ink">
                        피카에 없는 행사를 알려 주세요. <b>피카에 실리면 {TIP_POINTS}포인트</b>{couponOpen(todayKST()) && <>, 12월까지는 <b>매주 5명께 커피 쿠폰</b>도 드려요</>}.
                    </p>
                </div>
                <div className="flex flex-none flex-col gap-2.5 sm:flex-row">
                    <Link href="/tip" className="flex h-14 items-center justify-center rounded-full bg-accent px-7 text-[17px] font-bold text-on-accent no-underline">
                        행사 제보하기
                    </Link>
                    <a href={KAKAO_CHAT} target="_blank" rel="noopener noreferrer"
                        className="flex h-14 items-center justify-center rounded-full border-[1.5px] border-ink bg-card px-6 text-[16px] font-bold text-ink no-underline">
                        카카오톡으로 보내기
                    </a>
                </div>
            </div>
        </section>
    );
}
