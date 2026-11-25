import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HomeFeed, type HomeParams } from "@/components/HomeFeed";
import { districtFromSlug, regionFromSlug, regionPath } from "@/lib/regions";
import { queryString, regionMetadata } from "@/lib/regionMeta";

/** 부산 구·군 주소 /region/busan/haeundae (specs/010, 운영자 11/26). 장소(venues.district)로 가른다 */
interface DistrictPageProps {
    params: Promise<{ name: string; district: string }>;
    searchParams: Promise<HomeParams>;
}

async function read(params: DistrictPageProps["params"]) {
    const { name, district: raw } = await params;
    const region = regionFromSlug(name);
    const district = region === "부산" ? districtFromSlug(raw) : null;
    return { name, raw, region, district };
}

export async function generateMetadata({ params }: DistrictPageProps): Promise<Metadata> {
    const { region, district } = await read(params);
    if (!region || !district) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };
    return regionMetadata(region, district);
}

export default async function DistrictPage({ params, searchParams }: DistrictPageProps) {
    const { name, raw, region, district } = await read(params);
    if (!region || !district) notFound();
    const query = await searchParams;
    const canonical = regionPath(region, district);
    if (`/region/${name}/${raw}` !== canonical) permanentRedirect(`${canonical}${queryString(query, ["region"])}`);
    return <HomeFeed params={{ ...query, region }} region={region} district={district} />;
}
