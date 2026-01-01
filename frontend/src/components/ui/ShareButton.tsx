"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = window.location.href;

        // 1. Web Share API (Mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `[경남 아트 네비게이터] ${title}`,
                    url: url,
                });
                return;
            } catch (err) {
                console.log("Share failed", err);
            }
        }

        // 2. Clipboard Fallback
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            alert("링크가 클립보드에 복사되었습니다. 지인에게 공유해 보세요!");
        } catch (err) {
            console.error("Copy failed", err);
        }
    };

    return (
        <button
            onClick={handleShare}
            className="w-14 h-14 shrink-0 inline-flex items-center justify-center bg-white text-neutral-600 rounded-2xl hover:text-indigo-600 transition-all shadow-md active:scale-95 ring-1 ring-neutral-200 group relative"
        >
            {copied ? <Check className="w-6 h-6 text-green-500" /> : <Share2 className="w-6 h-6" />}
            {copied && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-white text-[10px] font-bold rounded shadow-xl whitespace-nowrap">
                    복사완료!
                </span>
            )}
        </button>
    );
}
