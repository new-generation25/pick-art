"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Container, Title, Text, SimpleGrid, Paper, Group, Stack, Badge, Button, Progress, Anchor, Loader, Box, Tooltip,
} from "@mantine/core";
import { RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import {
    ALERT_RULES, SOURCE_KINDS, computeSupply, daysBetween, lastNewByKind, newByDay,
    type Alert, type DayKinds, type OpsEvent, type SourceKind,
} from "@/lib/opsStats";

// 운영 대시보드: 지금 DB(행사·수집분·장소·회원)와 수집기가 올린 인스타 리포트 숫자(ops_snapshots)를 한 화면에.
// 숫자는 모두 이 화면을 연 관리자의 권한(RLS)으로 바로 읽는다. 쓰는 것은 없다.

const MEMBER_GOAL = 10000; // 유료 전환 기준: 가입 회원 1만 명 (docs/PLAN_community_2026-11.md 11절, profiles 행 수)
const INSTA_ARTIFACT = "https://claude.ai/artifact/EnT4xJRMQW8159WjmqEZrX";
const KIND_COLOR: Record<SourceKind, string> = {
    KOPIS: "var(--mantine-color-blue-6)",
    "기관 공식": "var(--mantine-color-teal-6)",
    인스타그램: "var(--mantine-color-grape-6)",
    큐레이션: "var(--mantine-color-orange-6)",
};

type MetricRow = {
    kind: string; id: string; group?: string; name?: string; value?: number | null; unit?: string;
    target?: string; status?: string; what?: string; date?: string;
    posts?: number; posts_small?: number; posts_public?: number; followers?: number | null;
};
type Snapshot = { name: string; data: { rows: MetricRow[]; meta?: { label: string; value: string }[] }; updated_at: string };

type Ops = {
    loadedAt: Date;
    today: string;
    events: OpsEvent[];
    inbox: number;
    review: number;
    venuesPending: number;
    reportsNew: number;
    members: number;
    lastRawAt: string | null;
    snapshots: Record<string, Snapshot>;
    errors: string[];
};

function todayKST(): string {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function fetchAllEvents(): Promise<OpsEvent[]> {
    const out: OpsEvent[] = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from("events")
            .select("event_date_start,event_date_end,region,category,poster_image_url,source,created_at")
            .eq("status", "PUBLISHED")
            .range(from, from + 999);
        if (error) throw new Error(`행사: ${error.message}`);
        out.push(...((data || []) as OpsEvent[]));
        if (!data || data.length < 1000) return out;
    }
}

async function countOf(table: string, col?: string, val?: string): Promise<number> {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (col && val) q = q.eq(col, val);
    const { count, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return count || 0;
}

async function loadOps(): Promise<Ops> {
    const errors: string[] = [];
    const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
        try { return await p; } catch (e) { errors.push((e as Error).message); return fallback; }
    };
    const [events, inbox, review, venuesPending, members, lastRaw, snaps, reportsNew] = await Promise.all([
        safe(fetchAllEvents(), [] as OpsEvent[]),
        safe(countOf("raw_posts", "status", "COLLECTED"), 0),
        safe(countOf("raw_posts", "status", "REVIEW"), 0),
        safe(countOf("venues", "geo_status", "pending"), 0),
        safe(countOf("profiles"), 0),
        safe((async () => {
            const { data, error } = await supabase.from("raw_posts").select("collected_at")
                .order("collected_at", { ascending: false }).limit(1);
            if (error) throw new Error(`수집분: ${error.message}`);
            return (data?.[0]?.collected_at as string) || null;
        })(), null as string | null),
        safe((async () => {
            const { data, error } = await supabase.from("ops_snapshots").select("name,data,updated_at");
            if (error) throw new Error(`인스타 스냅숏: ${error.message}`);
            return (data || []) as Snapshot[];
        })(), [] as Snapshot[]),
        safe(countOf("reports", "status", "new"), 0),
    ]);
    return {
        loadedAt: new Date(), today: todayKST(), events, inbox, review, venuesPending, members, reportsNew,
        lastRawAt: lastRaw, snapshots: Object.fromEntries(snaps.map(s => [s.name, s])), errors,
    };
}

function hoursSince(iso: string): number {
    return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function fmtTime(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildAlerts(ops: Ops, supply: ReturnType<typeof computeSupply>, lastNew: Record<SourceKind, string | null>,
    metrics: MetricRow[]): Alert[] {
    const a: Alert[] = [];
    const kq = lastNew.KOPIS ? daysBetween(lastNew.KOPIS, ops.today) : null;
    if (kq === null || kq > ALERT_RULES.kopisQuietDays) {
        a.push({ level: "bad", text: kq === null ? "KOPIS에서 들어온 행사가 없습니다" : `KOPIS 새 공연이 ${kq}일째 0건입니다 (마지막 ${lastNew.KOPIS})` });
    }
    const oq = lastNew["기관 공식"] ? daysBetween(lastNew["기관 공식"]!, ops.today) : null;
    if (oq === null || oq > ALERT_RULES.officialQuietDays) {
        a.push({ level: "bad", text: `기관 공식 게시판 새 행사가 ${oq ?? "?"}일째 0건입니다` });
    }
    if (ops.lastRawAt && hoursSince(ops.lastRawAt) > ALERT_RULES.rawQuietHours) {
        a.push({ level: "warn", text: `마지막 새 수집분이 ${Math.round(hoursSince(ops.lastRawAt))}시간 전입니다 (정기 실행 08:20·15:00)` });
    }
    if (supply.emptyRegions.length) {
        a.push({ level: "warn", text: `활성 행사가 없는 시군: ${supply.emptyRegions.join(", ")}` });
    }
    const snap = ops.snapshots["insta_metrics"];
    if (!snap) {
        a.push({ level: "warn", text: "인스타 운영 숫자가 아직 올라오지 않았습니다 (수집기 publish_ops_snapshots.py)" });
    } else if (hoursSince(snap.updated_at) > ALERT_RULES.snapshotStaleHours) {
        a.push({ level: "warn", text: `인스타 운영 숫자가 ${Math.round(hoursSince(snap.updated_at))}시간 전 것입니다` });
    }
    for (const m of metrics.filter(m => m.status === "warn")) {
        a.push({ level: "warn", text: `인스타 ${m.name}: ${m.value}${m.unit || ""} (${m.target})` });
    }
    if (ops.inbox) a.push({ level: "info", text: `인박스 승인 대기 ${ops.inbox}건`, href: "/admin/inbox" });
    if (ops.review) a.push({ level: "info", text: `인스타 수집분 검토 대기 ${ops.review}건 (앱 화면 없음, 승인 대기함 통합은 다음 단계)` });
    if (ops.reportsNew) a.push({ level: "info", text: `신고·제보 ${ops.reportsNew}건 확인 대기`, href: "/admin/reports" });
    if (ops.venuesPending) a.push({ level: "info", text: `장소 좌표 확인 대기 ${ops.venuesPending}곳`, href: "/admin/venues" });
    for (const e of ops.errors) a.push({ level: "bad", text: `읽기 실패 — ${e}` });
    return a;
}

const LEVEL_COLOR = { bad: "red", warn: "yellow", info: "gray" } as const;
const LEVEL_LABEL = { bad: "이상", warn: "주의", info: "대기" } as const;

function Tile({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
    const body = (
        <Paper withBorder p="md" radius="md" h="100%">
            <Text size="sm" c="dimmed" fw={600}>{label}</Text>
            <Text fz={30} fw={800} lh={1.2} mt={4} style={{ fontVariantNumeric: "tabular-nums" }}>{value}</Text>
            {sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}
        </Paper>
    );
    return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{body}</Link> : body;
}

/** 가로 막대 목록(시군·분야). 최댓값 기준 길이 */
function BarList({ rows, highlightZero }: { rows: { label: string; n: number }[]; highlightZero?: boolean }) {
    const max = Math.max(1, ...rows.map(r => r.n));
    return (
        <Stack gap={4}>
            {rows.map(r => (
                <Group key={r.label} gap={8} wrap="nowrap">
                    <Text size="sm" w={64} style={{ flexShrink: 0 }} c={highlightZero && !r.n ? "red" : undefined}>{r.label}</Text>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                        <Box h={10} style={{ width: `${(r.n / max) * 100}%`, minWidth: r.n ? 2 : 0, background: "var(--mantine-color-blue-5)", borderRadius: 2 }} />
                    </Box>
                    <Text size="sm" w={40} ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.n}</Text>
                </Group>
            ))}
        </Stack>
    );
}

/** 날짜별 쌓은 막대. 막대에 마우스를 올리면 그날 숫자 */
function StackedDays<K extends string>({ days, keys, colors, label, width = 560 }: {
    days: ({ day: string } & Record<K, number>)[]; keys: K[]; colors: Record<K, string>; label: string; width?: number;
}) {
    // 폭이 넓은 칸(전체 폭)에서는 width 를 키워 높이가 같은 비율로 커지지 않게 한다
    const W = width, H = 160, padL = 28, padB = 22, padT = 8;
    const totals = days.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0));
    const max = Math.max(1, ...totals);
    const step = (W - padL) / days.length;
    const bw = Math.max(4, step * 0.66);
    const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
    return (
        <Box>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
                {[0, Math.round(max / 2), max].map(v => (
                    <g key={v}>
                        <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="var(--mantine-color-gray-3)" strokeWidth={1} />
                        <text x={padL - 4} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--mantine-color-dimmed)">{v}</text>
                    </g>
                ))}
                {days.map((d, i) => {
                    let acc = 0;
                    const x = padL + i * step + (step - bw) / 2;
                    return (
                        <g key={d.day}>
                            <title>{`${d.day} · 합계 ${totals[i]}\n` + keys.map(k => `${k} ${d[k] || 0}`).join(" · ")}</title>
                            <rect x={padL + i * step} y={padT} width={step} height={H - padT - padB} fill="transparent" />
                            {keys.map(k => {
                                const v = d[k] || 0;
                                if (!v) return null;
                                const top = y(acc + v), h = y(acc) - y(acc + v);
                                acc += v;
                                return <rect key={k} x={x} y={top} width={bw} height={h} fill={colors[k]} />;
                            })}
                            {(i % Math.ceil(days.length / 7) === 0 || i === days.length - 1) && (
                                <text x={x + bw / 2} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--mantine-color-dimmed)">{d.day.slice(5).replace("-", "/")}</text>
                            )}
                        </g>
                    );
                })}
            </svg>
            <Group gap="md" mt={4}>
                {keys.map(k => (
                    <Group key={k} gap={6}>
                        <Box w={10} h={10} style={{ background: colors[k], borderRadius: 2 }} />
                        <Text size="xs" c="dimmed">{k}</Text>
                    </Group>
                ))}
            </Group>
        </Box>
    );
}

const METRIC_STATUS = { ok: { color: "teal", label: "목표 충족" }, warn: { color: "yellow", label: "목표 미달" } } as const;

export default function AdminDashboard() {
    const [ops, setOps] = useState<Ops | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        setOps(await loadOps());
        setLoading(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const view = useMemo(() => {
        if (!ops) return null;
        const supply = computeSupply(ops.events, ops.today, GN_REGIONS);
        const days = newByDay(ops.events, ops.today, 14);
        const lastNew = lastNewByKind(ops.events);
        const metricRows = ops.snapshots["insta_metrics"]?.data.rows || [];
        const summary = metricRows.filter(r => r.kind === "summary");
        const instaDays = metricRows.filter(r => r.kind === "day").slice(0, 14).reverse()
            .map(r => ({ day: r.date || "", 소규모: r.posts_small || 0, 공공: r.posts_public || 0, 기타: Math.max(0, (r.posts || 0) - (r.posts_small || 0) - (r.posts_public || 0)) }));
        const groups = [...new Set(summary.map(r => r.group || ""))].filter(g => g !== "공급");
        const alerts = buildAlerts(ops, supply, lastNew, summary);
        return { supply, days, lastNew, summary, instaDays, groups, alerts };
    }, [ops]);

    if (!ops || !view) {
        return <Container size="xl" py={60}><Group><Loader size="sm" /><Text c="dimmed">운영 숫자를 읽는 중…</Text></Group></Container>;
    }
    const { supply, days, lastNew, summary, instaDays, groups, alerts } = view;
    const snap = ops.snapshots["insta_metrics"];
    const added7 = days.slice(-7).reduce((s, d) => s + SOURCE_KINDS.reduce((t, k) => t + d[k], 0), 0);

    return (
        <Container size="xl" pt={32} pb={80}>
            <Stack gap="xl">
                <Group justify="space-between" align="flex-end">
                    <div>
                        <Title order={1} fw={900}>운영 현황</Title>
                        <Text c="dimmed" size="sm">
                            {ops.today} · {fmtTime(ops.loadedAt.toISOString())}에 읽음 · 행사·수집분·장소·회원은 DB에서 바로, 인스타 숫자는 수집기가 올린 것
                        </Text>
                    </div>
                    <Button variant="default" leftSection={<RefreshCw size={16} />} onClick={refresh} loading={loading}>다시 읽기</Button>
                </Group>

                <Paper withBorder radius="md" p="md" id="alerts">
                    <Text fw={700} mb="xs">살펴볼 것</Text>
                    {alerts.length === 0 ? <Text c="teal">지금 이상 없음</Text> : (
                        <Stack gap={6}>
                            {alerts.map((a, i) => (
                                <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                                    <Badge color={LEVEL_COLOR[a.level]} variant={a.level === "info" ? "light" : "filled"} w={48} style={{ flexShrink: 0 }}>{LEVEL_LABEL[a.level]}</Badge>
                                    {a.href ? <Anchor component={Link} href={a.href} size="sm">{a.text}</Anchor> : <Text size="sm">{a.text}</Text>}
                                </Group>
                            ))}
                        </Stack>
                    )}
                </Paper>

                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" id="tiles">
                    <Tile label="활성 행사" value={supply.active.toLocaleString()} sub={`끝나지 않은 공개 행사 · 전체 공개 ${ops.events.length.toLocaleString()}건`} />
                    <Tile label="7일 안에 볼 수 있는" value={supply.within7.toLocaleString()} sub={`30일 ${supply.within30} · 60일 ${supply.within60}`} />
                    <Tile label="최근 7일 새 행사" value={added7.toLocaleString()} sub="DB에 새로 공개된 건수" />
                    <Tile label="가입 회원" value={ops.members.toLocaleString()} sub={
                        <Stack gap={4}><span>유료 전환 기준 {MEMBER_GOAL.toLocaleString()}명</span>
                            <Progress value={Math.min(100, (ops.members / MEMBER_GOAL) * 100)} size="sm" /></Stack>} />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <Paper withBorder radius="md" p="md" id="new-by-day">
                        <Text fw={700}>들어온 행사 (최근 14일, 출처 종류별)</Text>
                        <Text size="xs" c="dimmed" mb="sm">자동 공개·큐레이션·인스타 동의분이 DB에 새로 공개된 날 기준</Text>
                        <StackedDays days={days as (DayKinds & { day: string })[]} keys={SOURCE_KINDS} colors={KIND_COLOR} label="최근 14일 출처 종류별 새 행사 수" />
                        <SimpleGrid cols={2} spacing={4} mt="sm">
                            {SOURCE_KINDS.map(k => {
                                const d = lastNew[k];
                                const gap = d ? daysBetween(d, ops.today) : null;
                                return (
                                    <Text key={k} size="xs" c={gap === null || gap > 2 ? "red" : "dimmed"}>
                                        {k} 마지막 새 행사 {d ? `${d.slice(5).replace("-", "/")} (${gap === 0 ? "오늘" : `${gap}일 전`})` : "없음"}
                                    </Text>
                                );
                            })}
                        </SimpleGrid>
                    </Paper>

                    <Paper withBorder radius="md" p="md" id="queues">
                        <Text fw={700} mb="sm">사람 판단 대기</Text>
                        <SimpleGrid cols={2} spacing="sm">
                            <Tile label="인박스 승인" value={ops.inbox} sub="수집분 COLLECTED → 인박스" href="/admin/inbox" />
                            <Tile label="인스타 수집분 검토" value={ops.review} sub="REVIEW · 앱 화면 없음" />
                            <Tile label="장소 좌표 확인" value={ops.venuesPending} sub="venues pending → 장소 확인" href="/admin/venues" />
                            <Tile label="신고·제보" value={ops.reportsNew} sub="회원이 보낸 것 → 확인·반영" href="/admin/reports" />
                            <Tile label="인스타 허락 답 대기" value={summary.find(r => r.id === "pending")?.value ?? "—"}
                                sub={summary.find(r => r.id === "pending_over7") ? `7일 넘은 것 ${summary.find(r => r.id === "pending_over7")?.value}건` : "인스타 숫자 없음"} />
                        </SimpleGrid>
                        <Text size="xs" c="dimmed" mt="sm">
                            마지막 새 수집분 {ops.lastRawAt ? fmtTime(ops.lastRawAt) : "없음"} · 포스터 없는 활성 행사 {supply.noPoster}건
                        </Text>
                    </Paper>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <Paper withBorder radius="md" p="md" id="by-region">
                        <Group justify="space-between" mb="sm">
                            <Text fw={700}>시군별 활성 행사</Text>
                            {supply.emptyRegions.length > 0 && <Badge color="red" variant="light">0건 {supply.emptyRegions.length}곳</Badge>}
                        </Group>
                        <BarList rows={supply.byRegion} highlightZero />
                    </Paper>
                    <Paper withBorder radius="md" p="md" id="by-category">
                        <Text fw={700} mb="sm">분야별 활성 행사</Text>
                        <BarList rows={supply.byCategory} />
                        {summary.length > 0 && (
                            <Group gap="lg" mt="lg">
                                {["small_active", "small_supply_pct"].map(id => {
                                    const m = summary.find(r => r.id === id);
                                    return m ? (
                                        <Tooltip key={id} label={m.what} multiline w={240} withArrow>
                                            <div><Text size="xs" c="dimmed">{m.name}</Text><Text fw={700}>{m.value}{m.unit}</Text></div>
                                        </Tooltip>
                                    ) : null;
                                })}
                            </Group>
                        )}
                    </Paper>
                </SimpleGrid>

                <Paper withBorder radius="md" p="md" id="insta">
                    <Group justify="space-between" mb="sm" align="flex-start">
                        <div>
                            <Text fw={700}>인스타 운영 (@picka.news)</Text>
                            <Text size="xs" c="dimmed">
                                {snap ? `${fmtTime(snap.updated_at)}에 수집기가 올린 숫자 · 원본 docs/insta (이 PC)` : "아직 올라온 숫자가 없습니다"}
                            </Text>
                        </div>
                        <Anchor href={INSTA_ARTIFACT} target="_blank" size="sm">
                            <Group gap={4}>리포트 대시보드 <ExternalLink size={14} /></Group>
                        </Anchor>
                    </Group>
                    {instaDays.length > 0 && (
                        <Box mb="md">
                            <Text size="sm" fw={600} mb={4}>하루 게시 수 (소규모·공공)</Text>
                            <StackedDays days={instaDays} keys={["소규모", "공공", "기타"]}
                                colors={{ 소규모: "var(--mantine-color-grape-6)", 공공: "var(--mantine-color-blue-4)", 기타: "var(--mantine-color-gray-4)" }}
                                label="최근 날짜별 인스타 게시 수" width={1200} />
                        </Box>
                    )}
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                        {groups.map(g => (
                            <Stack key={g} gap={6}>
                                <Text size="sm" fw={700} c="dimmed">{g}</Text>
                                {summary.filter(r => r.group === g).map(m => (
                                    <Tooltip key={m.id} label={`${m.what || ""}${m.target ? ` · ${m.target}` : ""}`} multiline w={260} withArrow>
                                        <Group justify="space-between" gap={6} wrap="nowrap">
                                            <Text size="sm" style={{ minWidth: 0 }}>{m.name}</Text>
                                            <Group gap={6} wrap="nowrap">
                                                {(m.status === "ok" || m.status === "warn") && (
                                                    <Badge size="xs" color={METRIC_STATUS[m.status].color} variant="light">{METRIC_STATUS[m.status].label}</Badge>
                                                )}
                                                <Text size="sm" fw={700} style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                                    {m.value ?? "—"}{m.unit ? ` ${m.unit}` : ""}
                                                </Text>
                                            </Group>
                                        </Group>
                                    </Tooltip>
                                ))}
                            </Stack>
                        ))}
                    </SimpleGrid>
                </Paper>
            </Stack>
        </Container>
    );
}
