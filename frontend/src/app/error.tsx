"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-4 py-16 text-ink">
            <h1 className="pica-display text-[32px] leading-tight">화면을 불러오지 못했어요</h1>
            <p className="mt-3 text-[15px] text-ink-soft">잠시 뒤에 다시 시도해 주세요. 계속 안 되면 홈에서 다시 들어와 주세요.</p>
            <div className="mt-8 flex flex-wrap gap-2">
                <button type="button" onClick={() => reset()} className="bg-ink px-5 py-3 text-[15px] font-bold text-paper">다시 시도</button>
                <Link href="/" className="pica-chip">홈으로</Link>
            </div>
        </main>
    );
}
