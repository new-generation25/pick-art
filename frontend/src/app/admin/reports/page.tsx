"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, Textarea, Anchor, Loader } from "@mantine/core";
import { supabase } from "@/lib/supabase";

// 오류 신고·행사 제보 처리 (specs/007, 020). 관리자 RLS 로 읽고 상태만 바꾼다.
// 제보 반영은 원문을 확인한 뒤 «행사로 등록»(/admin/events/new) 또는 큐레이션으로 한다 — 여기서 자동 공개하지 않는다(헌장 I)
// 쿠폰 연락처(020): 관리자만 보인다. 쿠폰을 보낸 뒤 «쿠폰 보냄 · 연락처 지우기»로 지운다. 90일 지난 연락처는 이 화면을 열 때 비운다
type Tip = { title?: string; date_start?: string; date_end?: string; venue?: string; region?: string; url?: string; photo?: boolean };
type Report = {
    id: string; kind: "error" | "tip"; event_id: string | null; user_id: string | null; category: string | null; body: string;
    tip: Tip | null;
    status: "new" | "done" | "rejected"; admin_note: string | null; created_at: string; handled_at: string | null;
    photo_path: string | null; credit_name: string | null; reward_contact: string | null; reward_sent_at: string | null;
    events?: { title: string } | null;
};
type Filter = "new" | "reward" | "all";
type Week = { done: number; withContact: number; sent: number };

const STATUS = { new: { label: "새로 옴", color: "red" }, done: { label: "반영함", color: "teal" }, rejected: { label: "반영 안 함", color: "gray" } } as const;
const CONTACT_KEEP_DAYS = 90;

function when(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const safeUrl = (u?: string) => (u && /^https?:\/\//.test(u) ? u : null);

/** 이번 주 월요일 0시(한국 시각)의 ISO 시각 */
function weekStartISO(now = new Date()): string {
    const kst = new Date(now.getTime() + 9 * 3600 * 1000);
    const back = (kst.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - back) - 9 * 3600 * 1000).toISOString();
}

/** 제보에 적힌 내용을 «새 행사» 양식에 채워 여는 주소. 저장하면 이 제보가 «반영함»으로 닫힌다 */
function tipHref(r: { id: string; tip: Tip | null }): string {
    const t = r.tip || {};
    const q = new URLSearchParams({ report: r.id });
    if (t.title) q.set("title", t.title);
    if (t.date_start) q.set("start", t.date_start);
    if (t.date_end) q.set("end", t.date_end);
    if (t.venue) q.set("venue", t.venue);
    if (t.region) q.set("region", t.region);
    if (t.url) q.set("url", t.url);
    return `/admin/events/new?${q.toString()}`;
}

export default function AdminReportsPage() {
    const [filter, setFilter] = useState<Filter>("new");
    const [rows, setRows] = useState<Report[] | null>(null);
    const [week, setWeek] = useState<Week | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [photos, setPhotos] = useState<Record<string, string>>({});   // 제보 id → 10분짜리 사진 주소 또는 "none"

    const load = useCallback(async () => {
        let q = supabase.from("reports").select("*, events(title)").order("created_at", { ascending: false }).limit(200);
        if (filter === "new") q = q.eq("status", "new");
        if (filter === "reward") q = q.eq("kind", "tip").eq("status", "done").not("reward_contact", "is", null);
        const { data, error } = await q;
        if (error) setError(error.message);
        setRows((data || []) as Report[]);
        // 이번 주(월~일) 반영한 제보: 쿠폰 5명을 고르는 바탕
        const { data: w } = await supabase.from("reports").select("reward_contact,reward_sent_at")
            .eq("kind", "tip").eq("status", "done").gte("handled_at", weekStartISO()).limit(500);
        if (w) setWeek({ done: w.length, withContact: w.filter(x => x.reward_contact).length, sent: w.filter(x => x.reward_sent_at).length });
    }, [filter]);

    // 90일 지난 쿠폰 연락처는 화면을 열 때 비운다(개인정보처리방침). 정리 작업(leaflet_queue.py --cleanup)도 같은 일을 한다
    useEffect(() => {
        const before = new Date(Date.now() - CONTACT_KEEP_DAYS * 86400000).toISOString();
        supabase.from("reports").update({ reward_contact: null }).not("reward_contact", "is", null).lt("created_at", before).then(() => undefined);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handle = async (r: Report, status: "done" | "rejected" | "new") => {
        const { data, error } = await supabase.from("reports")
            .update({ status, admin_note: notes[r.id] ?? r.admin_note, handled_at: status === "new" ? null : new Date().toISOString() })
            .eq("id", r.id).select("status");
        if (error || !data?.length) { setError(error?.message || "저장하지 못했습니다(권한 확인)"); return; }
        load();
    };

    const openPhoto = async (r: Report) => {
        if (!r.photo_path) return;
        const { data, error } = await supabase.storage.from("leaflets").createSignedUrl(r.photo_path, 600);
        setPhotos(p => ({ ...p, [r.id]: error || !data?.signedUrl ? "none" : data.signedUrl }));
    };

    const rewardSent = async (r: Report) => {
        const { data, error } = await supabase.from("reports")
            .update({ reward_contact: null, reward_sent_at: new Date().toISOString() })
            .eq("id", r.id).select("id");
        if (error || !data?.length) { setError(error?.message || "지우지 못했습니다(권한 확인)"); return; }
        load();
    };

    const emptyText = filter === "new" ? "새로 온 신고·제보가 없습니다."
        : filter === "reward" ? "반영한 제보 가운데 연락처가 남아 있는 것이 없습니다."
        : "아직 신고·제보가 없습니다.";

    return (
        <Container size="lg" pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>신고·제보</Title>
                    <Text c="dimmed" size="sm">«정보가 틀렸어요»(회원)와 «행사 제보»(로그인 없이도 옴). 원문으로 확인한 뒤 행사를 고치거나 등록하고 «반영함»으로 닫습니다.</Text>
                </div>
                <SegmentedControl value={filter} onChange={v => setFilter(v as Filter)}
                    data={[{ label: "새로 온 것", value: "new" }, { label: "쿠폰 대상", value: "reward" }, { label: "전체", value: "all" }]} />
            </Group>
            {week && (
                <Paper withBorder p="sm" radius="md" mb="md">
                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                        <b>이번 주(월~일) 반영한 제보 {week.done}건</b> · 연락처를 남긴 제보 {week.withContact}건 · 쿠폰 보냄 {week.sent}건.
                        {" "}매주 5명에게 커피 쿠폰을 보냅니다(같은 사람 한 주 1장). 보낸 뒤 «쿠폰 보냄 · 연락처 지우기»를 눌러 주세요. 보내지 않은 연락처는 {CONTACT_KEEP_DAYS}일 뒤 지워집니다.
                    </Text>
                </Paper>
            )}
            {error && <Text c="red" mb="md">{error}</Text>}
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? (
                <Text c="dimmed">{emptyText}</Text>
            ) : (
                <Stack gap="md">
                    {rows.map(r => (
                        <Paper key={r.id} withBorder p="md" radius="md">
                            <Group justify="space-between" mb={6}>
                                <Group gap="xs">
                                    <Badge color={r.kind === "error" ? "orange" : "blue"} variant="light">{r.kind === "error" ? "오류 신고" : "행사 제보"}</Badge>
                                    {r.category && <Badge variant="outline" color="gray">{r.category}</Badge>}
                                    <Badge color={STATUS[r.status].color} variant={r.status === "new" ? "filled" : "light"}>{STATUS[r.status].label}</Badge>
                                    <Badge variant="outline" color="gray">{r.user_id ? "회원" : "로그인 없이"}</Badge>
                                    {r.reward_sent_at && <Badge color="teal" variant="outline">쿠폰 보냄 {when(r.reward_sent_at).split(" ")[0]}</Badge>}
                                </Group>
                                <Text size="xs" c="dimmed">{when(r.created_at)}{r.handled_at ? ` · 처리 ${when(r.handled_at)}` : ""}</Text>
                            </Group>
                            {r.kind === "error" && r.event_id && (
                                <Anchor component={Link} href={`/events/${r.event_id}`} target="_blank" fw={700}>{r.events?.title || "행사 보기"}</Anchor>
                            )}
                            {r.kind === "tip" && r.tip && (
                                <Stack gap={2}>
                                    <Text fw={700} style={{ overflowWrap: "anywhere" }}>{r.tip.title}</Text>
                                    {(r.tip.date_start || r.tip.venue) && (
                                        <Text size="sm">
                                            {[
                                                r.tip.date_start ? `${r.tip.date_start}${r.tip.date_end && r.tip.date_end !== r.tip.date_start ? ` ~ ${r.tip.date_end}` : ""}` : "",
                                                r.tip.venue ? `${r.tip.venue}${r.tip.region ? ` (${r.tip.region})` : ""}` : (r.tip.region || ""),
                                            ].filter(Boolean).join(" · ")}
                                        </Text>
                                    )}
                                    {r.tip.url && (safeUrl(r.tip.url)
                                        ? <Anchor href={safeUrl(r.tip.url)!} target="_blank" rel="noopener noreferrer" size="sm" style={{ overflowWrap: "anywhere" }}>{r.tip.url}</Anchor>
                                        : <Text size="sm" style={{ overflowWrap: "anywhere" }}>{r.tip.url}</Text>)}
                                    {r.tip.photo && (
                                        r.photo_path ? (
                                            photos[r.id] === "none" ? <Text size="sm" c="dimmed">사진 없음(올리기 실패)</Text>
                                                : photos[r.id] ? (
                                                    <a href={photos[r.id]} target="_blank" rel="noopener noreferrer">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={photos[r.id]} alt="제보 사진" style={{ maxHeight: 320, maxWidth: "100%", borderRadius: 8, marginTop: 6 }} />
                                                    </a>
                                                ) : <Button size="xs" variant="default" mt={4} w="fit-content" onClick={() => openPhoto(r)}>사진 보기</Button>
                                        ) : <Text size="sm" c="dimmed">사진 없음(올리기 실패했거나 보관 기간이 지나 지움)</Text>
                                    )}
                                    {r.credit_name && <Text size="sm">표시 이름: <b>제보: {r.credit_name}</b> <Text span c="dimmed">(«행사로 등록»할 때 행사 화면에 넣을 수 있음)</Text></Text>}
                                </Stack>
                            )}
                            <Text size="sm" mt={8} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.body}</Text>
                            {r.reward_contact && (
                                <Group gap="xs" mt="sm" align="center">
                                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>쿠폰 연락처: <b>{r.reward_contact}</b></Text>
                                    <Button size="xs" color="teal" variant="light" onClick={() => rewardSent(r)}>쿠폰 보냄 · 연락처 지우기</Button>
                                </Group>
                            )}
                            <Textarea
                                mt="sm" size="xs" autosize minRows={1} placeholder="처리 메모(관리자만 봄)"
                                value={notes[r.id] ?? r.admin_note ?? ""}
                                onChange={e => { const v = e.currentTarget.value; setNotes(n => ({ ...n, [r.id]: v })); }}
                            />
                            <Group gap="xs" mt="sm">
                                {r.status !== "done" && <Button size="xs" color="teal" onClick={() => handle(r, "done")}>반영함</Button>}
                                {r.status !== "rejected" && <Button size="xs" variant="default" onClick={() => handle(r, "rejected")}>반영 안 함</Button>}
                                {r.status !== "new" && <Button size="xs" variant="subtle" onClick={() => handle(r, "new")}>다시 열기</Button>}
                                {r.kind === "tip" && <Button size="xs" variant="light" component={Link} href={tipHref(r)}>행사로 등록</Button>}
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Container>
    );
}
