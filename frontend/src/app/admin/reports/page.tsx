"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, Textarea, Anchor, Loader } from "@mantine/core";
import { supabase } from "@/lib/supabase";

// 오류 신고·행사 제보 처리 (specs/007). 관리자 RLS 로 읽고 상태만 바꾼다.
// 제보 반영은 공식 안내를 확인한 뒤 「직접 등록」(/admin/manual) 또는 큐레이션으로 한다 — 여기서 자동 공개하지 않는다(헌장 I)
type Report = {
    id: string; kind: "error" | "tip"; event_id: string | null; category: string | null; body: string;
    tip: { title?: string; date_start?: string; date_end?: string; venue?: string; region?: string; url?: string } | null;
    status: "new" | "done" | "rejected"; admin_note: string | null; created_at: string; handled_at: string | null;
    events?: { title: string } | null;
};

const STATUS = { new: { label: "새로 옴", color: "red" }, done: { label: "반영함", color: "teal" }, rejected: { label: "반영 안 함", color: "gray" } } as const;

function when(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const safeUrl = (u?: string) => (u && /^https?:\/\//.test(u) ? u : null);

export default function AdminReportsPage() {
    const [filter, setFilter] = useState<"new" | "all">("new");
    const [rows, setRows] = useState<Report[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        let q = supabase.from("reports").select("*, events(title)").order("created_at", { ascending: false }).limit(200);
        if (filter === "new") q = q.eq("status", "new");
        const { data, error } = await q;
        if (error) setError(error.message);
        setRows((data || []) as Report[]);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const handle = async (r: Report, status: "done" | "rejected" | "new") => {
        const { data, error } = await supabase.from("reports")
            .update({ status, admin_note: notes[r.id] ?? r.admin_note, handled_at: status === "new" ? null : new Date().toISOString() })
            .eq("id", r.id).select("status");
        if (error || !data?.length) { setError(error?.message || "저장하지 못했습니다(권한 확인)"); return; }
        load();
    };

    return (
        <Container size="lg" pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>신고·제보</Title>
                    <Text c="dimmed" size="sm">회원이 보낸 «정보가 틀렸어요»와 «행사 제보». 공식 안내로 확인한 뒤 행사를 고치거나 직접 등록하고 «반영함»으로 닫습니다.</Text>
                </div>
                <SegmentedControl value={filter} onChange={v => setFilter(v as "new" | "all")} data={[{ label: "새로 온 것", value: "new" }, { label: "전체", value: "all" }]} />
            </Group>
            {error && <Text c="red" mb="md">{error}</Text>}
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? (
                <Text c="dimmed">{filter === "new" ? "새로 온 신고·제보가 없습니다." : "아직 신고·제보가 없습니다."}</Text>
            ) : (
                <Stack gap="md">
                    {rows.map(r => (
                        <Paper key={r.id} withBorder p="md" radius="md">
                            <Group justify="space-between" mb={6}>
                                <Group gap="xs">
                                    <Badge color={r.kind === "error" ? "orange" : "blue"} variant="light">{r.kind === "error" ? "오류 신고" : "행사 제보"}</Badge>
                                    {r.category && <Badge variant="outline" color="gray">{r.category}</Badge>}
                                    <Badge color={STATUS[r.status].color} variant={r.status === "new" ? "filled" : "light"}>{STATUS[r.status].label}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">{when(r.created_at)}{r.handled_at ? ` · 처리 ${when(r.handled_at)}` : ""}</Text>
                            </Group>
                            {r.kind === "error" && r.event_id && (
                                <Anchor component={Link} href={`/events/${r.event_id}`} target="_blank" fw={700}>{r.events?.title || "행사 보기"}</Anchor>
                            )}
                            {r.kind === "tip" && r.tip && (
                                <Stack gap={2}>
                                    <Text fw={700}>{r.tip.title}</Text>
                                    <Text size="sm">{r.tip.date_start}{r.tip.date_end && r.tip.date_end !== r.tip.date_start ? ` ~ ${r.tip.date_end}` : ""} · {r.tip.venue}{r.tip.region ? ` (${r.tip.region})` : ""}</Text>
                                    {safeUrl(r.tip.url) ? <Anchor href={safeUrl(r.tip.url)!} target="_blank" size="sm">{r.tip.url}</Anchor> : <Text size="sm">{r.tip.url}</Text>}
                                </Stack>
                            )}
                            <Text size="sm" mt={8} style={{ whiteSpace: "pre-wrap" }}>{r.body}</Text>
                            <Textarea
                                mt="sm" size="xs" autosize minRows={1} placeholder="처리 메모(관리자만 봄)"
                                value={notes[r.id] ?? r.admin_note ?? ""}
                                onChange={e => { const v = e.currentTarget.value; setNotes(n => ({ ...n, [r.id]: v })); }}
                            />
                            <Group gap="xs" mt="sm">
                                {r.status !== "done" && <Button size="xs" color="teal" onClick={() => handle(r, "done")}>반영함</Button>}
                                {r.status !== "rejected" && <Button size="xs" variant="default" onClick={() => handle(r, "rejected")}>반영 안 함</Button>}
                                {r.status !== "new" && <Button size="xs" variant="subtle" onClick={() => handle(r, "new")}>다시 열기</Button>}
                                {r.kind === "tip" && <Button size="xs" variant="subtle" component={Link} href="/admin/manual">직접 등록으로</Button>}
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Container>
    );
}
