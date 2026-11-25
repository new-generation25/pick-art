"use client";

import { Navigation } from "lucide-react";
import { detectPlatform, naverRouteLinks } from "@/lib/naverMap";

type Place = { venue: string | null; title: string; region: string | null; coords: { lat: number; lng: number } | null };

// 길찾기 버튼 하나. 이동수단(대중교통·자동차·도보)은 네이버지도 길찾기 화면에서 고른다(2026-11-21 운영자 결정)
// (specs/002 목록과 specs/005 지도가 같이 쓴다)
export function RouteButtons({ e, appname }: { e: Place; appname: string }) {
    const links = () => naverRouteLinks({
        name: e.venue || e.title,
        region: e.region,
        lat: e.coords?.lat,
        lng: e.coords?.lng,
        mode: "public",
        platform: detectPlatform(navigator.userAgent),
        appname,
    });
    // 앱 링크만 연다. 예전에는 1.5초 뒤 웹으로 자동 전환했는데, 아이폰 Chrome 에서 앱이 열린 뒤에도
    // 탭이 웹으로 넘어가 Chrome 으로 되돌아오는 문제가 있었다(2026-11-21 운영자 실기기). 웹은 아래 링크로 따로 둔다
    const open = () => {
        const l = links();
        if (l.primary.startsWith("https://")) window.open(l.primary, "_blank", "noopener");
        else window.location.href = l.primary;
    };
    const openWeb = (ev: React.MouseEvent) => {
        ev.preventDefault();
        window.open(links().fallback, "_blank", "noopener");
    };
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" className="pica-chip" onClick={open}>
                <Navigation size={14} aria-hidden /> 네이버지도 길찾기
            </button>
            <a href="#" onClick={openWeb} className="text-[13px] text-ink-soft underline">앱이 없으면 웹에서 보기</a>
        </div>
    );
}
