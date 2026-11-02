import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "찾을 수 없는 페이지 | 피카 pica",
    robots: { index: false },
};

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-4 py-16 text-ink">
            <p className="text-[14px] font-bold text-accent">404</p>
            <h1 className="pica-display mt-2 text-[32px] leading-tight">찾을 수 없는 페이지예요</h1>
            <p className="mt-3 text-[15px] text-ink-soft">
                주소가 바뀌었거나, 행사 정보가 내려갔을 수 있어요. 지금 열리는 행사에서 다시 찾아보세요.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
                <Link href="/" className="bg-ink px-5 py-3 text-[15px] font-bold text-paper">홈으로</Link>
                <Link href="/?date=week" className="pica-chip">이번 주 행사</Link>
            </div>
        </main>
    );
}
