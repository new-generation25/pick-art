"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { countEvent } from "@/lib/countEvent";

export function ShareButton({ title, eventId }: { title: string; eventId?: string }) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = window.location.href;
        if (eventId) countEvent(eventId, "share"); // 공유 수 (specs/011)

        // 1. Web Share API (Mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `[피카] ${title}`,
                    url: url,
                });
                return;
            } catch (err) {
                // 공유 창을 열었다가 닫은 것(취소)이면 여기서 끝낸다. 링크를 복사하지도, 안내를 띄우지도 않는다
                // (운영자 2026-11-28: 공유하지 않았는데 «복사되었습니다»가 떴음). 그 밖의 오류일 때만 복사로 넘어간다
                if ((err as { name?: string } | null)?.name === "AbortError") return;
                console.log("Share failed", err);
            }
        }

        // 2. Clipboard Fallback
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Clipboard API failed, using fallback", err);

            // 3. Legacy fallback using textarea
            try {
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            } catch (legacyErr) {
                console.error("Legacy copy also failed", legacyErr);
                // Final fallback: show URL in alert
                alert(`아래 링크를 복사해 주세요:\n${url}`);
            }
        }
    };

    return (
        <button
            onClick={handleShare}
            className="w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-full bg-card text-ink border border-line hover:bg-soft transition-colors group relative"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
            {copied ? <Check className="w-5 h-5 text-accent" /> : <Share2 className="w-5 h-5" />}
            {copied && (
                <span role="status" className="absolute -top-11 left-0 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-bold text-white shadow-[0_4px_12px_rgba(20,23,28,.25)]">
                    링크를 복사했어요
                </span>
            )}
        </button>
    );
}
