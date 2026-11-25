import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { CalendarSubscribe } from "./CalendarSubscribe";

// 지역·분야 캘린더 구독 안내 (specs/008). 가입 없이 구글·애플 캘린더에 피카 일정을 받아 본다
export const metadata: Metadata = {
    title: "캘린더로 받아 보기 | 피카 pica",
    description: "지역과 분야를 골라 구글·애플 캘린더에 피카 행사 일정을 구독하세요. 가입이 필요 없습니다.",
    alternates: { canonical: "/calendar" },
};

export default function CalendarPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl px-4 pt-20 sm:px-6 sm:pt-24">
                <h1 className="pica-display text-[32px] leading-[1.2] text-ink sm:text-[40px]">캘린더로 받아 보기</h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    지역과 분야를 고르면 앞으로 60일 동안의 행사가 내 캘린더에 하루 종일 일정으로 들어옵니다.
                    새 행사가 생기면 캘린더 앱이 알아서 다시 받아 옵니다(구글은 하루 한 번쯤). 가입이 필요 없어요.
                </p>
                <div className="mt-8">
                    <CalendarSubscribe siteUrl={SITE_URL} />
                </div>
            </div>
        </main>
    );
}
