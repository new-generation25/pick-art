"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Group, Button } from "@mantine/core";
import { Calendar } from "lucide-react";

const REGIONS = ["전체", "창원", "김해", "진주", "통영", "거제", "양산", "밀양"];
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
        </div>
    );
}
