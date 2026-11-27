"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { askInstall, installKind, onInstallChange, type InstallKind } from "@/lib/install";

/** 지금 기기의 설치 상태. 서버에서 그릴 때와 처음에는 null */
export function useInstallKind(): InstallKind | null {
    const [kind, setKind] = useState<InstallKind | null>(null);
    useEffect(() => {
        const read = () => setKind(installKind());
        read();
        return onInstallChange(read);
    }, []);
    return kind;
}

/**
 * «앱으로 설치» 안내 본문 (specs/018 덧붙임). 기기마다 다르게 보인다.
 * - 아이폰·아이패드: 공유 → 홈 화면에 추가 단계. 이 기기는 설치해야만 알림을 받는다
 * - 설치 창을 띄울 수 있으면: «앱으로 설치» 버튼
 * - 그 밖: 브라우저 메뉴 안내. 안드로이드·PC 는 설치하지 않아도 알림을 받을 수 있다
 * 이미 설치한 앱으로 열었으면 아무것도 그리지 않는다
 */
export function InstallGuide({ kind }: { kind: InstallKind | null }) {
    const [busy, setBusy] = useState(false);
    if (!kind || kind === "standalone") return null;

    if (kind === "ios") {
        return (
            <div className="text-[13.5px] leading-[1.55] text-ink">
                <p className="font-semibold">아이폰·아이패드는 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.</p>
                <ol className="mt-1.5 flex flex-col gap-1 text-ink-soft">
                    <li className="flex items-center gap-1.5"><b className="text-ink">1</b> 사파리 아래의 <Share className="h-[17px] w-[17px] flex-none text-ink" aria-hidden /><b className="text-ink">공유</b> 버튼을 눌러요</li>
                    <li className="flex items-center gap-1.5"><b className="text-ink">2</b> <SquarePlus className="h-[17px] w-[17px] flex-none text-ink" aria-hidden /><b className="text-ink">홈 화면에 추가</b>를 골라요</li>
                    <li className="flex items-center gap-1.5"><b className="text-ink">3</b> 홈 화면의 피카를 열어 알림을 켜요</li>
                </ol>
            </div>
        );
    }

    const install = async () => {
        setBusy(true);
        try { await askInstall(); } finally { setBusy(false); }
    };
    return (
        <div className="text-[13.5px] leading-[1.55] text-ink-soft">
            {kind === "prompt" ? (
                <button type="button" onClick={install} disabled={busy}
                    className="flex h-[42px] w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-bold text-on-accent disabled:opacity-50">
                    <Download size={15} aria-hidden />{busy ? "잠시만요…" : "앱으로 설치"}
                </button>
            ) : (
                <p>브라우저 메뉴 <b className="text-ink">⋮</b> 에서 <b className="text-ink">앱 설치</b>(또는 <b className="text-ink">홈 화면에 추가</b>)를 누르면 설치돼요.</p>
            )}
            <p className="mt-1.5">설치하지 않아도 이 브라우저에서 알림을 받을 수 있어요. 설치하면 홈 화면에서 바로 열 수 있어요.</p>
        </div>
    );
}

/** 홈 «새 소식 받아 보기» 안의 한 줄 + «설치 방법» 펼침. 이미 설치한 앱에서는 보이지 않는다 */
export function InstallHint() {
    const kind = useInstallKind();
    const [open, setOpen] = useState(false);
    if (!kind || kind === "standalone") return null;
    return (
        <div className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
            <p>
                {kind === "ios" ? "아이폰은 피카를 앱으로 설치해야 알림을 받을 수 있어요." : "피카를 앱으로 설치하면 홈 화면에서 바로 열고 알림도 받을 수 있어요."}{" "}
                <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="font-bold text-ink underline underline-offset-4">설치 방법</button>
            </p>
            {open && <div className="mt-2 max-w-[420px] rounded-[14px] bg-card px-3.5 py-3 shadow-[0_1px_4px_rgba(30,26,21,.08)]"><InstallGuide kind={kind} /></div>}
        </div>
    );
}
