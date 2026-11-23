"use client";

import { useEffect } from "react";

/** 앱처럼 설치(PWA)를 위한 서비스 워커(public/sw.js) 등록. 프로덕션에서만 한다(개발 중 캐시 혼란 방지). */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;
        if (!("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
            // 등록 실패는 사이트 사용에 영향이 없으므로 조용히 넘긴다
        });
    }, []);
    return null;
}
