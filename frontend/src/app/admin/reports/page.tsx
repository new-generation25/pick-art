"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, Textarea, Anchor, Loader, Modal } from "@mantine/core";
import { ChevronRight, ImageIcon, Link2, Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/components/admin/AdminShell";

// 오류 신고·행사 제보 처리 (specs/007, 020, 021). 관리자 RLS 로 읽고 상태만 바꾼다.
// 목록은 한눈에 보는 카드, 카드를 누르면 자세히 보기 창이 열리고 처리(반영함·반영 안 함·행사로 등록)는 그 창에서 한다(운영자 11/27).
// 제보 반영은 원문을 확인한 뒤 «행사로 등록»(/admin/events/new) 또는 큐레이션으로 한다 — 여기서 자동 공개하지 않는다(헌장 I)
// 포인트(021): 회원이 보낸 제보를 «반영함»으로 닫으면 DB 트리거가 그 회원에게 100P 를 넣고, «다시 열기»·«반영 안 함»이면 뺀다
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
// top: 이번 주에 반영된 제보가 많은 회원 순(운영자 11/27 «제일 많이 알리신 두 분은 무조건 당첨»). 로그인 없이 온 제보는 사람을 알 수 없어 뺀다
type Week = { done: number; withContact: number; sent: number; top: { user_id: string; name: string; count: number; hasContact: boolean }[] };

const STATUS = { new: { label: "새로 옴", color: "red" }, done: { label: "반영함", color: "teal" }, rejected: { label: "반영 안 함", color: "gray" } } as const;
const CONTACT_KEEP_DAYS = 90;
const NO_BODY = "(설명 없음)";

function when(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const safeUrl = (u?: string) => (u && /^https?:\/\//.test(u) ? u : null);
const hostOf = (u?: string) => { try { return new URL(u || "").host.replace(/^www\./, ""); } catch { return ""; } };

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

const titleOf = (r: Report) => r.kind === "tip" ? (r.tip?.title || "행사 제보") : (r.events?.title || "오류 신고");
function whenWhere(t: Tip | null): string {
    if (!t) return "";
    return [
        t.date_start ? `${t.date_start}${t.date_end && t.date_end !== t.date_start ? ` ~ ${t.date_end}` : ""}` : "",
        t.venue ? `${t.venue}${t.region ? ` (${t.region})` : ""}` : (t.region || ""),
    ].filter(Boolean).join(" · ");
}

function Badges({ r }: { r: Report }) {
    return (
        <Group gap="xs">
            <Badge color={r.kind === "error" ? "orange" : "blue"} variant="light">{r.kind === "error" ? "오류 신고" : "행사 제보"}</Badge>
            {r.category && <Badge variant="outline" color="gray">{r.category}</Badge>}
            <Badge color={STATUS[r.status].color} variant={r.status === "new" ? "filled" : "light"}>{STATUS[r.status].label}</Badge>
            <Badge variant="outline" color="gray">{r.user_id ? "회원" : "로그인 없이"}</Badge>
            {r.kind === "tip" && r.user_id && r.status === "done" && <Badge color="green" variant="light">100P 적립</Badge>}
            {r.reward_sent_at && <Badge color="teal" variant="outline">쿠폰 보냄 {when(r.reward_sent_at).split(" ")[0]}</Badge>}
        </Group>
    );
}

export default function AdminReportsPage() {
    const { reload: reloadCounts } = useAdmin();
    const [filter, setFilter] = useState<Filter>("new");
    const [rows, setRows] = useState<Report[] | null>(null);
    const [week, setWeek] = useState<Week | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [photos, setPhotos] = useState<Record<string, string>>({});   // 제보 id → 10분짜리 사진 주소 또는 "none"
    const [openId, setOpenId] = useState<string | null>(null);

    const load = useCallback(async () => {
        let q = supabase.from("reports").select("*, events(title)").order("created_at", { ascending: false }).limit(200);
        if (filter === "new") q = q.eq("status", "new");
        if (filter === "reward") q = q.eq("kind", "tip").eq("status", "done").not("reward_contact", "is", null);
        const { data, error } = await q;
        if (error) setError(error.message);
        setRows((data || []) as Report[]);
        // 이번 주(월~일) 반영한 제보: 쿠폰 5명을 고르는 바탕
        const { data: w } = await supabase.from("reports").select("user_id,reward_contact,reward_sent_at")
            .eq("kind", "tip").eq("status", "done").gte("handled_at", weekStartISO()).limit(500);
        if (w) {
            const by = new Map<string, { count: number; hasContact: boolean }>();
            for (const x of w as { user_id: string | null; reward_contact: string | null }[]) {
                if (!x.user_id) continue;
                const cur = by.get(x.user_id) || { count: 0, hasContact: false };
                by.set(x.user_id, { count: cur.count + 1, hasContact: cur.hasContact || !!x.reward_contact });
            }
            const ranked = [...by.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
            const { data: names } = ranked.length
                ? await supabase.from("profiles").select("id,nickname").in("id", ranked.map(r => r[0]))
                : { data: [] as { id: string; nickname: string | null }[] };
            const nameOf = new Map((names || []).map(n => [n.id as string, (n.nickname as string | null)?.trim() || "별명 없음"]));
            setWeek({
                done: w.length, withContact: w.filter(x => x.reward_contact).length, sent: w.filter(x => x.reward_sent_at).length,
                top: ranked.map(([user_id, v]) => ({ user_id, name: nameOf.get(user_id) || "별명 없음", ...v })),
            });
        }
    }, [filter]);

    // 90일 지난 쿠폰 연락처는 화면을 열 때 비운다(개인정보처리방침). 정리 작업(leaflet_queue.py --cleanup)도 같은 일을 한다
    useEffect(() => {
        const before = new Date(Date.now() - CONTACT_KEEP_DAYS * 86400000).toISOString();
        supabase.from("reports").update({ reward_contact: null }).not("reward_contact", "is", null).lt("created_at", before).then(() => undefined);
    }, []);

    useEffect(() => { load(); }, [load]);

    const open = rows?.find(r => r.id === openId) || null;

    // 자세히 보기 창을 열면 사진을 바로 불러온다(관리자에게만 열리는 10분짜리 주소)
    useEffect(() => {
        if (!open?.photo_path || photos[open.id]) return;
        const { id, photo_path } = open;
        supabase.storage.from("leaflets").createSignedUrl(photo_path, 600)
            .then(({ data, error }) => setPhotos(p => ({ ...p, [id]: error || !data?.signedUrl ? "none" : data.signedUrl })));
    }, [open, photos]);

    const handle = async (r: Report, status: "done" | "rejected" | "new") => {
        const { data, error } = await supabase.from("reports")
            .update({ status, admin_note: notes[r.id] ?? r.admin_note, handled_at: status === "new" ? null : new Date().toISOString() })
            .eq("id", r.id).select("status");
        if (error || !data?.length) { setError(error?.message || "저장하지 못했습니다(권한 확인)"); return; }
        setOpenId(null);
        load();
        reloadCounts();   // 메뉴의 대기 숫자도 바로 맞춘다
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
        <Container fluid px={0} pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>신고·제보</Title>
                    <Text c="dimmed" size="sm">«정보가 틀렸어요»와 «행사 제보»(숨은 행사 찾기). 카드를 누르면 자세히 볼 수 있고, 처리는 그 창에서 합니다. 회원 제보를 «반영함»으로 닫으면 그 회원에게 100포인트가 쌓입니다.</Text>
                </div>
                <SegmentedControl value={filter} onChange={v => setFilter(v as Filter)}
                    data={[{ label: "새로 온 것", value: "new" }, { label: "쿠폰 대상", value: "reward" }, { label: "전체", value: "all" }]} />
            </Group>
            {week && (
                <Paper withBorder p="sm" radius="md" mb="md">
                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                        <b>이번 주(월~일) 반영한 제보 {week.done}건</b> · 연락처를 남긴 제보 {week.withContact}건 · 쿠폰 보냄 {week.sent}건.
                        {" "}12월까지 매주 5명에게 커피 쿠폰을 보냅니다(같은 사람 한 주 1장, 당첨은 인스타그램과 카카오톡 채널에 공지). 보낸 뒤 «쿠폰 보냄 · 연락처 지우기»를 눌러 주세요. 보내지 않은 연락처는 {CONTACT_KEEP_DAYS}일 뒤 지워집니다.
                    </Text>
                    <Text size="sm" mt={6} style={{ overflowWrap: "anywhere" }}>
                        <b>이번 주 많이 알린 회원</b>(반영된 제보 수, 위 두 사람은 무조건 당첨):{" "}
                        {week.top.length === 0 ? "아직 없음" : week.top.map((t, i) => (
                            <span key={t.user_id}>{i > 0 && " · "}{i < 2 ? <b>{i + 1}. {t.name} {t.count}건</b> : <>{i + 1}. {t.name} {t.count}건</>}{!t.hasContact && <Text span c="dimmed"> (연락처 없음)</Text>}</span>
                        ))}
                        {week.top.length > 2 && week.top[1].count === week.top[2].count && <Text span c="dimmed"> — 2위와 3위가 같은 건수입니다. 누구를 넣을지는 직접 정해 주세요.</Text>}
                    </Text>
                </Paper>
            )}
            {error && <Text className="pica-err" mb="md">{error}</Text>}
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? (
                <Text c="dimmed">{emptyText}</Text>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {rows.map(r => {
                        const line = r.kind === "tip" ? whenWhere(r.tip) : "";
                        const body = r.body && r.body !== NO_BODY ? r.body : "";
                        return (
                            <div key={r.id} role="button" tabIndex={0} aria-haspopup="dialog" aria-label={`${titleOf(r)} 자세히 보기`}
                                onClick={() => setOpenId(r.id)}
                                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(r.id); } }}
                                className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-[14px] bg-card p-4 text-left shadow-[0_1px_4px_rgba(30,26,21,.1)] transition-shadow hover:shadow-[0_2px_10px_rgba(30,26,21,.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pk-accent)]">
                                <span className="flex w-full items-start justify-between gap-2">
                                    <Badges r={r} />
                                    <span className="flex-none text-[12px] text-ink-soft">{when(r.created_at)}</span>
                                </span>
                                <span className="text-[16px] font-bold leading-snug text-ink" style={{ overflowWrap: "anywhere" }}>{titleOf(r)}</span>
                                {line && <span className="text-[13.5px] text-ink">{line}</span>}
                                {body && <span className="pica-clamp-2 text-[13.5px] leading-relaxed text-ink-soft" style={{ overflowWrap: "anywhere" }}>{body}</span>}
                                <span className="mt-auto flex w-full flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[12.5px] font-semibold text-ink-soft">
                                    {r.tip?.url && <span className="inline-flex items-center gap-1"><Link2 size={13} aria-hidden />{hostOf(r.tip.url) || "링크"}</span>}
                                    {r.tip?.photo && <span className="inline-flex items-center gap-1"><ImageIcon size={13} aria-hidden />{r.photo_path ? "사진" : "사진 없음"}</span>}
                                    {r.reward_contact && <span className="inline-flex items-center gap-1 text-accent"><Ticket size={13} aria-hidden />쿠폰 연락처</span>}
                                    {r.credit_name && <span>제보: {r.credit_name}</span>}
                                    {r.admin_note && <span>메모 있음</span>}
                                    <span className="ml-auto inline-flex items-center gap-0.5 text-ink">자세히<ChevronRight size={15} aria-hidden /></span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal opened={!!open} onClose={() => setOpenId(null)} size="lg" centered
                title={<span className="text-[13px] font-semibold text-ink-soft">{open?.kind === "error" ? "오류 신고" : "행사 제보"} 자세히 보기</span>}>
                {open && (
                    <Stack gap="sm">
                        <Group justify="space-between" align="flex-start" gap="xs">
                            <Badges r={open} />
                            <Text size="xs" c="dimmed">받음 {when(open.created_at)}{open.handled_at ? ` · 처리 ${when(open.handled_at)}` : ""}</Text>
                        </Group>
                        <Text fw={800} fz={20} lh={1.3} style={{ overflowWrap: "anywhere" }}>{titleOf(open)}</Text>

                        {open.kind === "error" && open.event_id && (
                            <Anchor component={Link} href={`/events/${open.event_id}`} target="_blank" size="sm">신고된 행사 화면 열기</Anchor>
                        )}
                        {open.kind === "tip" && open.tip && (
                            <Stack gap={6}>
                                <Text size="sm"><Text span c="dimmed">날짜·장소 </Text>{whenWhere(open.tip) || "적지 않음"}</Text>
                                <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                                    <Text span c="dimmed">원문 링크 </Text>
                                    {open.tip.url
                                        ? (safeUrl(open.tip.url) ? <Anchor href={safeUrl(open.tip.url)!} target="_blank" rel="noopener noreferrer">{open.tip.url}</Anchor> : open.tip.url)
                                        : "없음(사진으로 보냄)"}
                                </Text>
                                {open.tip.photo && (
                                    !open.photo_path ? <Text size="sm" c="dimmed">사진 없음(올리기 실패했거나 보관 기간이 지나 지움)</Text>
                                        : photos[open.id] === "none" ? <Text size="sm" c="dimmed">사진 없음(올리기 실패)</Text>
                                            : photos[open.id] ? (
                                                <a href={photos[open.id]} target="_blank" rel="noopener noreferrer">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={photos[open.id]} alt="제보 사진" style={{ maxHeight: 420, maxWidth: "100%", borderRadius: 8 }} />
                                                </a>
                                            ) : <Loader size="xs" />
                                )}
                                {open.event_id && <Anchor component={Link} href={`/events/${open.event_id}`} target="_blank" size="sm">등록한 행사 보기</Anchor>}
                                {open.credit_name && <Text size="sm"><Text span c="dimmed">표시 이름 </Text><b>제보: {open.credit_name}</b> <Text span c="dimmed">(«행사로 등록»할 때 행사 화면에 넣을 수 있음)</Text></Text>}
                            </Stack>
                        )}

                        <Paper withBorder p="sm" radius="md">
                            <Text size="xs" c="dimmed" mb={4}>보낸 글</Text>
                            <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{open.body}</Text>
                        </Paper>

                        {open.reward_contact && (
                            <Group gap="xs" align="center">
                                <Text size="sm" style={{ overflowWrap: "anywhere" }}>쿠폰 연락처: <b>{open.reward_contact}</b></Text>
                                <Button size="xs" color="teal" variant="light" onClick={() => rewardSent(open)}>쿠폰 보냄 · 연락처 지우기</Button>
                            </Group>
                        )}

                        <Textarea
                            size="sm" autosize minRows={2} label="처리 메모(관리자만 봄)" placeholder="확인한 내용, 반영하지 않는 까닭 등"
                            value={notes[open.id] ?? open.admin_note ?? ""}
                            onChange={e => { const v = e.currentTarget.value; setNotes(n => ({ ...n, [open.id]: v })); }}
                        />
                        {open.kind === "tip" && open.user_id && open.status !== "done" && (
                            <Text size="xs" c="dimmed">«반영함» 또는 «행사로 등록»으로 닫으면 보낸 회원에게 100포인트가 쌓입니다. 다시 열거나 «반영 안 함»으로 바꾸면 빠집니다.</Text>
                        )}
                        <Group gap="xs" justify="flex-end">
                            {open.status !== "new" && <Button size="sm" variant="subtle" onClick={() => handle(open, "new")}>다시 열기</Button>}
                            {open.status !== "rejected" && <Button size="sm" variant="default" onClick={() => handle(open, "rejected")}>반영 안 함</Button>}
                            {open.status !== "done" && <Button size="sm" color="teal" variant={open.kind === "tip" ? "light" : "filled"} onClick={() => handle(open, "done")}>반영함</Button>}
                            {open.kind === "tip" && open.status !== "done" && <Button size="sm" component={Link} href={tipHref(open)}>행사로 등록</Button>}
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Container>
    );
}
