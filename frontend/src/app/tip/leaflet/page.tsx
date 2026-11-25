import type { Metadata } from "next";
import Link from "next/link";
import { LeafletForm } from "./LeafletForm";

// 리플렛 한 장으로 행사 등록 (specs/013). 로그인 회원이 이미지를 올리면 글자를 읽어 행사 칸을 채우고, 운영자가 확인한 뒤에만 공개한다(헌장 I)
export const metadata: Metadata = {
    title: "리플렛으로 행사 알리기 | 피카 pica",
    description: "리플렛·포스터 한 장을 올리면 피카가 행사 정보를 정리해 올립니다. 운영자가 확인한 뒤 공개합니다.",
    alternates: { canonical: "/tip/leaflet" },
};

export default function LeafletPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl px-4 pt-20 sm:px-6 sm:pt-24">
                <h1 className="pica-display text-[32px] leading-[1.2] text-ink sm:text-[40px]">리플렛으로 행사 알리기</h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    단체에서 만든 리플렛·포스터 한 장을 올려 주세요. 피카가 날짜·장소·요금을 읽어 행사 칸을 채우고,
                    운영자가 확인한 뒤 올립니다. 이미지에 적힌 것만 옮기고, 적혀 있지 않은 것은 비워 둡니다.
                </p>
                <p className="mt-2 text-[14px] text-ink-soft">
                    이미지 없이 알려 주시려면 <Link href="/tip" className="underline underline-offset-4">행사 제보하기</Link>를 써 주세요.
                </p>
                <div className="mt-8">
                    <LeafletForm />
                </div>
            </div>
        </main>
    );
}
