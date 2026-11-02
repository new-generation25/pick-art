import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { todayKST } from "@/lib/utils";

export const revalidate = 3600;

/** 홈 + 공개 행사 중 끝나지 않은 것. 익명 키로 읽어 RLS가 비공개를 뺀다 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { data } = await supabase
        .from("events")
        .select("id, published_at")
        .eq("status", "PUBLISHED")
        .gte("event_date_end", todayKST());

    return [
        { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
        ...(data ?? []).map(e => ({
            url: `${SITE_URL}/events/${e.id}`,
            ...(e.published_at && { lastModified: new Date(e.published_at) }),
        })),
    ];
}
