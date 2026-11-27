"use client";

// 현황 › 인스타그램 (specs/019 A10, 2026-11-27 운영자 요청 «인스타그램 부분만 따로 볼 수 있게»).
// @picka.news 운영 숫자와 추이. 숫자는 수집기가 하루 두 번 올리는 묶음(ops_snapshots)에서 읽는다:
//   insta_stats   날짜별 팔로워·팔로잉·최근 7일 조회/도달/반응/프로필 방문(저녁에 프로필 화면에서 읽은 값)
//   insta_daily   날짜별 게시·팔로우·댓글·허락 댓글·받은 반응·새 허락
//   insta_metrics 운영 지표(kind=summary)와 날짜별 줄(kind=day: 소규모·공공 게시 수)
//   insta_runs    회차 기록(예약 작업이 걸린 시간·상태)
// 이 화면은 읽기만 한다. 원본은 이 PC의 docs/insta/report/*.json.

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { TrendChart, type TrendPoint } from "@/components/admin/TrendCharts";

const INSTA_ARTIFACT = "https://claude.ai/artifact/EnT4xJRMQW8159WjmqEZrX";

type Stat = { date: string; followers?: number | null; following?: number | null; views_7d?: number | null; reached_7d?: number | null; interactions_7d?: number | null; profile_visits_7d?: number | null; posts?: number | null };
type Daily = { date: string; posts?: number | null; stories?: number | null; follows?: number | null; comments?: number | null; ask_comments?: number | null; feedback?: number | null; new_permits?: number | null };
type Metric = { kind: string; id: string; group?: string; name?: string; value?: number | null; unit?: string; target?: string; status?: string; what?: string; date?: string; posts?: number; posts_small?: number; posts_public?: number };
type Run = { date: string; round?: string; start?: string; end?: string; minutes?: number | null; status?: string; task?: string };
type Snap = { name: string; data: { rows?: unknown[] }; updated_at: string };

const rowsOf = <T,>(s: Snap | undefined): T[] => (Array.isArray(s?.data?.rows) ? (s!.data.rows as T[]) : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const series = <T extends { date: string }>(rows: T[], pick: (r: T) => unknown): TrendPoint[] => rows.map(r => ({ day: r.date, v: num(pick(r)) }));
const fmtAt = (iso?: string) => iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : "";
const STATUS_LABEL: Record<string, string> = { done: "끝남", running: "기록 때 진행 중", failed: "실패", stopped: "멈춤" };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-[14px] bg-card px-4 py-3 shadow-[0_1px_4px_rgba(30,26,21,.08)]">
            <p className="text-[12.5px] font-semibold text-ink-soft">{label}</p>
            <p className="pica-num mt-0.5 text-[24px] font-bold leading-tight text-ink">{value}</p>
            {sub && <p className="mt-0.5 text-[12px] text-ink-soft">{sub}</p>}
        </div>
    );
}

export default function AdminInstaPage() {
    const [snaps, setSnaps] = useState<Record<string, Snap> | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error: err } = await supabase.from("ops_snapshots").select("name,data,updated_at").in("name", ["insta_stats", "insta_daily", "insta_metrics", "insta_runs"]);
            if (cancelled) return;
            if (err) setError(`읽지 못했습니다: ${err.message}`);
            setSnaps(Object.fromEntries(((data || []) as Snap[]).map(s => [s.name, s])));
        })();
        return () => { cancelled = true; };
    }, []);

    const v = useMemo(() => {
        if (!snaps) return null;
        const byDate = <T extends { date: string }>(rows: T[]) => [...rows].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
        const stats = byDate(rowsOf<Stat>(snaps.insta_stats));
        const daily = byDate(rowsOf<Daily>(snaps.insta_daily));
        const metrics = rowsOf<Metric>(snaps.insta_metrics);
        const summary = metrics.filter(m => m.kind === "summary" && m.group !== "공급");
        const days = byDate(metrics.filter(m => m.kind === "day").map(m => ({ ...m, date: m.date || "" })));
        const runs = [...rowsOf<Run>(snaps.insta_runs)].sort((a, b) => String(b.start || b.date).localeCompare(String(a.start || a.date))).slice(0, 10);
        const last = stats[stats.length - 1];
        // 7일 전(그날이 없으면 그보다 앞선 가장 가까운 날)의 줄과 견준다
        const weekAgo = last ? [...stats].reverse().find(s => s.date <= new Date(Date.parse(`${last.date}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)) : undefined;
        return { stats, daily, summary, days, runs, last, weekAgo, groups: [...new Set(summary.map(m => m.group || ""))] };
    }, [snaps]);

    if (!snaps || !v) return <div className="mx-auto max-w-5xl px-4 pt-4"><p className="py-10 text-center text-[15px] font-semibold text-ink-soft">불러오는 중…</p></div>;
    const { stats, daily, summary, days, runs, last, weekAgo, groups } = v;
    const updated = snaps.insta_daily?.updated_at || snaps.insta_stats?.updated_at;
    const cmp = (key: keyof Stat) => {
        const a = num(last?.[key]), b = num(weekAgo?.[key]);
        return a == null ? "" : b == null ? "견줄 7일 전 숫자 없음" : `${weekAgo!.date.slice(5).replace("-", "/")}보다 ${a - b > 0 ? "+" : ""}${(a - b).toLocaleString("ko-KR")}`;
    };
    const show = (x: unknown) => (num(x) == null ? "—" : (x as number).toLocaleString("ko-KR"));
    const head = "mb-2 mt-7 px-1 text-[15px] font-bold text-ink";

    return (
        <div className="mx-auto max-w-5xl px-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h1 className="pica-display text-[25px] leading-tight text-ink">인스타그램</h1>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                        @picka.news 운영 숫자와 추이입니다. {updated ? `수집기가 ${fmtAt(updated)}에 올린 값` : "아직 올라온 숫자가 없습니다"}
                        {last ? ` · 계정 숫자는 ${last.date}까지` : ""}
                    </p>
                </div>
                <a href={INSTA_ARTIFACT} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1 rounded-full bg-card px-3 text-[13px] font-semibold text-ink no-underline shadow-[0_1px_4px_rgba(30,26,21,.12)]">
                    활동 리포트(전체) <ExternalLink size={13} aria-hidden />
                </a>
            </div>
            {error && <p className="mt-3 rounded-xl border-[1.5px] border-[#b5432f] bg-card px-3 py-2 text-[13.5px] text-ink" role="alert">{error}</p>}

            <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3">
                <Tile label="팔로워" value={show(last?.followers)} sub={cmp("followers")} />
                <Tile label="팔로잉" value={show(last?.following)} sub={cmp("following")} />
                <Tile label="누적 게시물" value={show(last?.posts)} sub={cmp("posts")} />
                <Tile label="최근 7일 조회" value={show(last?.views_7d)} sub={cmp("views_7d")} />
                <Tile label="최근 7일 도달" value={show(last?.reached_7d)} sub={cmp("reached_7d")} />
                <Tile label="최근 7일 프로필 방문" value={show(last?.profile_visits_7d)} sub={cmp("profile_visits_7d")} />
            </div>

            <h2 className={head}>계정 추이 <span className="text-[12.5px] font-medium text-ink-soft">저녁에 프로필 화면에서 읽은 값 · 날짜가 비는 날은 선이 끊깁니다</span></h2>
            <div className="grid gap-2.5 md:grid-cols-2">
                <TrendChart title="팔로워" unit="명" points={series(stats, s => s.followers)} />
                <TrendChart title="팔로잉" unit="명" points={series(stats, s => s.following)} />
                <TrendChart title="최근 7일 조회" sub="그날 기준 지난 7일 동안 게시물이 조회된 수" unit="회" points={series(stats, s => s.views_7d)} />
                <TrendChart title="최근 7일 도달" sub="그날 기준 지난 7일 동안 게시물을 본 계정 수" unit="곳" points={series(stats, s => s.reached_7d)} />
                <TrendChart title="최근 7일 반응" sub="좋아요·댓글·저장·공유" unit="회" points={series(stats, s => s.interactions_7d)} />
                <TrendChart title="최근 7일 프로필 방문" unit="회" points={series(stats, s => s.profile_visits_7d)} />
            </div>

            <h2 className={head}>하루 활동 <span className="text-[12.5px] font-medium text-ink-soft">예약 작업이 그날 한 일</span></h2>
            <div className="grid gap-2.5 md:grid-cols-2">
                <TrendChart kind="bar" headline="sum" title="게시" unit="건" points={series(daily, d => d.posts)} />
                <TrendChart kind="bar" headline="sum" title="팔로우" unit="곳" points={series(daily, d => d.follows)} />
                <TrendChart kind="bar" headline="sum" title="댓글" unit="개" points={series(daily, d => d.comments)} />
                <TrendChart kind="bar" headline="sum" title="허락 댓글" sub="소규모 단체·예술인에게 게시 허락을 물은 댓글" unit="개" points={series(daily, d => d.ask_comments)} />
                <TrendChart kind="bar" headline="sum" title="받은 반응" sub="알림에 온 좋아요·댓글·팔로우" unit="건" points={series(daily, d => d.feedback)} />
                <TrendChart kind="bar" headline="sum" title="새 허락" sub="그날 새로 받은 게시 허락" unit="건" points={series(daily, d => d.new_permits)} />
            </div>

            <h2 className={head}>게시물 구성 <span className="text-[12.5px] font-medium text-ink-soft">작은 무대를 같은 무게로 — 소규모 행사와 공공 행사를 날짜별로</span></h2>
            <div className="grid gap-2.5 md:grid-cols-2">
                <TrendChart kind="bar" headline="sum" title="소규모 행사 게시" unit="건" points={series(days, d => d.posts_small)} />
                <TrendChart kind="bar" headline="sum" title="공공 행사 게시" unit="건" points={series(days, d => d.posts_public)} />
            </div>

            {summary.length > 0 && (
                <>
                    <h2 className={head}>운영 지표 <span className="text-[12.5px] font-medium text-ink-soft">목표가 있는 것은 충족 여부를 함께</span></h2>
                    <div className="grid gap-2.5 md:grid-cols-2">
                        {groups.map(g => (
                            <section key={g} className="rounded-[14px] bg-card p-4 shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                                <h3 className="text-[13px] font-bold text-ink-soft">{g || "기타"}</h3>
                                <ul className="mt-1 list-none space-y-1.5 p-0">
                                    {summary.filter(m => (m.group || "") === g).map(m => (
                                        <li key={m.id} className="flex items-baseline justify-between gap-3">
                                            <span className="min-w-0 text-[13.5px] text-ink">
                                                {m.name}
                                                {m.what && <span className="block text-[11.5px] leading-snug text-ink-soft">{m.what}{m.target ? ` · ${m.target}` : ""}</span>}
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="pica-num text-[15px] font-bold text-ink">{m.value ?? "—"}{m.unit ? ` ${m.unit}` : ""}</span>
                                                {(m.status === "ok" || m.status === "warn") && (
                                                    <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${m.status === "ok" ? "bg-[var(--pk-accent-soft)] text-accent" : "border border-[#b5432f] text-[#b5432f]"}`}>
                                                        {m.status === "ok" ? "목표 충족" : "목표 미달"}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </>
            )}

            {runs.length > 0 && (
                <>
                    <h2 className={head}>최근 회차 <span className="text-[12.5px] font-medium text-ink-soft">예약 작업(오전 10시·오후 4시)이 걸린 시간</span></h2>
                    <div className="overflow-x-auto rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                        <table className="w-full min-w-[420px] text-[13.5px] text-ink">
                            <thead><tr className="text-left text-[12px] text-ink-soft"><th className="px-4 py-2 font-semibold">날짜</th><th className="px-2 py-2 font-semibold">회차</th><th className="px-2 py-2 font-semibold">시작~끝</th><th className="px-2 py-2 text-right font-semibold">걸린 시간</th><th className="px-4 py-2 font-semibold">상태</th></tr></thead>
                            <tbody>
                                {runs.map((r, i) => (
                                    <tr key={`${r.start}-${i}`} className="border-t border-line">
                                        <td className="px-4 py-2">{r.date}</td>
                                        <td className="px-2 py-2">{r.round || "—"}</td>
                                        <td className="pica-num px-2 py-2">{(r.start || "").slice(11)}~{(r.end || "").slice(11)}</td>
                                        <td className="pica-num px-2 py-2 text-right">{num(r.minutes) == null ? "—" : `${Math.round(r.minutes as number)}분`}</td>
                                        <td className="px-4 py-2">{STATUS_LABEL[r.status || ""] || r.status || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            <p className="mt-5 px-1 text-[12.5px] text-ink-soft">
                계정 숫자(팔로워·조회·도달)는 예약 작업이 인스타그램 화면에서 읽어 적은 값이라, 작업이 돌지 않은 날은 비어 있습니다. 숫자가 며칠째 멈춰 있으면 계정 접속부터 확인해 주세요.
            </p>
        </div>
    );
}
