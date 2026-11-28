"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Container, Title, Text, SimpleGrid, Paper, Group, Stack, Badge, Button, Progress, Anchor, Loader, Box, Tooltip, Table,
} from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { SiteVisitsPanel, type SiteVisits } from "@/components/admin/SiteVisitsPanel";
import { PushMemberStats, RoutineSteps } from "@/components/admin/OpsExtras";
import { PeriodPicker, TrendChart } from "@/components/admin/TrendCharts";
import { supabase } from "@/lib/supabase";
import { BUSAN_DISTRICTS, GN_REGIONS } from "@/lib/regions";
import {
    ALERT_RULES, SOURCE_KINDS, activeByDay, checkMissedRun, computeSupply, cumulativeByDay, daysBetween, foundSeries, isActive, lastNewByKind, latestRunRows, newByDay,
    runStatusTone, splitCollectorAlerts,
    type Alert, type CollectorAlert, type CollectorRun, type DayKinds, type OpsEvent, type SourceKind,
} from "@/lib/opsStats";
import { ackAlert, collectorAlertKey, fetchAlertAcks, missedRunKey, unackAlert } from "@/lib/alertAcks";
import { useAdmin } from "@/components/admin/AdminShell";

// 운영 대시보드: 지금 DB(행사·수집분·장소·회원)와 수집기가 올린 인스타 리포트 숫자(ops_snapshots)를 한 화면에.
// 숫자는 모두 이 화면을 연 관리자의 권한(RLS)으로 바로 읽는다. 쓰는 것은 수집기 경고 «확인»(ops_alert_acks) 하나뿐이다
// (운영자 2026-11-28 «확인 하면 없어지는 걸로»: 확인한 경고는 메뉴 숫자와 «살펴볼 것»에서 빠지고, 다시 켜지면 다시 보인다).

const MEMBER_GOAL = 10000; // 유료 전환 기준: 가입 회원 1만 명 (docs/PLAN_community_2026-11.md 11절, profiles 행 수)
const SECTIONS = [["alerts", "살펴볼 것"], ["trends", "추이"], ["collect", "수집"], ["spread", "분포"], ["site-visits", "방문"], ["people", "알림·회원"], ["insta", "인스타그램"]] as const;
const KIND_COLOR: Record<SourceKind, string> = {
    KOPIS: "#2e6b4e",
    "기관 공식": "#73a88d",
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
    partnersNew: number;
    members: number;
    lastRawAt: string | null;
    memberStamps: string[];                 // 회원 가입 시각(추이용)
    districts: Record<string, string>;      // 장소 id → 부산 구·군
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
            .select("event_date_start,event_date_end,region,category,poster_image_url,source,created_at,venue_id")
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
    const [events, inbox, review, venuesPending, members, lastRaw, snaps, reportsNew, partnersNew, memberStamps, districts] = await Promise.all([
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
        safe((async () => {  // 협약 신청 검토 대기 + 철회 요청(처리 전)
            const { count, error } = await supabase.from("partner_agreements").select("id", { count: "exact", head: true })
                .or("status.eq.new,and(withdraw_requested_at.not.is.null,status.neq.withdrawn)");
            if (error) throw new Error(`협약 신청: ${error.message}`);
            return count || 0;
        })(), 0),
        safe((async () => {
            const { data, error } = await supabase.from("profiles").select("created_at").order("created_at").limit(5000);
            if (error) throw new Error(`회원 추이: ${error.message}`);
            return (data || []).map(r => r.created_at as string).filter(Boolean);
        })(), [] as string[]),
        safe((async () => {
            const { data, error } = await supabase.from("public_venues").select("id,district").not("district", "is", null).limit(3000);
            if (error) throw new Error(`장소 구·군: ${error.message}`);
            return Object.fromEntries((data || []).map(v => [v.id as string, v.district as string]));
        })(), {} as Record<string, string>),
    ]);
    return {
        loadedAt: new Date(), today: todayKST(), events, inbox, review, venuesPending, members, reportsNew, partnersNew,
        memberStamps, districts,
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
    for (const e of ops.errors) a.push({ level: "bad", text: `읽기 실패 — ${e}` });
    return a;
}

const LEVEL_COLOR = { bad: "red", warn: "yellow", info: "gray" } as const;
const LEVEL_LABEL = { bad: "이상", warn: "주의", info: "대기" } as const;

/** 수집기가 올린 묶음의 rows. 모양이 다르면 빈 목록(contracts/ops-snapshots.md) */
function snapshotRows<T>(snap: Snapshot | undefined): T[] {
    const rows = snap?.data?.rows;
    return Array.isArray(rows) ? (rows as unknown as T[]) : [];
}

/** 수집기 경고(켜진 것) + 실행 누락 → 「살펴볼 것」 맨 위 줄. text 는 데이터라 글자로만 그린다 */
function collectorAlertLines(missed: ReturnType<typeof checkMissedRun>, open: CollectorAlert[]): Alert[] {
    const a: Alert[] = [];
    if (missed.state === "missed") {
        a.push({ level: "bad", text: `수집기 실행 누락: 마지막 실행 ${fmtTime(missed.lastRunAt)} (${Math.round(missed.hours)}시간 전, 기준 ${ALERT_RULES.collectorRunMissHours}시간 · 정기 실행 08:20·15:00)`, ackKey: missedRunKey(missed) });
    }
    for (const c of open) a.push({ level: c.level === "bad" ? "bad" : "warn", text: c.since ? `${c.text} (${fmtTime(c.since)} 회차부터)` : c.text, ackKey: collectorAlertKey(c) });
    return a;
}

const RUN_TONE_BADGE = {
    ok: { color: "teal", variant: "light" },
    bad: { color: "red", variant: "filled" },
    other: { color: "yellow", variant: "light" },
} as const;

function fmtNum(v: number | null | undefined): string {
    return typeof v === "number" ? v.toLocaleString() : "—";
}

/** 출처 하나의 최근 found 를 작은 막대로. 오래된 것이 왼쪽. 0 은 빨간 바닥선만 */
function FoundStrip({ points, source }: { points: { run_at: string; found: number }[]; source: string }) {
    const H = 20;
    const max = Math.max(1, ...points.map(p => p.found));
    return (
        <Group gap={2} wrap="nowrap" align="flex-end" h={H} role="img" aria-label={`${source} 최근 ${points.length}회 발견 수`}>
            {points.map(p => (
                <Box key={p.run_at} title={`${fmtTime(p.run_at)} · 발견 ${p.found}`} w={6}
                    h={p.found ? Math.max(2, Math.round((p.found / max) * H)) : 1}
                    style={{ background: p.found ? "#4f8f6f" : "#d7675a", borderRadius: 1, flexShrink: 0 }} />
            ))}
        </Group>
    );
}

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
                        <Box h={10} style={{ width: `${(r.n / max) * 100}%`, minWidth: r.n ? 2 : 0, background: "#4f8f6f", borderRadius: 2 }} />
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

export default function AdminDashboard() {
    const [ops, setOps] = useState<Ops | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);   // 추이 기간(일)
    const [acks, setAcks] = useState<Set<string>>(new Set());   // «확인»한 경고 열쇠
    const [ackErr, setAckErr] = useState("");
    const { reload: reloadCounts } = useAdmin();

    const refresh = useCallback(async () => {
        setLoading(true);
        const [o, a] = await Promise.all([loadOps(), fetchAlertAcks()]);
        setOps(o); setAcks(a);
        setLoading(false);
    }, []);

    // 경고 «확인»/«되돌리기»: 메뉴의 «경고 n» 숫자도 함께 다시 센다
    const toggleAck = async (a: Alert, on: boolean) => {
        if (!a.ackKey) return;
        setAckErr("");
        const err = on ? await ackAlert(a.ackKey, a.text) : await unackAlert(a.ackKey);
        if (err) { setAckErr(`저장하지 못했습니다: ${err}`); return; }
        setAcks(s => { const n = new Set(s); if (on) n.add(a.ackKey!); else n.delete(a.ackKey!); return n; });
        reloadCounts();
    };

    useEffect(() => { refresh(); }, [refresh]);

    const view = useMemo(() => {
        if (!ops) return null;
        const supply = computeSupply(ops.events, ops.today, GN_REGIONS);
        const days = newByDay(ops.events, ops.today, period);
        const trend = {
            active: activeByDay(ops.events, ops.today, period),
            added: days.map(d => ({ day: d.day, v: SOURCE_KINDS.reduce((t, k) => t + d[k], 0) })),
            members: cumulativeByDay(ops.memberStamps, ops.today, period),
            visits: ((ops.snapshots["site_visits"]?.data as unknown as SiteVisits | undefined)?.daily || []).slice(-period),
        };
        // 부산은 구·군으로 나눠 본다(행사의 장소가 가진 구·군. 장소가 없거나 구·군을 모르면 «구·군 모름»)
        const busan = new Map<string, number>();
        for (const e of ops.events) {
            if (e.region !== "부산" || !isActive(e, ops.today)) continue;
            const d = (e.venue_id && ops.districts[e.venue_id]) || "구·군 모름";
            busan.set(d, (busan.get(d) || 0) + 1);
        }
        const byBusan = [...BUSAN_DISTRICTS.map(d => ({ label: d.name, n: busan.get(d.name) || 0 })),
            ...[...busan].filter(([k]) => !BUSAN_DISTRICTS.some(d => d.name === k)).map(([label, n]) => ({ label, n }))].sort((a, b) => b.n - a.n);
        const instaStats = snapshotRows<{ date: string; followers?: number | null; views_7d?: number | null }>(ops.snapshots["insta_stats"]);
        const instaLast = [...instaStats].sort((a, b) => a.date.localeCompare(b.date)).pop();
        const lastNew = lastNewByKind(ops.events);
        const metricRows = ops.snapshots["insta_metrics"]?.data.rows || [];
        const summary = metricRows.filter(r => r.kind === "summary");
        const instaDays = metricRows.filter(r => r.kind === "day").slice(0, 14).reverse()
            .map(r => ({ day: r.date || "", 소규모: r.posts_small || 0, 공공: r.posts_public || 0, 기타: Math.max(0, (r.posts || 0) - (r.posts_small || 0) - (r.posts_public || 0)) }));
        const nowMs = ops.loadedAt.getTime();
        const runRows = snapshotRows<CollectorRun>(ops.snapshots["collector_runs"]);
        const latestRuns = latestRunRows(runRows);
        const series = new Map(foundSeries(runRows, 10).map(s => [s.source, s.points]));
        const missed = checkMissedRun(runRows, nowMs);
        const collector = splitCollectorAlerts(snapshotRows<CollectorAlert>(ops.snapshots["collector_alerts"]), nowMs, 7);
        const alerts = [...collectorAlertLines(missed, collector.open), ...buildAlerts(ops, supply, lastNew, summary)];
        return { supply, days, lastNew, summary, instaDays, alerts, latestRuns, series, missed, resolvedCollector: collector.resolved, trend, byBusan, instaLast };
    }, [ops, period]);

    if (!ops || !view) {
        return <Container fluid px={0} py={60}><Group><Loader size="sm" /><Text c="dimmed">운영 숫자를 읽는 중…</Text></Group></Container>;
    }
    const { supply, days, lastNew, summary, instaDays, alerts: allAlerts, latestRuns, series, missed, resolvedCollector, trend, byBusan, instaLast } = view;
    const alerts = allAlerts.filter(a => !a.ackKey || !acks.has(a.ackKey));
    const ackedAlerts = allAlerts.filter(a => a.ackKey && acks.has(a.ackKey));
    const gyeongnam = supply.byRegion.filter(r => r.label !== "부산");
    const busanTotal = supply.byRegion.find(r => r.label === "부산")?.n || 0;
    const snap = ops.snapshots["insta_metrics"];
    const added7 = days.slice(-7).reduce((s, d) => s + SOURCE_KINDS.reduce((t, k) => t + d[k], 0), 0);

    return (
        <Container fluid px={0} pt={32} pb={80}>
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

                <nav className="-mt-3 flex flex-wrap gap-1.5" aria-label="이 화면의 묶음">
                    {SECTIONS.map(([id, label]) => (
                        <a key={id} href={`#${id}`} className="flex h-8 items-center rounded-full bg-card px-3 text-[13px] font-semibold text-ink no-underline shadow-[0_1px_4px_rgba(30,26,21,.1)]">{label}</a>
                    ))}
                </nav>

                <Paper withBorder radius="md" p="md" id="alerts">
                    <Text fw={700} mb="xs">살펴볼 것</Text>
                    {alerts.length === 0 ? <p className="pica-info">지금 이상 없음</p> : (
                        <Stack gap={6}>
                            {alerts.map((a, i) => (
                                <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                                    <Badge color={LEVEL_COLOR[a.level]} variant={a.level === "info" ? "light" : "filled"} w={48} style={{ flexShrink: 0 }}>{LEVEL_LABEL[a.level]}</Badge>
                                    {a.href ? <Anchor component={Link} href={a.href} size="sm" style={{ minWidth: 0, overflowWrap: "anywhere", flex: 1 }}>{a.text}</Anchor> : <Text size="sm" style={{ minWidth: 0, overflowWrap: "anywhere", flex: 1 }}>{a.text}</Text>}
                                    {a.ackKey && <Button size="compact-xs" variant="default" radius="xl" style={{ flexShrink: 0 }} onClick={() => toggleAck(a, true)}
                                        title="확인한 경고는 메뉴의 «경고» 숫자와 이 목록에서 빠집니다. 같은 문제가 다시 켜지면 다시 보입니다.">확인</Button>}
                                </Group>
                            ))}
                        </Stack>
                    )}
                    {ackErr && <Text className="pica-err" mt={6}>{ackErr}</Text>}
                    {ackedAlerts.length > 0 && (
                        <Box component="details" mt="sm" id="collector-alerts-acked">
                            <Text component="summary" size="sm" c="dimmed" style={{ cursor: "pointer" }}>확인한 경고 {ackedAlerts.length}건 (아직 풀리지 않음)</Text>
                            <Stack gap={4} mt={6}>
                                {ackedAlerts.map((a, i) => (
                                    <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                                        <Badge color={LEVEL_COLOR[a.level]} variant="light" w={48} style={{ flexShrink: 0 }}>{LEVEL_LABEL[a.level]}</Badge>
                                        <Text size="sm" c="dimmed" style={{ minWidth: 0, overflowWrap: "anywhere", flex: 1 }}>{a.text}</Text>
                                        <Button size="compact-xs" variant="subtle" radius="xl" style={{ flexShrink: 0 }} onClick={() => toggleAck(a, false)}>되돌리기</Button>
                                    </Group>
                                ))}
                            </Stack>
                        </Box>
                    )}
                    {missed.state === "none" && <Text size="sm" c="dimmed" mt={6}>수집기 정기 실행: 실행 기록이 아직 없습니다</Text>}
                    {resolvedCollector.length > 0 && (
                        <Box component="details" mt="sm" id="collector-alerts-resolved">
                            <Text component="summary" size="sm" c="dimmed" style={{ cursor: "pointer" }}>
                                수집기 경고 — 최근 7일 안에 풀린 것 {resolvedCollector.length}건
                            </Text>
                            <Stack gap={4} mt={6}>
                                {resolvedCollector.map((c, i) => (
                                    <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                                        <Badge color={c.level === "bad" ? "red" : "yellow"} variant="light" w={48} style={{ flexShrink: 0 }}>{c.level === "bad" ? "이상" : "주의"}</Badge>
                                        <Text size="sm" c="dimmed" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{c.resolved_at ? `${fmtTime(c.resolved_at)} 풀림 · ` : ""}{c.text}</Text>
                                    </Group>
                                ))}
                            </Stack>
                        </Box>
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

                <Box id="trends">
                    <Group justify="space-between" align="center" mb="sm" wrap="wrap">
                        <div>
                            <Text fw={800} fz={18}>추이</Text>
                            <Text size="xs" c="dimmed">그래프 위에 마우스나 손가락을 올리면 그날 값이 보입니다</Text>
                        </div>
                        <PeriodPicker value={period} onChange={setPeriod} />
                    </Group>
                    <div className="grid gap-2.5 md:grid-cols-2">
                        <TrendChart title="활성 행사" unit="건" points={trend.active}
                            sub="그날 볼 수 있던 공개 행사 수. 지금 DB로 되짚은 값이라, 그사이 숨긴 행사는 빠져 있습니다" />
                        <TrendChart kind="bar" headline="sum" title="새로 공개된 행사" unit="건" points={trend.added} sub="DB에 새로 공개된 날 기준(출처 종류별은 아래 그래프)" />
                        <TrendChart kind="bar" headline="sum" title="사이트 방문자" unit="명" points={trend.visits.map(d => ({ day: d.date, v: d.visitors }))}
                            sub="Vercel Web Analytics 합계(UTC 날짜). 최근 30일까지만 올라옵니다" />
                        <TrendChart title="가입 회원" unit="명" points={trend.members} sub="그날까지 가입한 회원 수(누적)" />
                    </div>
                </Box>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <Paper withBorder radius="md" p="md" id="new-by-day">
                        <Text fw={700}>들어온 행사 (최근 {period}일, 출처 종류별)</Text>
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
                        <Group justify="space-between" mb="sm">
                            <Text fw={700}>수집분·허락</Text>
                            <Anchor component={Link} href="/admin" size="sm">사람 몫은 «오늘 할 일»에서</Anchor>
                        </Group>
                        <SimpleGrid cols={2} spacing="sm">
                            <Tile label="자동 공개 대기" value={ops.inbox} sub="날짜 없음·60일 밖" href="/admin/inbox?tab=pending" />
                            <Tile label="인스타 후보" value={ops.review} sub="공개 후보·동의 필요·사람 판단" href="/admin/inbox?tab=candidate" />
                            <Tile label="인스타 허락 답 대기" value={summary.find(r => r.id === "pending")?.value ?? "—"}
                                sub={summary.find(r => r.id === "pending_over7") ? `7일 넘은 것 ${summary.find(r => r.id === "pending_over7")?.value}건` : "인스타 숫자 없음"} />
                        </SimpleGrid>
                        <Text size="xs" c="dimmed" mt="sm">
                            마지막 새 수집분 {ops.lastRawAt ? fmtTime(ops.lastRawAt) : "없음"} · 포스터 없는 활성 행사 {supply.noPoster}건
                        </Text>
                    </Paper>
                </SimpleGrid>

                {/* 수집: 회차 요약(specs/019 A6)과 출처별 최근 실행 */}
                <Box id="collect"><RoutineSteps /></Box>

                <Paper withBorder radius="md" p="md" id="collector-runs">
                    <Text fw={700}>출처별 최근 실행</Text>
                    <Text size="xs" c="dimmed" mb="sm">
                        {latestRuns.length
                            ? `${fmtTime(latestRuns[0].run_at)} 정기 실행 · 수집기가 올린 기록 · 막대는 출처별 최근 10회 발견 수(왼쪽이 오래된 것, 빨간 바닥선은 0건)`
                            : "실행 기록이 아직 없습니다"}
                    </Text>
                    {latestRuns.length > 0 && (
                        <Table.ScrollContainer minWidth={760}>
                            <Table verticalSpacing={6} fz="sm">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>출처</Table.Th>
                                        <Table.Th>상태</Table.Th>
                                        <Table.Th ta="right">발견</Table.Th>
                                        <Table.Th ta="right">신규</Table.Th>
                                        <Table.Th ta="right">중복</Table.Th>
                                        <Table.Th ta="right">실패</Table.Th>
                                        <Table.Th>최근 10회 발견</Table.Th>
                                        <Table.Th>메모</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {latestRuns.map((r, i) => {
                                        const tone = RUN_TONE_BADGE[runStatusTone(r.status)];
                                        return (
                                            <Table.Tr key={`${r.source}-${i}`}>
                                                <Table.Td>
                                                    <Text size="sm">{r.source}</Text>
                                                    {r.kind === "publish" && <Text size="xs" c="dimmed">발견 = 공개한 수</Text>}
                                                </Table.Td>
                                                <Table.Td><Badge size="sm" color={tone.color} variant={tone.variant}>{r.status || "—"}</Badge></Table.Td>
                                                <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }} c={r.found === 0 ? "red" : undefined}>{fmtNum(r.found)}</Table.Td>
                                                <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.new)}</Table.Td>
                                                <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.dup)}</Table.Td>
                                                <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }} c={r.fail ? "red" : undefined}>{fmtNum(r.fail)}</Table.Td>
                                                <Table.Td><FoundStrip source={r.source} points={series.get(r.source) || []} /></Table.Td>
                                                <Table.Td><Text size="xs" c="dimmed" truncate="end" maw={280} title={r.note || undefined}>{r.note || ""}</Text></Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </Paper>

                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" id="spread">
                    <Paper withBorder radius="md" p="md" id="by-region">
                        <Group justify="space-between" mb="sm">
                            <Text fw={700}>경남 시군별 활성 행사</Text>
                            {supply.emptyRegions.length > 0 && <Badge color="red" variant="light">0건 {supply.emptyRegions.length}곳</Badge>}
                        </Group>
                        <BarList rows={gyeongnam} highlightZero />
                    </Paper>
                    <Paper withBorder radius="md" p="md" id="by-busan">
                        <Text fw={700}>부산 구·군별 활성 행사</Text>
                        <Text size="xs" c="dimmed" mb="sm">부산 {busanTotal.toLocaleString()}건 · 장소의 구·군으로 나눔(장소를 모르는 행사는 «구·군 모름»)</Text>
                        <BarList rows={byBusan} />
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

                <SiteVisitsPanel data={ops.snapshots["site_visits"]?.data as unknown as SiteVisits | undefined} updatedAt={ops.snapshots["site_visits"]?.updated_at} />

                <Box id="people"><PushMemberStats /></Box>

                <Paper withBorder radius="md" p="md" id="insta">
                    <Group justify="space-between" mb="sm" align="flex-start" wrap="wrap">
                        <div>
                            <Text fw={700}>인스타그램 (@picka.news)</Text>
                            <Text size="xs" c="dimmed">
                                {snap ? `${fmtTime(snap.updated_at)}에 수집기가 올린 숫자` : "아직 올라온 숫자가 없습니다"} · 추이와 운영 지표는 인스타그램 화면에 모았습니다
                            </Text>
                        </div>
                        <Anchor component={Link} href="/admin/insta" size="sm" fw={700}>인스타그램 화면 열기 →</Anchor>
                    </Group>
                    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                        <Tile label="팔로워" value={fmtNum(instaLast?.followers)} sub={instaLast ? `${instaLast.date} 기준` : "숫자 없음"} href="/admin/insta" />
                        <Tile label="최근 7일 조회" value={fmtNum(instaLast?.views_7d)} sub={instaLast ? `${instaLast.date} 기준` : "숫자 없음"} href="/admin/insta" />
                        <Tile label="최근 7일 게시" value={instaDays.slice(-7).reduce((t, d) => t + d.소규모 + d.공공 + d.기타, 0)} sub="소규모·공공·기타 합계" href="/admin/insta" />
                        <Tile label="허락 답 대기" value={summary.find(r => r.id === "pending")?.value ?? "—"}
                            sub={summary.find(r => r.id === "pending_over7") ? `7일 넘은 것 ${summary.find(r => r.id === "pending_over7")?.value}건` : "숫자 없음"} href="/admin/insta" />
                    </SimpleGrid>
                </Paper>
            </Stack>
        </Container>
    );
}
