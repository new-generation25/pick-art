import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { todayKST } from "@/lib/utils";
import { GN_REGIONS, regionPath } from "@/lib/regions";

export const revalidate = 3600;

/** 홈 + 지역 주소(행사가 있는 지역만) + 공개 행사 중 끝나지 않은 것. 익명 키로 읽어 RLS가 비공개를 뺀다 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { data } = await supabase
        .from("events")
        .select("id, published_at, region")
        .eq("status", "PUBLISHED")
        .gte("event_date_end", todayKST());

    return [
        { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
        ...GN_REGIONS.filter(r => (data ?? []).some(e => e.region === r)).map(r => ({
            url: `${SITE_URL}${regionPath(r)}`,
            changeFrequency: "daily" as const,
            priority: 0.8,
        })),
        ...(data ?? []).map(e => ({
            url: `${SITE_URL}/events/${e.id}`,
            ...(e.published_at && { lastModified: new Date(e.published_at) }),
        })),
    ];
}
