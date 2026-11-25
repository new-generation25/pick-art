import { permanentRedirect } from "next/navigation";
import { HomeFeed, type HomeParams } from "@/components/HomeFeed";
import { GN_REGIONS, regionPath } from "@/lib/regions";

interface HomeProps {
  searchParams: Promise<HomeParams>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  // 지역을 고른 주소(/?region=김해)는 지역 고정 주소(/region/김해)로 넘긴다. 다른 조건은 그대로 붙인다.
  // '전체'(자동 지역 적용을 끈 선택)는 홈에 남는다
  if (params.region && GN_REGIONS.includes(params.region)) {
    const rest = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== "region" && typeof v === "string") rest.set(k, v);
    const qs = rest.toString();
    permanentRedirect(`${regionPath(params.region)}${qs ? `?${qs}` : ""}`);
  }
  return <HomeFeed params={params} />;
}
