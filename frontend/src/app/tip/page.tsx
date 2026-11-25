import type { Metadata } from "next";
import { TipForm } from "./TipForm";

// 행사 제보하기 (specs/007). 로그인 회원이 보내고, 관리자가 공식 안내로 확인한 뒤에만 공개된다(헌장 I)
export const metadata: Metadata = {
    title: "행사 제보하기 | 피카 pica",
    description: "가까운 곳에서 열리는 공연·전시·축제를 알려 주세요. 공식 안내로 확인한 뒤 피카에 올립니다.",
    alternates: { canonical: "/tip" },
};

export default function TipPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl px-4 pt-20 sm:px-6 sm:pt-24">
                <h1 className="pica-display text-[32px] leading-[1.2] text-ink sm:text-[40px]">행사 제보하기</h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    작은 공연, 동네 전시, 버스킹, 팝업 — 피카에 아직 없는 행사를 알려 주세요.
                    공식 안내(단체 누리집·인스타그램·예매 페이지)로 날짜와 장소를 확인한 뒤 올립니다.
                </p>
                <div className="mt-8">
                    <TipForm />
                </div>
            </div>
        </main>
    );
}
