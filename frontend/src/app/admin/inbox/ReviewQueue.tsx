"use client";

// 인스타 후보(raw_posts.status='REVIEW')를 무더기(content.review_bucket)별로 보여 주고 처리한다 (specs/003 R2, FR-008).
//   공개 후보: 골라서 «공개 승인» → content.publish_approved_at. 다음 정기 실행이 publish_verified 로 검증 뒤 공개한다
//              (검증에 걸리면 REVIEW 로 남고 review_reason 이 «publish_failed: …»로 바뀐다)
//   사람 판단: 카드에서 바로 «공개 승인»(운영자 2026-11-28 «사람판단에서 바로 등록»). 날짜가 없는 글은 카드에 넣은
//              시작일·끝나는 날을 ai_suggestion 에 함께 써서 승인한다(공개 검증은 두 날짜가 있어야 통과한다)
//   동의 필요: 읽기 + «공개 후보로 옮기기»(review_bucket='candidate')
//   모든 탭: «반영 안 함» → status 'REJECTED'(인박스·review_instagram 이 쓰는 거절 상태. 휴지통에서 되돌리면 REVIEW 로 돌아간다)
// content 는 jsonb 라 통째로 바꾸므로, 쓰기 직전에 DB 에서 최신 content 를 다시 읽어 키를 더한다(정기 실행이 쓴 키를 지우지 않게).

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Box, Button, Group, Stack, Text, Title, Paper, Badge, Checkbox } from "@mantine/core";
import { ExternalLink, CheckCircle, XCircle, ArrowRight, Clock, AlertTriangle, MapPin, Calendar, MessageSquare } from "lucide-react";
import { notesOf, opensDetail } from "./notes";
import { IgHandle, withIgLinks } from "./igLinks";

export type ReviewBucket = "candidate" | "consent" | "human";

/** raw_posts.content 중 이 화면이 읽고 쓰는 키. 나머지 키도 그대로 둔다 */
export interface ReviewContent {
    title?: string;
    review_bucket?: string;
    review_bucket_at?: string;
    review_reason?: string;
    review_note?: string;
    publish_approved_at?: string;
    publish_approved_by?: string;
    publish_failed_at?: string;
    ai_suggestion?: {
        date_start?: string; date_end?: string; region?: string; venue?: string;
        account?: string; author?: string; role?: string; poster_url?: string;
    };
    [key: string]: unknown;
}

export interface ReviewPost {
    id: string;
    source: string;
    source_url: string;
    content: ReviewContent;
    image_urls: string[];
    collected_at: string;
    status: string;
}

/** 페이지가 목록 상태를 고치는 데 쓰는 변경 내용. status 가 REVIEW 가 아니면 목록에서 빠진다 */
export interface ReviewChange {
    id: string;
    status: string;
    content: ReviewContent;
}

export const BUCKET_LABEL: Record<ReviewBucket, string> = {
    candidate: "공개 후보",
    consent: "동의 필요",
    human: "사람 판단",
};

const BUCKET_NOTE: Record<ReviewBucket, string> = {
    candidate: "기관 계정이고 날짜·장소가 있는 후보입니다. 골라서 승인하면 다음 정기 실행(08:20·15:00)에서 날짜·링크·중복을 확인한 뒤 공개합니다.",
    consent: "작가·단체 계정 글입니다. 게시 동의를 받은 뒤 «공개 후보로 옮기기»를 누르세요.",
    human: "제보 계정·날짜 없음·장소 없음 글입니다. 원본을 보고 공개할 만하면 바로 «공개 승인»을 누르세요. 날짜가 없는 글은 시작일·끝나는 날을 넣어야 승인됩니다.",
};

const REASON_LABEL: Record<string, string> = {
    official_complete: "기관 계정 · 날짜·장소 있음",
    small_needs_consent: "작가·단체 계정 — 게시 동의 필요",
    standing_consent: "작가·단체 계정 — 상시 동의(앞으로의 정보 게시)",
    informant: "제보 계정",
    no_date: "날짜 없음",
    image_only: "포스터만 있음",
    no_venue: "장소 없음",
    no_role: "계정 역할 모름",
};

const ISO = /^20\d\d-\d\d-\d\d$/;

function errMsg(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
    return String(e);
}

export function reasonText(reason?: string): string {
    if (!reason) return "";
    if (reason.startsWith("publish_failed: ")) return `공개 검증 실패 — ${reason.slice("publish_failed: ".length)}`;
    if (reason.startsWith("admin_moved")) return "관리자가 공개 후보로 옮김";
    return REASON_LABEL[reason] ? `${REASON_LABEL[reason]} (${reason})` : reason;
}

/** 승인 상태: none(승인 전) · waiting(승인됨, 다음 실행 대기) · failed(승인 뒤 검증 실패, 다음 실행에서 다시 봄) */
export function approvalState(c: ReviewContent): "none" | "waiting" | "failed" {
    if (!c?.publish_approved_at) return "none";
    const approved = Date.parse(c.publish_approved_at);
    const failed = c.publish_failed_at ? Date.parse(c.publish_failed_at) : NaN;
    return !isNaN(failed) && failed >= approved ? "failed" : "waiting";
}

function fmtTime(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** DB 에서 최신 content 를 읽는다(REVIEW 인 줄만). 없거나 상태가 바뀌었으면 결과에서 빠진다 */
async function freshContents(ids: string[]): Promise<Record<string, ReviewContent>> {
    const out: Record<string, ReviewContent> = {};
    for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase
            .from("raw_posts")
            .select("id,status,content")
            .in("id", ids.slice(i, i + 100))
            .eq("status", "REVIEW");
        if (error) throw error;
        for (const r of data || []) out[r.id] = r.content || {};
    }
    return out;
}

/** REVIEW 인 줄의 content 만 바꾼다. 바뀐 줄이 없으면(권한·상태 변경) 오류 */
async function writeContent(id: string, content: ReviewContent) {
    const { data, error } = await supabase
        .from("raw_posts")
        .update({ content })
        .eq("id", id)
        .eq("status", "REVIEW")
        .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("바뀐 줄 없음(관리자 권한 또는 상태 변경 확인)");
}

interface Props {
    bucket: ReviewBucket;
    posts: ReviewPost[];
    loading: boolean;
    onChanged: (changes: ReviewChange[]) => void;
    /** 묶음 안에 넣을 때: 제목 줄·설명을 그리지 않는다(동의 필요의 계정별 묶음) */
    compact?: boolean;
    /** 승인·옮기기를 누른 관리자(메일). raw_posts 는 관리자만 읽는 표다 */
    actor?: string;
    /** 줄을 누르면 자세히 보기 창을 연다(대기 이유·수집한 글·운영자 코멘트) */
    onOpen?: (post: ReviewPost) => void;
}

const PAGE = 20;   // 한 번에 그리는 카드 수(동의 필요는 수백 건이다)

export function ReviewQueue({ bucket, posts, loading, onChanged, compact = false, actor = "", onOpen }: Props) {
    const [shown, setShown] = useState(PAGE);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const selectable = posts.filter((p) => approvalState(p.content) !== "waiting").map((p) => p.id);
    const picked = selected.filter((id) => selectable.includes(id));

    const AFTER_APPROVE = "다음 정기 실행에서 날짜·원본 링크·중복을 확인한 뒤 공개합니다. 확인에 걸리면 이 목록에 «검증 실패»로 남습니다.";

    // 공개 승인: 고른 여러 건(위 단추) 또는 카드 하나(카드의 «공개 승인» — 운영자 2026-11-28 «카드 밖에서도 반영 버튼 만들어»)
    const approveIds = async (ids: string[], ask: string, dates?: { start: string; end: string }) => {
        if (ids.length === 0) return;
        if (!confirm(`${ask}\n\n${AFTER_APPROVE}`)) return;
        setBusy(true);
        const now = new Date().toISOString();
        const changes: ReviewChange[] = [];
        const failed: string[] = [];
        try {
            const fresh = await freshContents(ids);
            for (const id of ids) {
                const c = fresh[id];
                if (!c) { failed.push(`${id}: 이미 처리됨`); continue; }
                const next: ReviewContent = { ...c, publish_approved_at: now, publish_approved_by: actor || undefined };
                // 사람 판단에서 운영자가 넣은 날짜(원문을 보고 넣은 값)를 공개 단계가 읽는 자리에 쓴다
                if (dates) {
                    next.ai_suggestion = { ...(c.ai_suggestion || {}), date_start: dates.start, date_end: dates.end };
                    next.dates_set_by_admin = { at: now, by: actor || undefined, start: dates.start, end: dates.end };
                }
                try {
                    await writeContent(id, next);
                    changes.push({ id, status: "REVIEW", content: next });
                } catch (e) {
                    failed.push(`${c.title || id}: ${errMsg(e)}`);
                }
            }
        } catch (e) {
            failed.push(errMsg(e));
        }
        onChanged(changes);
        setSelected((s) => s.filter((x) => !ids.includes(x)));
        setBusy(false);
        if (failed.length) alert(`승인 ${changes.length}건, 실패 ${failed.length}건\n\n${failed.slice(0, 10).join("\n")}`);
    };
    const approveSelected = () => approveIds(picked, `선택한 ${picked.length}건을 공개 승인할까요?`);
    const approveOne = (post: ReviewPost, dates?: { start: string; end: string }) => approveIds(
        [post.id],
        `«${post.content?.title || "제목 없음"}»을(를) 공개 승인할까요?` + (dates ? `\n\n넣은 날짜: ${dates.start} ~ ${dates.end}` : ""),
        dates,
    );
    // 사람 판단 카드에서 날짜가 없는 글에 운영자가 넣는 날짜(카드별)
    const [typed, setTyped] = useState<Record<string, { start: string; end: string }>>({});
    const setTypedDate = (id: string, key: "start" | "end", v: string) =>
        setTyped((t) => ({ ...t, [id]: { start: t[id]?.start || "", end: t[id]?.end || "", [key]: v } }));
    const typedFor = (id: string) => typed[id] || { start: "", end: "" };

    const reject = async (post: ReviewPost) => {
        if (!confirm(`«${post.content?.title || "제목 없음"}»을(를) 반영하지 않을까요?\n\n휴지통(거절됨)으로 갑니다. 휴지통에서 되돌리면 이 목록으로 돌아옵니다.`)) return;
        setBusy(true);
        try {
            const fresh = await freshContents([post.id]);
            const c = fresh[post.id];
            if (!c) throw new Error("이미 처리됨");
            // 승인 표시는 지운다: 휴지통에서 되돌렸을 때 다시 승인하지 않은 채 공개되지 않게
            const next = { ...c };
            delete next.publish_approved_at;
            delete next.publish_failed_at;
            const { data, error } = await supabase
                .from("raw_posts")
                .update({ status: "REJECTED", content: next })
                .eq("id", post.id)
                .eq("status", "REVIEW")
                .select("id");
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("바뀐 줄 없음(관리자 권한 또는 상태 변경 확인)");
            setSelected((s) => s.filter((x) => x !== post.id));
            onChanged([{ id: post.id, status: "REJECTED", content: next }]);
        } catch (e) {
            alert(`처리하지 못했습니다: ${errMsg(e)}`);
        }
        setBusy(false);
    };

    const moveToCandidate = async (post: ReviewPost) => {
        const ask = bucket === "consent"
            ? "작가·단체 계정 글입니다. 게시 동의를 받았나요?\n\n«확인»을 누르면 «공개 후보»로 옮깁니다(아직 공개하지 않습니다)."
            : "«공개 후보»로 옮길까요? (아직 공개하지 않습니다)";
        if (!confirm(ask)) return;
        setBusy(true);
        try {
            const fresh = await freshContents([post.id]);
            const c = fresh[post.id];
            if (!c) throw new Error("이미 처리됨");
            const next = {
                ...c,
                review_bucket: "candidate",
                review_bucket_at: new Date().toISOString(),
                review_reason: `admin_moved_from_${bucket}`,
                review_moved_by: actor || undefined,
            };
            await writeContent(post.id, next);
            onChanged([{ id: post.id, status: "REVIEW", content: next }]);
        } catch (e) {
            alert(`옮기지 못했습니다: ${errMsg(e)}`);
        }
        setBusy(false);
    };

    const toggle = (id: string) =>
        setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    return (
        <Box mb={compact ? 8 : 40}>
            {!compact && <Group justify="space-between" mb="xs" wrap="wrap">
                <Title order={2} size="h3">{BUCKET_LABEL[bucket]} <span className="pica-num text-accent">{posts.length}</span></Title>
                {bucket === "candidate" && selectable.length > 0 && (
                    <Group gap="xs">
                        <Checkbox
                            label="모두 고르기"
                            checked={picked.length > 0 && picked.length === selectable.length}
                            indeterminate={picked.length > 0 && picked.length < selectable.length}
                            onChange={() => setSelected(picked.length === selectable.length ? [] : selectable)}
                        />
                        <Button
                            color="teal"
                            radius="xl"
                            leftSection={<CheckCircle size={16} />}
                            disabled={picked.length === 0}
                            loading={busy}
                            onClick={approveSelected}
                        >
                            선택한 {picked.length}건 공개 승인
                        </Button>
                    </Group>
                )}
            </Group>}
            {!compact && <Text size="sm" c="dimmed" mb="lg">{BUCKET_NOTE[bucket]}</Text>}

            {loading ? (
                <p className="pica-empty">불러오는 중…</p>
            ) : posts.length === 0 ? (
                <p className="pica-empty">이 무더기에 남은 후보가 없습니다.</p>
            ) : (
                <Stack gap="md">
                    {posts.slice(0, shown).map((post) => {
                        const c = post.content || {};
                        const body = String(c.description || c.text || c.caption || "").trim();
                        const a = c.ai_suggestion || {};
                        const state = approvalState(c);
                        const thumb = post.image_urls?.[0] || a.poster_url || "";
                        const account = a.account ? `@${a.account}` : "";
                        const datesOk = ISO.test(a.date_start || "") && ISO.test(a.date_end || "");
                        const noteCount = notesOf(c).length;
                        return (
                            <Paper key={post.id} p="md" radius="lg" withBorder shadow="sm"
                                style={onOpen ? { cursor: "pointer" } : undefined}
                                onClick={onOpen ? (e) => { if (opensDetail(e)) onOpen(post); } : undefined}>
                                <Group align="flex-start" wrap="nowrap">
                                    {bucket === "candidate" && (
                                        <Checkbox
                                            mt={4}
                                            aria-label="공개 승인할 후보로 고르기"
                                            checked={selected.includes(post.id)}
                                            disabled={state === "waiting"}
                                            onChange={() => toggle(post.id)}
                                        />
                                    )}
                                    <Box
                                        w={96}
                                        h={120}
                                        bg="gray.1"
                                        style={{ position: "relative", borderRadius: "var(--mantine-radius-md)", overflow: "hidden", flexShrink: 0 }}
                                    >
                                        <ImageWithFallback src={thumb} alt="" fill className="object-cover" sizes="96px" referrerPolicy="no-referrer" fallbackText="포스터 없음" />
                                    </Box>
                                    <Stack flex={1} gap={6} style={{ minWidth: 0 }}>
                                        <Group gap="xs" wrap="wrap">
                                            <Badge color="pink" variant="light" radius="md">{post.source}</Badge>
                                            {account && <Text size="sm" fw={700} style={{ wordBreak: "break-all" }}><IgHandle handle={account} /></Text>}
                                            {a.author && a.author !== a.account && <Text size="sm" c="dimmed">{a.author}</Text>}
                                            {a.role && <Badge variant="default" size="sm">{a.role}</Badge>}
                                            {c.review_reason === "standing_consent" && (
                                                <Badge color="teal" variant="light" size="sm" style={{ textTransform: "none" }}>{c.review_note || "상시 동의"}</Badge>
                                            )}
                                        </Group>
                                        <Title order={4} size="h5" lineClamp={2}>
                                            {onOpen
                                                ? <button type="button" onClick={() => onOpen(post)} style={{ all: "unset", cursor: "pointer" }} aria-label={`${c.title || "제목 없음"} 자세히 보기`}>{c.title || "제목 없음"}</button>
                                                : (c.title || "제목 없음")}
                                        </Title>
                                        <Group gap="md" wrap="wrap">
                                            <Group gap={4}>
                                                <Calendar size={14} />
                                                <Text size="sm">{a.date_start || "시작일 없음"} ~ {a.date_end || "끝나는 날 없음"}</Text>
                                            </Group>
                                            <Group gap={4}>
                                                <MapPin size={14} />
                                                <Text size="sm">{[a.region, a.venue].filter(Boolean).join(" · ") || "장소 없음"}</Text>
                                            </Group>
                                        </Group>
                                        {c.review_reason && (
                                            <Text size="xs" c={String(c.review_reason).startsWith("publish_failed") ? "red" : "dimmed"}>
                                                분류 이유: {reasonText(c.review_reason)}
                                            </Text>
                                        )}
                                        {bucket === "candidate" && !datesOk && (
                                            <Group gap={4}>
                                                <AlertTriangle size={14} color="var(--mantine-color-orange-6)" />
                                                <Text size="xs" c="orange.7">시작일·끝나는 날이 모두 있어야 공개 검증을 통과합니다.</Text>
                                            </Group>
                                        )}
                                        {bucket === "human" && !datesOk && state !== "waiting" && (
                                            <Group gap="xs" wrap="wrap" align="center">
                                                <Text size="xs" c="orange.7">원문에서 날짜를 확인해 넣으면 승인할 수 있습니다:</Text>
                                                <input type="date" className="pica-date" aria-label="시작일" value={typedFor(post.id).start}
                                                    onChange={(e) => setTypedDate(post.id, "start", e.target.value)} />
                                                <Text size="xs" c="dimmed">~</Text>
                                                <input type="date" className="pica-date" aria-label="끝나는 날" value={typedFor(post.id).end}
                                                    min={typedFor(post.id).start || undefined}
                                                    onChange={(e) => setTypedDate(post.id, "end", e.target.value)} />
                                            </Group>
                                        )}
                                        {state === "waiting" && (
                                            <Badge color="teal" variant="light" size="lg" radius="md" leftSection={<Clock size={12} />} style={{ alignSelf: "flex-start", textTransform: "none" }}>
                                                승인됨({fmtTime(c.publish_approved_at)}), 다음 정기 실행에서 검증 뒤 공개
                                            </Badge>
                                        )}
                                        {state === "failed" && (
                                            <Badge color="red" variant="light" size="lg" radius="md" leftSection={<AlertTriangle size={12} />} style={{ alignSelf: "flex-start", textTransform: "none" }}>
                                                승인됨, 검증 실패({fmtTime(c.publish_failed_at)}) — 다음 정기 실행에서 다시 확인
                                            </Badge>
                                        )}
                                        {body && <Text size="xs" c="dimmed" lineClamp={2} style={{ wordBreak: "break-word" }}>{withIgLinks(body)}</Text>}
                                        {noteCount > 0 && (
                                            <Group gap={4}>
                                                <MessageSquare size={13} color="var(--mantine-color-dimmed)" />
                                                <Text size="xs" c="dimmed">운영자 코멘트 {noteCount}개</Text>
                                            </Group>
                                        )}
                                        <Group pt="xs" gap="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-1)" }}>
                                            <Button
                                                component="a"
                                                href={post.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                variant="subtle"
                                                size="xs"
                                                color="indigo"
                                                rightSection={<ExternalLink size={12} />}
                                            >
                                                원문 열기
                                            </Button>
                                            {onOpen && <Button variant="subtle" size="xs" color="gray" onClick={() => onOpen(post)}>자세히 · 코멘트</Button>}
                                            <Box style={{ flex: 1 }} />
                                            <Button variant="default" size="xs" radius="xl" disabled={busy} onClick={() => reject(post)} leftSection={<XCircle size={14} />}>
                                                반영 안 함
                                            </Button>
                                            {bucket === "candidate" && state !== "waiting" && (
                                                <Button color="teal" size="xs" radius="xl" disabled={busy} onClick={() => approveOne(post)} leftSection={<CheckCircle size={14} />}>
                                                    공개 승인
                                                </Button>
                                            )}
                                            {bucket === "human" && state !== "waiting" && (() => {
                                                const t = typedFor(post.id);
                                                const typedOk = ISO.test(t.start) && ISO.test(t.end) && t.start <= t.end;
                                                return (
                                                    <Button color="teal" size="xs" radius="xl" disabled={busy || (!datesOk && !typedOk)}
                                                        title={!datesOk && !typedOk ? "시작일·끝나는 날을 넣어야 승인할 수 있습니다" : undefined}
                                                        onClick={() => approveOne(post, datesOk ? undefined : t)} leftSection={<CheckCircle size={14} />}>
                                                        공개 승인
                                                    </Button>
                                                );
                                            })()}
                                            {bucket === "consent" && (
                                                <Button color="teal" variant="light" size="xs" radius="xl" disabled={busy} onClick={() => moveToCandidate(post)} rightSection={<ArrowRight size={14} />}>
                                                    공개 후보로 옮기기
                                                </Button>
                                            )}
                                        </Group>
                                    </Stack>
                                </Group>
                            </Paper>
                        );
                    })}
                    {posts.length > shown && (
                        <Button variant="default" radius="xl" onClick={() => setShown(n => n + PAGE)}>
                            더 보기 ({shown}/{posts.length})
                        </Button>
                    )}
                </Stack>
            )}
        </Box>
    );
}
