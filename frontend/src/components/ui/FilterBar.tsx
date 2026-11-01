"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@mantine/core";
import { Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";

const REGIONS = ["전체", ...GN_REGIONS];
const CATEGORIES = ["전체", "공연", "전시", "축제", "행사"];
const DATE_FILTERS = [
    { label: "전체", value: "all" },
    { label: "오늘", value: "today" },
    { label: "이번 주", value: "week" },
    { label: "이번 달", value: "month" }
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

    const currentRegion = searchParams.get("region") || "전체";
    const currentCategory = searchParams.get("category") || "전체";
    const currentDate = searchParams.get("date") || "all";
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
            if (!searchParams.get("region")) {
                const params = new URLSearchParams(searchParams.toString());
                params.set("region", profile.region);
                router.replace(`/?${params.toString()}`);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (key === "region" && value === "전체" && myRegion) {
            params.set(key, value); // 자동 적용 사용자가 고른 '전체'는 주소에 남긴다
        } else if (value === "전체" || value === "all") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <div className="flex flex-col gap-2.5">
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
