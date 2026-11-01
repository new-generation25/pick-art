"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@mantine/core";
import { Calendar } from "lucide-react";

const REGIONS = ["전체", "창원", "김해", "진주", "통영", "거제", "양산", "밀양", "사천", "함안", "고성", "합천", "거창", "함양", "창녕", "의령"];
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

    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "전체" || value === "all") {
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
