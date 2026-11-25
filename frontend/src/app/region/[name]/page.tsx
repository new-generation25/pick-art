import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HomeFeed, type HomeParams } from "@/components/HomeFeed";
import { regionFromSlug, regionPath } from "@/lib/regions";
import { queryString, regionMetadata } from "@/lib/regionMeta";

/** 지역 고정 주소 /region/gimhae (specs/010). 화면은 홈 목록에 지역을 고정한 것. 한글 주소(/region/김해)는 로마자 주소로 넘긴다 */
interface RegionPageProps {
    params: Promise<{ name: string }>;
    searchParams: Promise<HomeParams>;
}

export async function generateMetadata({ params }: RegionPageProps): Promise<Metadata> {
    const region = regionFromSlug((await params).name);
    if (!region) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };
    return regionMetadata(region);
}

export default async function RegionPage({ params, searchParams }: RegionPageProps) {
    const { name } = await params;
    const region = regionFromSlug(name);
    if (!region) notFound();
    const query = await searchParams;
    const canonical = regionPath(region);
    if (`/region/${name}` !== canonical) permanentRedirect(`${canonical}${queryString(query, ["region"])}`);
    return <HomeFeed params={{ ...query, region }} region={region} />;
}
