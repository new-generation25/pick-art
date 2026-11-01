"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Group, Button, Checkbox } from "@mantine/core";
import { Calendar } from "lucide-react";

const REGIONS = ["전체", "창원", "김해", "진주", "통영", "거제", "양산", "밀양", "사천", "함안", "고성", "합천", "거창", "함양", "창녕", "의령"];
const CATEGORIES = ["전체", "공연", "전시", "축제", "행사"];
const DATE_FILTERS = [
    { label: "전체", value: "all" },
    { label: "오늘", value: "today" },
    { label: "이번 주", value: "week" },
    { label: "이번 달", value: "month" }
];

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            {/* Date Filters */}
            <Group justify="center" gap="xs">
                {DATE_FILTERS.map((filter) => (
                    <Button
                        key={filter.value}
                        onClick={() => updateFilters("date", filter.value)}
                        variant={currentDate === filter.value ? "filled" : "light"}
                        color={currentDate === filter.value ? "violet" : "gray"}
                        radius="xl"
                        size="sm"
                        leftSection={<Calendar size={16} />}
                    >
                        {filter.label}
                    </Button>
                ))}
            </Group>

            {/* Regions */}
            <Group justify="center" gap="xs">
                {REGIONS.map((region) => (
                    <Button
                        key={region}
                        onClick={() => updateFilters("region", region)}
                        variant={currentRegion === region ? "filled" : "default"}
                        color={currentRegion === region ? "indigo" : "gray"}
                        radius="xl"
                        size="sm"
                    >
                        {region}
                    </Button>
                ))}
            </Group>

            {/* Categories */}
            <Group justify="center" gap="xs">
                {CATEGORIES.map((category) => (
                    <Button
                        key={category}
                        onClick={() => updateFilters("category", category)}
                        variant={currentCategory === category ? "light" : "subtle"}
                        color={currentCategory === category ? "indigo" : "gray"}
                        size="sm"
                        radius="md"
                    >
                        {category}
                    </Button>
                ))}
            </Group>

            {/* 끝난 행사: 기본은 숨김. 켜면 종료 1개월 이내 행사가 "종료" 표시와 함께 맨 뒤에 붙는다 */}
            <Checkbox
                checked={showEnded}
                onChange={(e) => updateFilters("ended", e.currentTarget.checked ? "1" : "all")}
                label="종료된 행사도 보기 (종료 1개월 이내)"
                color="gray"
                size="sm"
            />
        </div>
    );
}
