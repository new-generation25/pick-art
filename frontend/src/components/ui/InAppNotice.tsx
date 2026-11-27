"use client";

import { useEffect, useState } from "react";
import { chromeIntent, inAppBrowser, isAndroid } from "@/lib/inApp";

/**
 * 앱 안 브라우저 안내 (specs/023 FR-006). 인스타그램 등 앱 안에서 열렸으면 로그인 버튼 앞에 보인다.
 * 보통 브라우저에서는 아무것도 그리지 않는다.
 */
export function InAppNotice({ className = "" }: { className?: string }) {
    const [app, setApp] = useState<string | null>(null);
    const [android, setAndroid] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setApp(inAppBrowser(navigator.userAgent));
        setAndroid(isAndroid(navigator.userAgent));
    }, []);

    if (!app) return null;

    const copy = async () => {
        try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
        catch { setCopied(false); window.prompt("이 주소를 복사해 크롬·사파리에 붙여 넣어 주세요", window.location.href); }
    };

    return (
        <div className={`rounded-[12px] bg-[var(--pk-accent-soft)] px-4 py-3 text-left text-[14.5px] leading-relaxed text-ink ${className}`} role="note">
            <p className="font-bold">{app} 안에서 열렸어요. 구글 로그인은 크롬·사파리에서만 돼요.</p>
            <p className="mt-1 text-ink-soft">화면 오른쪽 위 ⋯(또는 ⋮) 메뉴에서 «외부 브라우저에서 열기»를 누르거나, 주소를 복사해 크롬·사파리에 붙여 넣어 주세요.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
                {android && (
                    <a href={chromeIntent(window.location.href)} className="flex h-11 items-center rounded-full bg-accent px-4 text-[14.5px] font-bold text-on-accent no-underline">크롬으로 열기</a>
                )}
                <button type="button" onClick={copy} className="h-11 rounded-full border border-ink bg-card px-4 text-[14.5px] font-bold text-ink">
                    {copied ? "주소를 복사했어요" : "주소 복사"}
                </button>
            </div>
        </div>
    );
}
