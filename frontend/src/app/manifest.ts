import type { MetadataRoute } from "next";

/**
 * 웹 앱 매니페스트 (/manifest.webmanifest). 휴대폰·PC에서 사이트를 앱처럼 설치할 때 쓴다.
 * 아이콘: docs/brand/final/logo_postbox.png(브랜드 가이드 4-1 「앱 아이콘」)를 편지 크림 바탕에 얹은 것.
 * 색: 화면 바탕 종이 #F4EFE6(브랜드 가이드 화면 팔레트, 11/27 맨 위 표시줄 색을 화면과 맞춤).
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "피카 pica | 가까운 공연·전시·축제",
        short_name: "피카",
        description: "이번 주 가까운 곳에서 열리는 공연·전시·축제를 공식 출처로 확인해 날짜순으로 알려 드립니다.",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#F4EFE6",
        background_color: "#F4EFE6",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
