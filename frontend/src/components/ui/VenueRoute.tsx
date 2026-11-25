"use client";

import { RouteButtons } from "@/components/ui/RouteButtons";

/** 공간 페이지의 길찾기 (specs/012). 내 주변·지도와 같은 네이버 길찾기 버튼을 쓴다 */
export function VenueRoute({ name, region, lat, lng, appname }: { name: string; region: string | null; lat: number; lng: number; appname: string }) {
    return <RouteButtons e={{ venue: name, title: name, region, coords: { lat, lng } }} appname={appname} />;
}
