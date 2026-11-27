"use client";

import { useCallback, useEffect, useState } from "react";
import { Paper, Group, Title, Text, Button, Badge } from "@mantine/core";
import { supabase } from "@/lib/supabase";

type Row = { sha256: string; n: number; sample_url: string | null; marked: boolean };

/**
 * «안내 그림 후보» (specs/014 US2): 같은 그림(지문)을 3건 넘게 쓰는 공개 행사.
 * 포스터 자리에 올라온 «공연 이미지 준비 중»·기관 로고 같은 그림을 찾아 표시하면, 그 그림을 쓰는 행사는 글자 포스터로 보인다.
 * 실제 포스터를 시리즈로 같이 쓰는 경우(예: 강좌 시리즈)도 있으니 그림을 보고 판단한다.
 */
export function PlaceholderCandidates() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data, error } = await supabase.rpc("poster_dup_candidates", { p_min: 4 });
        if (error) { setError(error.message); return; }
        setRows((data || []) as Row[]);
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggle = async (r: Row) => {
        setBusy(r.sha256);
        const { error } = r.marked
            ? await supabase.from("placeholder_images").delete().eq("sha256", r.sha256)
            : await supabase.from("placeholder_images").insert({ sha256: r.sha256, note: "관리자 대시보드에서 표시" });
        setBusy(null);
        if (error) { setError(error.message); return; }
        load();
    };

    return (
        <Paper withBorder radius="md" p="md" id="placeholder-images">
            <Group justify="space-between" mb="xs">
                <Title order={4}>안내 그림 후보</Title>
                <Text size="xs" c="dimmed">같은 그림을 4건 넘게 쓰는 공개 행사 · 표시하면 글자 포스터로 보임</Text>
            </Group>
            {error && <Text size="sm" className="pica-err">불러오지 못했습니다: {error}</Text>}
            {rows && rows.length === 0 && <Text size="sm" c="dimmed">후보가 없습니다.</Text>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {(rows || []).map(r => (
                    <div key={r.sha256} className="flex flex-col gap-1.5 rounded-[10px] border border-line p-2">
                        {r.sample_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={r.sample_url} alt="" className="aspect-[4/5] w-full rounded object-cover" loading="lazy" />
                            : <div className="aspect-[4/5] w-full rounded bg-[#ebe4d7]" />}
                        <Group gap={6} justify="space-between">
                            <Text size="xs" fw={700}>{r.n}건</Text>
                            {r.marked && <Badge size="xs" color="green">표시됨</Badge>}
                        </Group>
                        <Text size="10px" c="dimmed" ff="monospace">{r.sha256.slice(0, 12)}…</Text>
                        <Button size="compact-xs" variant={r.marked ? "default" : "filled"} color="dark" loading={busy === r.sha256} onClick={() => toggle(r)}>
                            {r.marked ? "표시 풀기" : "안내 그림으로 표시"}
                        </Button>
                    </div>
                ))}
            </div>
        </Paper>
    );
}
