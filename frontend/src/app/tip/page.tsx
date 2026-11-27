import type { Metadata } from "next";
import { TipForm } from "./TipForm";
import { COUPON_NOTE, TIP_EVENT_NAME, TIP_POINTS, couponOpen } from "@/lib/reports";
import { todayKST } from "@/lib/utils";

// 「숨은 행사 찾기」 행사 제보 (specs/007 → 020 → 021). 로그인 회원이 보내고, 관리자가 원문을 확인한 뒤에만 공개된다(헌장 I)
export const metadata: Metadata = {
    title: "숨은 행사 찾기 — 행사 제보하기 | 피카 pica",
    description: "피카에 아직 없는 공연·전시·축제를 알려 주세요. 행사 이름과 링크(또는 사진) 하나면 돼요. 피카에 실리면 100포인트가 쌓여요.",
    alternates: { canonical: "/tip" },
};

// 쿠폰 안내는 2026-12-31 까지만 보인다. 미리 그려 둔 화면이 날짜를 넘겨도 남지 않게 한 시간마다 다시 그린다
export const revalidate = 3600;

export default function TipPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
                <p className="text-[13px] font-bold text-accent">행사 제보하기</p>
                <h1 className="pica-display mt-1 text-[32px] leading-[1.2] text-ink sm:text-[40px]">{TIP_EVENT_NAME}</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">
                    피카에 아직 없는 행사를 알려 주세요. <b>실리면 {TIP_POINTS}포인트</b>가 쌓여요.{couponOpen(todayKST()) && ` ${COUPON_NOTE}`}
                </p>
                <div className="mt-5">
                    <TipForm />
                </div>
                <p className="mt-8 text-[13px] leading-relaxed text-ink-soft">
                    피카는 부산·경남 행사를 실어요. 보내 주신 내용은 운영자가 원문으로 날짜와 장소를 확인한 뒤 올립니다.
                </p>
            </div>
        </main>
    );
}
