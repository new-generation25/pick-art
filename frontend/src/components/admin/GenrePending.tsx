"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Paper, Group, Title, Text } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { AdminGenreControl } from "@/components/ui/AdminGenreControl";

type Row = { id: string; title: string; category: string; subcategory: string | null; subcategory_by: string | null; subcategory_evidence: string | null; event_date_start: string | null };

/** «세부 판정 대기» (specs/015 US3): 규칙으로 못 정한 공개 행사. 고르면 운영자 확정으로 남고 목록에서 빠진다 */
export function GenrePending() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data, error } = await supabase.from("events")
            .select("id,title,category,subcategory,subcategory_by,subcategory_evidence,event_date_start")
            .eq("status", "PUBLISHED").eq("subcategory_pending", true).gte("event_date_end", todayKST())
            .order("event_date_start", { ascending: true }).limit(200);
        if (error) { setError(error.message); return; }
        setRows((data || []) as Row[]);
    }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <Paper withBorder radius="md" p="md" id="genre-pending">
            <Group justify="space-between" mb="xs">
                <Title order={4}>세부 판정 대기 {rows ? `${rows.length}건` : ""}</Title>
                <Text size="xs" c="dimmed">규칙으로 갈래를 못 정한 진행 중·예정 행사 · 고르면 운영자 확정</Text>
            </Group>
            {error && <Text size="sm" c="red">불러오지 못했습니다: {error}</Text>}
            {rows && rows.length === 0 && <Text size="sm" c="dimmed">대기 중인 행사가 없습니다.</Text>}
            <div className="flex max-h-[420px] flex-col divide-y divide-neutral-200 overflow-y-auto">
                {(rows || []).map(r => (
                    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                        <span className="w-10 shrink-0 text-xs font-bold text-neutral-500">{r.category}</span>
                        <Link href={`/events/${r.id}`} target="_blank" className="min-w-0 flex-1 truncate hover:underline">{r.title}</Link>
                        <span className="hidden max-w-[220px] truncate text-xs text-neutral-400 sm:inline">{r.subcategory_evidence}</span>
                        <AdminGenreControl compact eventId={r.id} category={r.category} sub={r.subcategory} by={r.subcategory_by} pending onSaved={load} />
                    </div>
                ))}
            </div>
        </Paper>
    );
}
