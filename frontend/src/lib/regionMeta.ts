import type { Metadata } from "next";
import { getDistrictVenueIds, getPublishedEvents } from "@/lib/supabase";
import { addDays } from "@/lib/feedOrder";
import { todayKST } from "@/lib/utils";
import { DEFAULT_OG_IMAGE } from "@/lib/site";
import { regionPath } from "@/lib/regions";

/** 지역(·부산 구·군) 페이지의 제목·설명 (specs/010). 건수는 화면 목록과 같은 조건으로 서버에서 센다 */
export async function regionMetadata(region: string, district?: string): Promise<Metadata> {
    const venues = district ? await getDistrictVenueIds(district) : null;
    const events = (await getPublishedEvents({ region })).filter((e: any) => !venues || venues.has(e.venue_id));
    const today = todayKST();
    const weekEnd = addDays(today, 7);
    const week = events.filter((e: any) => e.event_date_start && e.event_date_start <= weekEnd).length;
    const [, m, d] = today.split("-").map(Number);
    const place = district ? `${region} ${district}` : region;
    const title = `${place} 공연·전시·축제 ${events.length}건 · 이번 주 ${week}건 | 피카 pica`;
    const description = `${m}월 ${d}일 기준 ${place}에서 볼 수 있는 공연·전시·축제 ${events.length}건을 날짜순으로 모았습니다. 이번 주에 볼 수 있는 행사는 ${week}건입니다.`;
    const url = regionPath(region, district);
    return {
        title,
        description,
        alternates: { canonical: url },
        // 행사가 없는 구·군은 검색에 올리지 않는다(빈 페이지)
        ...(events.length === 0 && { robots: { index: false, follow: true } }),
        openGraph: { title, description, url, type: "website", siteName: "피카 pica", locale: "ko_KR", images: [DEFAULT_OG_IMAGE.url] },
        twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG_IMAGE.url] },
    };
}

/** searchParams → «?a=b» (없으면 빈 글자). 옛 주소를 넘길 때 다른 조건을 그대로 붙인다 */
export function queryString(params: Record<string, string | string[] | undefined>, drop: string[] = []): string {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (!drop.includes(k) && typeof v === "string") q.set(k, v);
    const s = q.toString();
    return s ? `?${s}` : "";
}
