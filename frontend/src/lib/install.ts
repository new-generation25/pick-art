"use client";

/**
 * «앱으로 설치» (specs/018 덧붙임, 운영자 2026-11-28 «알림을 받으려면 웹앱 설치에 대해 안내 하면 좋겠는데»).
 * 안드로이드·PC 크롬·엣지는 설치할 수 있을 때 beforeinstallprompt 를 한 번 알려 준다. 화면이 뜨자마자 오므로
 * 여기서 받아 두었다가(MainLayout 이 이 파일을 불러온다) «앱으로 설치» 버튼을 누를 때 설치 창을 띄운다.
 * 아이폰·아이패드는 이 신호가 없어 «공유 → 홈 화면에 추가» 를 글로 안내한다.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let saved: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach(fn => fn());

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();   // 브라우저가 스스로 띄우는 작은 설치 띠 대신 우리 버튼으로
        saved = e as InstallPromptEvent;
        tell();
    });
    window.addEventListener("appinstalled", () => { saved = null; installed = true; tell(); });
}

export type InstallKind =
    | "standalone"   // 이미 설치한 앱으로 열었다 → 안내를 숨긴다
    | "ios"          // 아이폰·아이패드: 홈 화면에 추가해야 알림을 받는다
    | "prompt"       // 설치 창을 띄울 수 있다(안드로이드·PC 크롬·엣지)
    | "menu";        // 그 밖: 브라우저 메뉴에서 설치

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function installKind(): InstallKind {
    if (installed || isStandalone()) return "standalone";
    if (isIOS()) return "ios";
    return saved ? "prompt" : "menu";
}

/** 설치 창을 띄운다. 돌려주는 값: 설치했으면 true */
export async function askInstall(): Promise<boolean> {
    if (!saved) return false;
    const e = saved;
    saved = null;   // 한 번만 쓸 수 있다
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") installed = true;
    tell();
    return outcome === "accepted";
}

/** 설치할 수 있는 상태가 바뀌면 알려 준다. 돌려주는 함수를 부르면 그만 듣는다 */
export function onInstallChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
