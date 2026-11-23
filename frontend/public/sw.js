/*
 * 피카 서비스 워커 — 앱처럼 설치(PWA)하기 위한 최소한의 것.
 *
 * 캐시하는 것: 빌드 산출 정적 파일(/_next/static/*, 파일명에 해시가 붙어 바뀌지 않음)과 아이콘.
 * 캐시하지 않는 것: 페이지(HTML)·API·관리자·로그인. 행사 정보는 늘 서버에서 새로 받는다
 *   (오래된 날짜·취소된 행사를 보여 주지 않기 위해서다).
 * 오프라인: 페이지를 열 수 없으면 /offline.html 을 보여 준다.
 */
const VERSION = "pica-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

const NEVER = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/auth(\/|$)/, /^\/login(\/|$)/, /^\/signup(\/|$)/, /^\/settings(\/|$)/];

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (NEVER.some((re) => re.test(url.pathname))) return; // 브라우저 기본 동작 그대로

    // 페이지 이동: 네트워크만 쓰고, 실패하면 오프라인 안내
    if (req.mode === "navigate") {
        event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
        return;
    }

    // 해시가 붙은 정적 파일·아이콘: 캐시 우선
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
        event.respondWith(
            caches.match(req).then(
                (hit) =>
                    hit ||
                    fetch(req).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
                        }
                        return res;
                    })
            )
        );
    }
    // 그 밖(RSC 데이터·이미지 등)은 손대지 않는다
});
