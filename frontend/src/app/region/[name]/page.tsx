import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeFeed, type HomeParams } from "@/components/HomeFeed";
import { getPublishedEvents } from "@/lib/supabase";
import { GN_REGIONS, regionPath } from "@/lib/regions";
import { addDays } from "@/lib/feedOrder";
import { todayKST } from "@/lib/utils";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

/** 지역 고정 주소(검색 노출용, 2026-11-26 SNS콘텐츠 세션 요청). 화면은 홈 목록에 지역을 고정한 것 */
interface RegionPageProps {
    params: Promise<{ name: string }>;
    searchParams: Promise<HomeParams>;
}

function readRegion(raw: string): string | null {
    let name = raw;
    try { name = decodeURIComponent(raw); } catch { /* 이미 풀린 글자 */ }
    return GN_REGIONS.includes(name) ? name : null;
}

/** 지금 볼 수 있는 행사 수와 이번 주(오늘~7일 뒤에 하루라도 걸치는) 행사 수 */
async function regionCounts(region: string) {
    const events = await getPublishedEvents({ region });
    const today = todayKST();
    const weekEnd = addDays(today, 7);
    const week = events.filter((e: any) => e.event_date_start && e.event_date_start <= weekEnd).length;
    return { total: events.length, week, today };
}

export async function generateMetadata({ params }: RegionPageProps): Promise<Metadata> {
    const region = readRegion((await params).name);
    if (!region) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };
    const { total, week, today } = await regionCounts(region);
    const [, m, d] = today.split("-").map(Number);
    const title = `${region} 공연·전시·축제 ${total}건 · 이번 주 ${week}건 | 피카 pica`;
    const description = `${m}월 ${d}일 기준 ${region}에서 볼 수 있는 공연·전시·축제 ${total}건을 날짜순으로 모았습니다. 이번 주에 볼 수 있는 행사는 ${week}건입니다.`;
    const url = regionPath(region);
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title, description, url, type: "website", siteName: "피카 pica", locale: "ko_KR", images: [DEFAULT_OG_IMAGE.url] },
        twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG_IMAGE.url] },
    };
}

export default async function RegionPage({ params, searchParams }: RegionPageProps) {
    const region = readRegion((await params).name);
    if (!region) notFound();
    const query = await searchParams;
    return <HomeFeed params={{ ...query, region }} region={region} />;
}
