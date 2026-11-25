import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { todayKST } from "@/lib/utils";
import { BUSAN_DISTRICTS, GN_REGIONS, regionPath } from "@/lib/regions";

export const revalidate = 3600;

/** 홈 + 지역 주소(행사가 있는 지역만) + 공개 행사 중 끝나지 않은 것. 익명 키로 읽어 RLS가 비공개를 뺀다 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { data } = await supabase
        .from("events")
        .select("id, published_at, region, venue_id")
        .eq("status", "PUBLISHED")
        .gte("event_date_end", todayKST());

    // 부산 구·군: 장소(venues.district)로 가른 행사가 있는 곳만
    const { data: venues } = await supabase.from("public_venues").select("id, district").not("district", "is", null);
    const districtOf = new Map((venues ?? []).map(v => [v.id, v.district as string]));
    const districts = BUSAN_DISTRICTS.filter(d => (data ?? []).some(e => e.region === "부산" && districtOf.get(e.venue_id) === d.name));

    // 공간·단체 페이지 (specs/012): 다가오는 행사가 있는 곳만. 소규모 단체(동의 전)는 검색에서 뺀다
    const active = new Set((data ?? []).map(e => e.id));
    const venueIds = [...new Set((data ?? []).map(e => e.venue_id).filter((v): v is string => !!v))];
    const { data: pubVenues } = await supabase.from("public_venues").select("id").in("id", venueIds.slice(0, 1000));
    // 한 번에 1,000줄까지만 오므로 나눠 읽는다
    const links: { event_id: string; org_id: string }[] = [];
    for (let from = 0; from < 20000; from += 1000) {
        const { data: page } = await supabase.from("event_orgs").select("event_id, org_id").range(from, from + 999);
        links.push(...(page ?? []));
        if (!page || page.length < 1000) break;
    }
    const { data: orgRows } = await supabase.from("orgs").select("id, small").eq("small", false).limit(5000);
    const bigOrgs = new Set((orgRows ?? []).map(o => o.id));
    const orgIds = [...new Set(links.filter(l => active.has(l.event_id) && bigOrgs.has(l.org_id)).map(l => l.org_id))];

    return [
        { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
        ...GN_REGIONS.filter(r => (data ?? []).some(e => e.region === r)).map(r => ({
            url: `${SITE_URL}${regionPath(r)}`,
            changeFrequency: "daily" as const,
            priority: 0.8,
        })),
        ...districts.map(d => ({
            url: `${SITE_URL}${regionPath("부산", d.name)}`,
            changeFrequency: "daily" as const,
            priority: 0.7,
        })),
        ...(pubVenues ?? []).map(v => ({ url: `${SITE_URL}/venues/${v.id}`, changeFrequency: "weekly" as const, priority: 0.5 })),
        ...orgIds.map(id => ({ url: `${SITE_URL}/orgs/${id}`, changeFrequency: "weekly" as const, priority: 0.5 })),
        ...(data ?? []).map(e => ({
            url: `${SITE_URL}/events/${e.id}`,
            ...(e.published_at && { lastModified: new Date(e.published_at) }),
        })),
    ];
}
