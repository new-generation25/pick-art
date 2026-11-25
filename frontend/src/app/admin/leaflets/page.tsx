"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, TextInput, Textarea, Select, Checkbox, Loader, Anchor, SimpleGrid } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";
import { leafletSource } from "@/lib/leaflets";

// 리플렛 제출 검토·등록 (specs/013). 클로드 예약작업이 읽은 칸(ai_result)과 단체가 적은 칸(given)을 보고 운영자가 고쳐 등록한다.
// 공개는 이 화면의 «등록»으로만(헌장 I — 운영자 확인이 검증). 공식 안내 주소가 있으면 원본으로 잇고, 출처는 «단체 제공 · 단체 이름»
// 포스터: 리플렛·포스터 «파일»만 공개 버킷(event-images)으로 복사해 쓴다. 휴대폰 사진은 포스터로 쓰지 않는다(운영자 11/26)
type Field = { raw?: string | null; value?: string | null; confidence?: "high" | "low" | "none" };
type Sub = {
    id: string; user_id: string; image_path: string | null; image_kind: "file" | "photo"; official_url: string | null; group_name: string | null;
    given: Record<string, string>; note: string | null; rights_version: string; ai_result: (Record<string, Field> & { date_start?: string | null; date_end?: string | null; error?: string }) | null;
    status: "uploaded" | "read" | "published" | "rejected"; admin_note: string | null; event_id: string | null; created_at: string;
};
type Draft = { title: string; category: string; region: string; venue: string; date_start: string; date_end: string; price_info: string; is_free: boolean; original_url: string; description: string; use_poster: boolean };

const STATUS = { uploaded: { label: "읽기 전", color: "gray" }, read: { label: "읽음", color: "blue" }, published: { label: "등록함", color: "teal" }, rejected: { label: "반영 안 함", color: "red" } } as const;
const v = (f?: Field) => (f && f.confidence !== "none" ? f.value ?? "" : "");

function draftOf(s: Sub): Draft {
    const a = s.ai_result || {};
    const regionHint = v(a.region_hint as Field);
    return {
        title: s.given.title || v(a.title as Field),
        category: "",
        region: GN_REGIONS.find(r => regionHint.includes(r)) ?? "",
        venue: s.given.venue || v(a.venue as Field),
        date_start: (a.date_start as string) || "",
        date_end: (a.date_end as string) || (a.date_start as string) || "",
        price_info: v(a.price_text as Field),
        is_free: /무료/.test(v(a.price_text as Field)),
        original_url: s.official_url || (/^https?:\/\//.test(v(a.booking_url as Field)) ? v(a.booking_url as Field) : ""),
        description: s.note || "",
        use_poster: s.image_kind === "file",
    };
}

export default function AdminLeafletsPage() {
    const [filter, setFilter] = useState<"todo" | "all">("todo");
    const [rows, setRows] = useState<Sub[] | null>(null);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [msg, setMsg] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        let q = supabase.from("leaflet_submissions").select("*").order("created_at", { ascending: false }).limit(100);
        if (filter === "todo") q = q.in("status", ["uploaded", "read"]);
        const { data } = await q;
        const list = (data || []) as Sub[];
        setRows(list);
        setDrafts(d => Object.fromEntries(list.map(s => [s.id, d[s.id] ?? draftOf(s)])));
        const signed: Record<string, string> = {};
        for (const s of list) {
            if (!s.image_path) continue;
            const { data: u } = await supabase.storage.from("leaflets").createSignedUrl(s.image_path, 600);
            if (u?.signedUrl) signed[s.id] = u.signedUrl;
        }
        setUrls(signed);
    }, [filter]);
    useEffect(() => { load(); }, [load]);

    const setD = (id: string, k: keyof Draft, value: string | boolean) => setDrafts(d => ({ ...d, [id]: { ...d[id], [k]: value } }));

    const publish = async (s: Sub) => {
        const d = drafts[s.id];
        const missing = [!d.title.trim() && "제목", !d.category && "분야", !d.region && "지역", !d.date_start && "시작일"].filter(Boolean);
        if (missing.length) { setMsg(m => ({ ...m, [s.id]: `${missing.join("·")}을(를) 채워 주세요` })); return; }
        if (d.original_url && !/^https?:\/\//.test(d.original_url)) { setMsg(m => ({ ...m, [s.id]: "원본 주소는 http로 시작해야 합니다" })); return; }
        setMsg(m => ({ ...m, [s.id]: "등록 중…" }));
        let poster = "";
        if (d.use_poster && s.image_kind === "file" && s.image_path) {
            const { data: blob } = await supabase.storage.from("leaflets").download(s.image_path);
            if (blob) {
                const path = `leaflets/${s.id}.jpg`;
                const up = await supabase.storage.from("event-images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
                if (!up.error) poster = supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
            }
            if (!poster) { setMsg(m => ({ ...m, [s.id]: "포스터를 옮기지 못했습니다(포스터 없이 하려면 체크를 끄세요)" })); return; }
        }
        const { data: ev, error } = await supabase.from("events").insert({
            title: d.title.trim(), category: d.category, region: d.region, venue: d.venue.trim() || null,
            event_date_start: d.date_start, event_date_end: d.date_end || d.date_start,
            price_info: d.price_info.trim() || null, is_free: d.is_free, description: d.description.trim() || null,
            poster_image_url: poster, source: leafletSource(s.group_name || "단체"), original_url: d.original_url.trim() || null,
            status: "PUBLISHED", published_at: new Date().toISOString(),
        }).select("id").single();
        if (error || !ev) { setMsg(m => ({ ...m, [s.id]: `등록하지 못했습니다: ${error?.message ?? ""}` })); return; }
        await supabase.from("leaflet_submissions").update({ status: "published", event_id: ev.id, handled_at: new Date().toISOString() }).eq("id", s.id);
        setMsg(m => ({ ...m, [s.id]: "등록했습니다" }));
        load();
    };

    const reject = async (s: Sub) => {
        const { error } = await supabase.from("leaflet_submissions").update({ status: "rejected", admin_note: msg[`note-${s.id}`] || null, handled_at: new Date().toISOString() }).eq("id", s.id);
        if (!error) load();
    };

    return (
        <Container size="lg" pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>리플렛 제출</Title>
                    <Text c="dimmed" size="sm">단체가 올린 리플렛. 클로드 예약작업이 글자를 읽어 칸을 채웁니다(«읽음»). 이미지와 맞춰 보고 고친 뒤 등록하면 바로 공개됩니다. 적혀 있지 않은 것은 채우지 않습니다.</Text>
                </div>
                <SegmentedControl value={filter} onChange={x => setFilter(x as "todo" | "all")} data={[{ label: "처리할 것", value: "todo" }, { label: "전체", value: "all" }]} />
            </Group>
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? <Text c="dimmed">처리할 리플렛이 없습니다.</Text> : (
                <Stack gap="lg">
                    {rows.map(s => {
                        const d = drafts[s.id];
                        const a = s.ai_result || {};
                        return (
                            <Paper key={s.id} withBorder p="md">
                                <Group justify="space-between" mb="xs">
                                    <Group gap="xs">
                                        <Badge color={STATUS[s.status].color}>{STATUS[s.status].label}</Badge>
                                        <Badge variant="outline">{s.image_kind === "file" ? "리플렛·포스터 파일" : "휴대폰 사진(포스터로 안 씀)"}</Badge>
                                        <Text size="sm" fw={700}>{s.group_name}</Text>
                                    </Group>
                                    <Text size="xs" c="dimmed">{new Date(s.created_at).toLocaleString("ko-KR")} · 권리 확인 {s.rights_version}</Text>
                                </Group>
                                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                                    <div>
                                        {urls[s.id] ? <a href={urls[s.id]} target="_blank" rel="noopener noreferrer"><img src={urls[s.id]} alt={`${s.group_name ?? ""} 리플렛`} style={{ maxWidth: "100%", maxHeight: 520, border: "1px solid #ccc" }} /></a> : <Text c="dimmed" size="sm">이미지 없음(1년이 지나 지웠거나 못 읽음)</Text>}
                                        {s.official_url && <Text size="sm" mt={6}>공식 안내: <Anchor href={s.official_url} target="_blank" rel="noopener noreferrer">{s.official_url}</Anchor></Text>}
                                        {Object.keys(s.given).length > 0 && <Text size="sm" mt={6}>단체가 적은 것: {Object.entries(s.given).map(([k, x]) => `${k} «${x}»`).join(" · ")}</Text>}
                                        {s.note && <Text size="sm" mt={6}>더 알려 준 것: {s.note}</Text>}
                                        {a.error && <Text size="sm" c="red" mt={6}>읽지 못함: {String(a.error)}</Text>}
                                        {s.ai_result && !a.error && (
                                            <Text size="xs" c="dimmed" mt={6}>
                                                읽은 원문 — {["title", "date_text", "time_text", "venue", "price_text", "booking_text", "organizer"].map(k => {
                                                    const f = a[k] as Field | undefined;
                                                    return f?.raw ? `${k}: «${f.raw}»${f.confidence === "low" ? "(확신 낮음)" : ""}` : null;
                                                }).filter(Boolean).join(" · ") || "없음"}
                                            </Text>
                                        )}
                                    </div>
                                    {d && s.status !== "published" && s.status !== "rejected" ? (
                                        <Stack gap={6}>
                                            <TextInput label="제목" value={d.title} onChange={e => setD(s.id, "title", e.currentTarget.value)} />
                                            <Group grow>
                                                <Select label="분야" data={CATEGORIES} value={d.category || null} onChange={x => setD(s.id, "category", x ?? "")} />
                                                <Select label="지역" data={GN_REGIONS} value={d.region || null} onChange={x => setD(s.id, "region", x ?? "")} searchable />
                                            </Group>
                                            <TextInput label="장소" value={d.venue} onChange={e => setD(s.id, "venue", e.currentTarget.value)} />
                                            <Group grow>
                                                <TextInput label="시작일" type="date" value={d.date_start} onChange={e => setD(s.id, "date_start", e.currentTarget.value)} />
                                                <TextInput label="끝나는 날" type="date" value={d.date_end} onChange={e => setD(s.id, "date_end", e.currentTarget.value)} />
                                            </Group>
                                            <TextInput label="관람료" value={d.price_info} onChange={e => setD(s.id, "price_info", e.currentTarget.value)} />
                                            <Checkbox label="무료" checked={d.is_free} onChange={e => setD(s.id, "is_free", e.currentTarget.checked)} />
                                            <TextInput label="원본 안내 주소(있으면)" value={d.original_url} onChange={e => setD(s.id, "original_url", e.currentTarget.value)} placeholder="없으면 «단체 제공»으로만 표시" />
                                            <Textarea label="상세 안내(이미지에 적힌 글·단체가 준 글만)" value={d.description} autosize minRows={2} onChange={e => setD(s.id, "description", e.currentTarget.value)} />
                                            <Checkbox label="이 이미지를 포스터로 쓰기" disabled={s.image_kind !== "file"} checked={d.use_poster && s.image_kind === "file"} onChange={e => setD(s.id, "use_poster", e.currentTarget.checked)} />
                                            <Group mt={6}>
                                                <Button onClick={() => publish(s)}>등록</Button>
                                                <Button variant="subtle" color="red" onClick={() => reject(s)}>반영 안 함</Button>
                                                {msg[s.id] && <Text size="sm">{msg[s.id]}</Text>}
                                            </Group>
                                        </Stack>
                                    ) : (
                                        <Stack gap={6}>
                                            {s.event_id && <Anchor component={Link} href={`/events/${s.event_id}`}>등록한 행사 보기</Anchor>}
                                            {s.admin_note && <Text size="sm">메모: {s.admin_note}</Text>}
                                        </Stack>
                                    )}
                                </SimpleGrid>
                            </Paper>
                        );
                    })}
                </Stack>
            )}
        </Container>
    );
}
