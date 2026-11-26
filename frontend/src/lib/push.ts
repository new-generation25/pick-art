"use client";

import { supabase } from "@/lib/supabase";

/**
 * 푸시 알림 (specs/018). 기기(브라우저)마다 구독 하나를 push_subscriptions 에 둔다.
 * 보내는 쪽은 수집기 정기 실행(collector/tools/send_push.py)이 VAPID 비밀 키로 보낸다.
 * 아래 공개 키는 공개해도 되는 값이다(비밀 키는 collector/.env.local 에만 있다).
 */
export const VAPID_PUBLIC_KEY = "BP8H0gWd_jR2GOieVjqxE3I7b5wVyzks2Jv39KcfifQ7yXFc6OS3L9Yi3_SWz7tQo0kCwS74Zxc1V7Ej2pQXn-0";

export type PushState =
    | "checking"
    | "unsupported"   // 이 브라우저는 푸시를 못 받는다
    | "ios-install"   // 아이폰·아이패드: 홈 화면에 추가한 앱에서만 받는다
    | "denied"        // 사용자가 알림을 막아 두었다(브라우저 설정에서 풀어야 함)
    | "off"
    | "on";

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

async function registration(): Promise<ServiceWorkerRegistration | null> {
    if (!("serviceWorker" in navigator)) return null;
    const existing = await navigator.serviceWorker.getRegistration("/");
    return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function pushState(): Promise<PushState> {
    if (typeof window === "undefined") return "checking";
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
    if (Notification.permission === "denied") return "denied";
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
}

/** 이 기기에서 알림 켜기: 허락 묻기 → 구독 → DB 저장. 로그인한 회원만 */
export async function enablePush(): Promise<PushState> {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return perm === "denied" ? "denied" : "off";
    const reg = await registration();
    if (!reg) return "unsupported";
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_user_agent: navigator.userAgent,
    });
    if (error) { await sub.unsubscribe().catch(() => {}); throw new Error(error.message); }
    return "on";
}

/** 이 기기 알림 끄기: 구독을 풀고 DB 에서도 지운다 */
export async function disablePush(): Promise<PushState> {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe().catch(() => {});
    }
    return "off";
}
