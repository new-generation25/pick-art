/**
 * 네이버지도 길찾기 링크 (specs/002-nearby-events, contracts/naver-map-link.md).
 * 도착지만 채운다. 출발지(방문자 위치)는 넘기지 않는다 — 앱이 현재 위치를 쓴다.
 * 형식 근거: 네이버 클라우드 Maps URL Scheme 문서(appname 필수, 2026-11-21 확인).
 */

export type RouteMode = "public" | "car";

export type NaverRouteInput = {
  name: string;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  mode: RouteMode;
  platform: "ios" | "android" | "desktop";
  appname: string; // 사이트 도메인
};

export type NaverRouteLinks = { primary: string; fallback: string };

const ANDROID_PACKAGE = "com.nhn.android.nmap";

export function naverSearchUrl(name: string, region?: string | null): string {
  const q = region && !name.includes(region) ? `${name} ${region}` : name;
  return `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
}

export function naverRouteLinks(i: NaverRouteInput): NaverRouteLinks {
  const search = naverSearchUrl(i.name, i.region);
  const hasCoords = typeof i.lat === "number" && typeof i.lng === "number";
  if (!hasCoords || i.platform === "desktop") return { primary: search, fallback: search };
  const q =
    `dlat=${i.lat}&dlng=${i.lng}&dname=${encodeURIComponent(i.name)}` +
    `&appname=${encodeURIComponent(i.appname)}`;
  if (i.platform === "android") {
    return {
      primary: `intent://route/${i.mode}?${q}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${ANDROID_PACKAGE};end`,
      fallback: search,
    };
  }
  return { primary: `nmap://route/${i.mode}?${q}`, fallback: search };
}

export function detectPlatform(userAgent: string): NaverRouteInput["platform"] {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "desktop";
}
