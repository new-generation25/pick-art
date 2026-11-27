"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, TextInput, Textarea, Checkbox, Loader, Anchor, SimpleGrid } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/components/admin/AdminShell";
import { GN_REGIONS, regionFromText } from "@/lib/regions";
import { EventFields, checkEvent, eventColumns, type EventDraft } from "@/components/admin/EventFields";
import { leafletSource, RIGHTS_CHECKS, RIGHTS_VERSION } from "@/lib/leaflets";
import { shrink } from "@/app/tip/leaflet/LeafletForm";

// 리플렛 제출 검토·등록 (specs/013). 클로드 예약작업이 읽은 칸(ai_result)과 단체가 적은 칸(given)을 보고 운영자가 고쳐 등록한다.
// 공개는 이 화면의 «등록»으로만(헌장 I — 운영자 확인이 검증). 공식 안내 주소가 있으면 원본으로 잇고, 출처는 «단체 제공 · 단체 이름»
// 포스터: 리플렛·포스터 «파일»만 공개 버킷(event-images)으로 복사해 쓴다. 휴대폰 사진은 포스터로 쓰지 않는다(운영자 11/26)
// 카카오톡 채널(specs/017): 챗봇으로 들어온 것(kakao_bot)과 운영자가 1:1 채팅에서 옮겨 올린 것(kakao_chat)도 같은 목록에 온다.
//   카카오로 받은 사진은 휴대폰 사진(photo)으로 다뤄 포스터로 쓰지 않는다. 글만 온 제보는 이미지 없이 글(«더 알려 준 것»)을 보고 칸을 채운다
type Field = { raw?: string | null; value?: string | null; confidence?: "high" | "low" | "none" };
type Sub = {
    id: string; user_id: string; image_path: string | null; image_kind: "file" | "photo"; official_url: string | null; group_name: string | null;
    given: Record<string, string>; note: string | null; rights_version: string; ai_result: (Record<string, Field> & { date_start?: string | null; date_end?: string | null; error?: string; personal_info_visible?: boolean; venue_match?: VenueMatch | null; genre?: GenreGuess | null }) | null;
    status: "uploaded" | "read" | "published" | "rejected"; admin_note: string | null; event_id: string | null; created_at: string;
    channel: "web" | "kakao_bot" | "kakao_chat";
};
/** 읽은 장소 글자를 확인된 장소 목록(venues)과 맞춘 결과(collector leaflet_queue.match_venue, 11/27 검증에서 더함) */
type VenueMatch = { venue_id: string; name: string; region: string };
type Draft = EventDraft & { group_name: string; use_poster: boolean };
/** 읽은 장르 낱말로 규칙이 정한 분야·세부 갈래(collector leaflet_queue.guess_genre, 운영자 11/28 «장르 연극인건 못읽었어?»). 애매하면 비어 있다 */
type GenreGuess = { category: string | null; subcategory: string | null; evidence?: string };

const CHANNEL = { web: "사이트", kakao_bot: "카카오 챗봇", kakao_chat: "카카오 채팅(운영자가 옮김)" } as const;
const STATUS = { uploaded: { label: "읽기 전", color: "gray" }, read: { label: "읽음", color: "blue" }, published: { label: "등록함", color: "teal" }, rejected: { label: "반영 안 함", color: "red" } } as const;
const v = (f?: Field) => (f && f.confidence !== "none" ? f.value ?? "" : "");

function draftOf(s: Sub): Draft {
    const a = s.ai_result || {};
    const regionHint = v(a.region_hint as Field);
    return {
        group_name: s.group_name || v(a.organizer as Field),
        title: s.given.title || v(a.title as Field),
        // 분야·세부 갈래: 규칙이 정했으면 미리 고른다(운영자가 바꿀 수 있다)
        category: a.genre?.category ?? "",
        subcategory: (a.genre?.category && a.genre?.subcategory) || "",
        // 지역: 포스터에 인쇄된 시·군을 먼저, 없으면 장소 목록에서 찾은 장소의 지역(포스터에 지역 이름이 없는 일이 많다 — 11/27 검증 12건 중 3건)
        region: regionFromText(regionHint) ?? (GN_REGIONS.find(r => r === a.venue_match?.region) ?? ""),
        venue: s.given.venue || v(a.venue as Field),
        date_start: (a.date_start as string) || "",
        date_end: (a.date_end as string) || (a.date_start as string) || "",
        price_info: v(a.price_text as Field),
        is_free: /무료/.test(v(a.price_text as Field)),
        original_url: s.official_url || (/^https?:\/\//.test(v(a.booking_url as Field)) ? v(a.booking_url as Field) : ""),
        description: s.note || "",
        // 휴대폰 사진, 개인 연락처가 보이는 이미지는 포스터로 쓰지 않는다(운영자 11/26, FR-042)
        use_poster: s.image_kind === "file" && !s.ai_result?.personal_info_visible,
    };
}

/** 카카오톡 채널 1:1 채팅으로 받은 사진을 운영자가 옮겨 올린다(specs/017, 챗봇이 아닌 길). 저장은 013과 같은 버킷·표, channel=kakao_chat */
function KakaoChatUpload({ onDone }: { onDone: () => void }) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [group, setGroup] = useState("");
    const [note, setNote] = useState("");
    const [consent, setConsent] = useState(false);
    const [state, setState] = useState("");
    const send = async () => {
        if (!file || !group.trim() || !consent) { setState("사진·단체 이름·동의 확인을 채워 주세요"); return; }
        setState("올리는 중…");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("로그인이 필요합니다");
            const blob = await shrink(file);
            const id = crypto.randomUUID();
            const path = `${session.user.id}/${id}.jpg`;
            const up = await supabase.storage.from("leaflets").upload(path, blob, { contentType: "image/jpeg", upsert: false });
            if (up.error) throw new Error(up.error.message);
            const { error } = await supabase.from("leaflet_submissions").insert({
                id, user_id: session.user.id, channel: "kakao_chat", image_path: path, image_kind: "photo",
                group_name: group.trim().slice(0, 80), note: note.trim().slice(0, 1000) || null, given: {},
                rights_version: `chat-${RIGHTS_VERSION}`,
            });
            if (error) throw new Error(error.message);
            setFile(null); setGroup(""); setNote(""); setConsent(false);
            setState("올렸습니다 — 예약작업이 읽으면 «읽음»으로 바뀝니다");
            onDone();
        } catch (e) {
            setState(`올리지 못했습니다: ${e instanceof Error ? e.message : ""}`);
        }
    };
    if (!open) return <Button variant="light" color="yellow" mb="md" onClick={() => setOpen(true)}>카카오톡 채팅으로 받은 사진 올리기</Button>;
    return (
        <Paper withBorder p="md" mb="lg">
            <Text fw={700} mb={4}>카카오톡 채널 1:1 채팅으로 받은 사진 옮겨 올리기</Text>
            <Text size="xs" c="dimmed" mb="sm">채팅에서 사진을 내려받아 고릅니다. 카카오로 받은 사진은 포스터로 쓰지 않습니다(휴대폰 사진과 같음). 보낸 사람의 카카오 이름·전화번호는 적지 않습니다.</Text>
            <Stack gap={6}>
                <input type="file" accept="image/*" onChange={e => setFile(e.currentTarget.files?.[0] ?? null)} />
                <TextInput label="단체 이름" value={group} onChange={e => setGroup(e.currentTarget.value)} maxLength={80} />
                <Textarea label="채팅에 함께 온 글(행사 내용만, 연락처는 빼고)" value={note} autosize minRows={2} onChange={e => setNote(e.currentTarget.value)} maxLength={1000} />
                <Checkbox label={`채팅에서 권리 확인 두 문장(«${RIGHTS_CHECKS[0].slice(0, 18)}…» 등, ${RIGHTS_VERSION})을 보내고 «동의» 답을 받았습니다`} checked={consent} onChange={e => setConsent(e.currentTarget.checked)} />
                <Group><Button onClick={send}>올리기</Button><Button variant="subtle" onClick={() => setOpen(false)}>닫기</Button>{state && <Text size="sm">{state}</Text>}</Group>
            </Stack>
        </Paper>
    );
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

    // 처리한 뒤에는 목록과 함께 메뉴의 대기 숫자도 다시 읽는다 (운영자 2026-11-28 «협약이 완료되면 숫자1 지워져야 함»)
    const { reload: reloadCounts } = useAdmin();
    const refresh = useCallback(() => { load(); reloadCounts(); }, [load, reloadCounts]);

    const setD = (id: string, k: keyof Draft, value: string | boolean) => setDrafts(d => ({ ...d, [id]: { ...d[id], [k]: value } }));

    const publish = async (s: Sub) => {
        const d = drafts[s.id];
        const missing = [...(d.group_name.trim() ? [] : ["단체 이름"]), ...checkEvent(d)];
        if (missing.length) { setMsg(m => ({ ...m, [s.id]: `${missing.join(" · ")}을(를) 확인해 주세요` })); return; }
        setMsg(m => ({ ...m, [s.id]: "등록 중…" }));
        let poster = "";
        if (d.use_poster && s.image_kind === "file" && !s.ai_result?.personal_info_visible && s.image_path) {
            const { data: blob } = await supabase.storage.from("leaflets").download(s.image_path);
            if (blob) {
                const path = `leaflets/${s.id}.jpg`;
                const up = await supabase.storage.from("event-images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
                if (!up.error) poster = supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
            }
            if (!poster) { setMsg(m => ({ ...m, [s.id]: "포스터를 옮기지 못했습니다(포스터 없이 하려면 체크를 끄세요)" })); return; }
        }
        const { data: ev, error } = await supabase.from("events").insert({
            ...eventColumns(d),
            ...(d.subcategory ? { subcategory_by: "admin", subcategory_pending: false, subcategory_evidence: "운영자 확정" } : {}),
            poster_image_url: poster || null, source: leafletSource(d.group_name),
            status: "PUBLISHED", published_at: new Date().toISOString(),
        }).select("id").single();
        if (error || !ev) { setMsg(m => ({ ...m, [s.id]: `등록하지 못했습니다: ${error?.message ?? ""}` })); return; }
        await supabase.from("leaflet_submissions").update({ status: "published", event_id: ev.id, group_name: d.group_name.trim().slice(0, 80), handled_at: new Date().toISOString() }).eq("id", s.id);
        setMsg(m => ({ ...m, [s.id]: "등록했습니다" }));
        refresh();
    };

    const reject = async (s: Sub) => {
        const { error } = await supabase.from("leaflet_submissions").update({ status: "rejected", admin_note: msg[`note-${s.id}`] || null, handled_at: new Date().toISOString() }).eq("id", s.id);
        if (!error) refresh();
    };

    return (
        <Container fluid px={0} pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>리플렛 제출</Title>
                    <Text c="dimmed" size="sm">단체가 올린 리플렛(사이트·카카오톡 채널). 클로드 예약작업이 글자를 읽어 칸을 채웁니다(«읽음»). 이미지와 맞춰 보고 고친 뒤 등록하면 바로 공개됩니다. 적혀 있지 않은 것은 채우지 않습니다.</Text>
                </div>
                <SegmentedControl value={filter} onChange={x => setFilter(x as "todo" | "all")} data={[{ label: "처리할 것", value: "todo" }, { label: "전체", value: "all" }]} />
            </Group>
            <KakaoChatUpload onDone={load} />
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
                                        {s.channel !== "web" && <Badge color="yellow" variant="light">{CHANNEL[s.channel]}</Badge>}
                                        <Badge variant="outline">{!s.image_path && s.channel === "kakao_bot" && !s.ai_result?.error ? "글만 보냄" : s.image_kind === "file" ? "리플렛·포스터 파일" : "휴대폰 사진(포스터로 안 씀)"}</Badge>
                                        <Text size="sm" fw={700}>{s.group_name}</Text>
                                    </Group>
                                    <Text size="xs" c="dimmed">{new Date(s.created_at).toLocaleString("ko-KR")} · 권리 확인 {s.rights_version}</Text>
                                </Group>
                                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                                    <div>
                                        {urls[s.id] ? <a href={urls[s.id]} target="_blank" rel="noopener noreferrer"><img src={urls[s.id]} alt={`${s.group_name ?? ""} 리플렛`} style={{ maxWidth: "100%", maxHeight: 520, border: "1px solid #ccc" }} /></a> : <Text c="dimmed" size="sm">{s.channel === "kakao_bot" && !a.error ? "사진 없이 글로 받은 제보(아래 «더 알려 준 것»)" : "이미지 없음(1년이 지나 지웠거나 못 읽음)"}</Text>}
                                        {s.official_url && <Text size="sm" mt={6}>공식 안내: <Anchor href={s.official_url} target="_blank" rel="noopener noreferrer">{s.official_url}</Anchor></Text>}
                                        {Object.keys(s.given).length > 0 && <Text size="sm" mt={6}>단체가 적은 것: {Object.entries(s.given).map(([k, x]) => `${k} «${x}»`).join(" · ")}</Text>}
                                        {s.note && <Text size="sm" mt={6}>더 알려 준 것: {s.note}</Text>}
                                        {a.error && <Text size="sm" className="pica-err" mt={6}>읽지 못함: {String(a.error)}</Text>}
                                        {s.ai_result && !a.error && (
                                            <Text size="xs" c="dimmed" mt={6}>
                                                읽은 원문 — {["title", "genre_text", "date_text", "time_text", "venue", "price_text", "booking_text", "organizer"].map(k => {
                                                    const f = a[k] as Field | undefined;
                                                    return f?.raw ? `${k}: «${f.raw}»${f.confidence === "low" ? "(확신 낮음)" : ""}` : null;
                                                }).filter(Boolean).join(" · ") || "없음"}
                                            </Text>
                                        )}
                                        {s.ai_result?.genre?.category && (
                                            <Text size="xs" c="dimmed" mt={4}>분야·갈래를 미리 골랐습니다: {s.ai_result.genre.category}{s.ai_result.genre.subcategory ? ` · ${s.ai_result.genre.subcategory}` : ""} ({s.ai_result.genre.evidence})</Text>
                                        )}
                                        {s.ai_result?.venue_match && (
                                            <Text size="xs" c="dimmed" mt={4}>장소 목록에서 찾음: {s.ai_result.venue_match.name} ({s.ai_result.venue_match.region}) — 포스터에 지역이 없으면 이 지역을 미리 채웁니다</Text>
                                        )}
                                    </div>
                                    {d && s.status !== "published" && s.status !== "rejected" ? (
                                        <Stack gap={6}>
                                            <TextInput label="단체 이름(출처 «단체 제공 · 이름»)" value={d.group_name} onChange={e => setD(s.id, "group_name", e.currentTarget.value)} />
                                            <EventFields value={d} onChange={next => setDrafts(x => ({ ...x, [s.id]: { ...x[s.id], ...next } }))}
                                                urlNote={!s.official_url && d.original_url ? "단체가 적은 주소가 아니라 리플렛에 인쇄된 예매 주소로 채웠습니다. 열리는지 눌러 확인해 주세요." : "없으면 비워 둡니다(출처는 «단체 제공»으로 표시)."}
                                                descriptionLabel="상세 안내(이미지에 적힌 글·단체가 준 글만)" />
                                            <Checkbox label={a.personal_info_visible ? "이 이미지를 포스터로 쓰기 — 개인 연락처가 보여 쓸 수 없음(단체에 번호 없는 판을 요청)" : "이 이미지를 포스터로 쓰기"}
                                                disabled={s.image_kind !== "file" || !!a.personal_info_visible}
                                                checked={d.use_poster && s.image_kind === "file" && !a.personal_info_visible}
                                                onChange={e => setD(s.id, "use_poster", e.currentTarget.checked)} />
                                            <TextInput label="메모(관리자만 봄)" description="반영하지 않을 때 이유를 적어 둡니다." value={msg[`note-${s.id}`] || ""}
                                                onChange={e => { const v = e.currentTarget.value; setMsg(m => ({ ...m, [`note-${s.id}`]: v })); }} />
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
