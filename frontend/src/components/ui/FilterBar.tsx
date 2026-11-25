"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@mantine/core";
import { Calendar, LocateFixed } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BUSAN_DISTRICTS, GN_REGIONS, regionFromPath, regionPath } from "@/lib/regions";
import { CATEGORIES as FEED_CATEGORIES } from "@/lib/categories";

const REGIONS = ["전체", ...GN_REGIONS];
const CATEGORIES = ["전체", ...FEED_CATEGORIES];
// 아이와 같이 가기 좋은 곳(specs/004). 값은 주소의 kids (lib/kids.ts readKidsParam)
const KIDS_FILTERS = [
    { label: "전체", value: "전체" },
    { label: "아이와", value: "any" },
    { label: "어린 아이(~6세)", value: "young" },
    { label: "초등학생", value: "school" },
];
const DATE_FILTERS = [
    { label: "전체", value: "all" },
    { label: "오늘", value: "today" },
    { label: "이번 주", value: "week" },
    { label: "이번 달", value: "month" },
    { label: "곧 끝남", value: "ending" }
];

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[48px_minmax(0,1fr)] md:items-start">
        <span className="text-[13px] font-semibold text-ink-soft md:pt-2">{label}</span>
        <div className="pica-chiprow" role="group" aria-label={label}>{children}</div>
    </div>
);

export function FilterBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    // 지역 고정 주소(/region/김해)면 주소의 지역, 홈이면 ?region= (자동 적용을 끈 '전체'만 남는다)
    const { region: pathRegion, district: pathDistrict } = regionFromPath(pathname);

    const currentRegion = pathRegion || searchParams.get("region") || "전체";
    const currentCategory = searchParams.get("category") || "전체";
    const currentDate = searchParams.get("date") || "all";
    const currentKids = searchParams.get("kids") || "전체";
    const showEnded = searchParams.get("ended") === "1";
    const [myRegion, setMyRegion] = useState<string | null>(null);

    // 설정의 "내 지역 자동 적용"이 켜진 로그인 사용자: 주소에 지역이 없으면 거주 지역을 건다.
    // 사용자가 '전체'를 고르면 주소에 region=전체 가 남아 다시 걸지 않는다.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase
                .from("profiles")
                .select("region, auto_region")
                .eq("id", session.user.id)
                .single();
            if (cancelled || !profile || profile.auto_region === false || !GN_REGIONS.includes(profile.region)) return;
            setMyRegion(profile.region);
            // 홈에서 지역을 고르지 않았을 때만 (지역 주소에 들어온 사람은 그 지역을 그대로 본다)
            if (pathname === "/" && !searchParams.get("region")) {
                const qs = searchParams.toString();
                router.replace(`${regionPath(profile.region)}${qs ? `?${qs}` : ""}`);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 지역은 주소 경로(/region/김해)로, 나머지 조건은 ?뒤에 둔다. 공유한 링크가 곧 지역 주소가 된다
    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        let region = currentRegion;
        let district: string | null = pathDistrict;
        if (key === "region") {
            region = value;
            district = null;
            params.delete("region");
        } else if (key === "district") {
            district = value === "전체" ? null : value;
        } else if (value === "전체" || value === "all") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        if (region === "전체" && myRegion) params.set("region", "전체"); // 자동 적용 사용자가 고른 '전체'는 주소에 남긴다
        else if (region === "전체") params.delete("region");
        const qs = params.toString();
        router.push(`${region === "전체" ? "/" : regionPath(region, district)}${qs ? `?${qs}` : ""}`);
    };

    return (
        <div className="flex flex-col gap-2.5">
            <div className="pl-0 md:pl-[56px]">
                <Link href="/nearby" className="pica-chip" aria-pressed>
                    <LocateFixed size={14} aria-hidden />
                    내 주변 가까운 순으로 보기
                </Link>
            </div>
            <Row label="언제">
                {DATE_FILTERS.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        className="pica-chip"
                        aria-pressed={currentDate === filter.value}
                        onClick={() => updateFilters("date", filter.value)}
                    >
                        {filter.value !== "all" && <Calendar size={14} aria-hidden />}
                        {filter.label}
                    </button>
                ))}
            </Row>

            <Row label="지역">
                {REGIONS.map((region) => (
                    <button
                        key={region}
                        type="button"
                        className="pica-chip"
                        aria-pressed={currentRegion === region}
                        onClick={() => updateFilters("region", region)}
                    >
                        {region}
                    </button>
                ))}
            </Row>
            {/* 부산을 고르면 구·군 (specs/010). 장소 주소로 가른 것이라 장소를 모르는 행사는 «전체»에만 나온다 */}
            {currentRegion === "부산" && (
                <Row label="구·군">
                    {[{ name: "전체" }, ...BUSAN_DISTRICTS].map((d) => (
                        <button
                            key={d.name}
                            type="button"
                            className="pica-chip"
                            aria-pressed={(pathDistrict || "전체") === d.name}
                            onClick={() => updateFilters("district", d.name)}
                        >
                            {d.name}
                        </button>
                    ))}
                </Row>
            )}

            <Row label="분야">
                {CATEGORIES.map((category) => (
                    <button
                        key={category}
                        type="button"
                        className="pica-chip"
                        aria-pressed={currentCategory === category}
                        onClick={() => updateFilters("category", category)}
                    >
                        {category}
                    </button>
                ))}
            </Row>

            <Row label="아이">
                {KIDS_FILTERS.map((k) => (
                    <button
                        key={k.value}
                        type="button"
                        className="pica-chip"
                        aria-pressed={currentKids === k.value}
                        onClick={() => updateFilters("kids", k.value)}
                    >
                        {k.label}
                    </button>
                ))}
            </Row>

            {myRegion && currentRegion === myRegion && (
                <p className="pl-0 text-[13px] text-ink-soft md:pl-[56px]">
                    내 지역(<b className="text-ink">{myRegion}</b>)을 자동으로 적용했습니다. 설정에서 끌 수 있습니다.
                </p>
            )}

            {/* 끝난 행사: 기본은 숨김. 켜면 종료 1개월 이내 행사가 "종료" 표시와 함께 맨 뒤에 붙는다 */}
            <div className="pl-0 pt-1 md:pl-[56px]">
                <Checkbox
                    checked={showEnded}
                    onChange={(e) => updateFilters("ended", e.currentTarget.checked ? "1" : "all")}
                    label="종료된 행사도 보기 (종료 1개월 이내)"
                    color="dark"
                    size="sm"
                    radius={0}
                    styles={{ label: { color: 'var(--pk-ink-soft)', fontWeight: 500 }, input: { borderColor: 'var(--pk-line)', borderWidth: 1.5 } }}
                />
            </div>
        </div>
    );
}
