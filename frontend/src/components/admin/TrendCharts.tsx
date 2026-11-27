"use client";

// 관리자 «현황»·«인스타그램»의 추이 그래프 (specs/019 A10).
// 그래프 하나에 수치 하나(축 하나)만 그린다. 두 수치를 비교할 때는 같은 모양의 그래프를 나란히 둔다.
// 선·막대 위에 마우스(손가락)를 올리면 그날 값이 보이고, «표로 보기»에서 숫자를 그대로 읽을 수 있다.
// 색: 그래프용 초록 한 가지(#2A8C5F, 흰 바탕 대비 3:1 이상·채도 기준 통과). 글자는 화면 글자색을 쓴다.

import { useId, useMemo, useState } from "react";

export const CHART_GREEN = "#2A8C5F";
const GRID = "rgba(30,26,21,.12)";
const AXIS_TEXT = "var(--pk-ink-soft, #6b6257)";

export type TrendPoint = { day: string; v: number | null };

const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const fmt = (v: number | null | undefined, unit = "") => (typeof v === "number" ? `${v.toLocaleString("ko-KR")}${unit}` : "—");

/** 눈금으로 쓰기 좋은 위·아래 값. 막대는 0부터, 선은 값 범위에 여유를 둔다 */
function niceRange(values: number[], fromZero: boolean): [number, number] {
    if (!values.length) return [0, 1];
    const hi = Math.max(...values), lo = fromZero ? 0 : Math.min(...values);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1);
    const step = Math.pow(10, Math.floor(Math.log10(span)));
    const unit = span / step > 5 ? step * 2 : span / step > 2 ? step : step / 2;
    const top = Math.ceil((hi + (fromZero ? 0 : span * 0.08)) / unit) * unit;
    const bottom = fromZero ? 0 : Math.max(0, Math.floor((lo - span * 0.08) / unit) * unit);
    return [bottom, top === bottom ? bottom + unit : top];
}

interface TrendProps {
    title: string;
    /** 제목 아래 한 줄(무엇을 어떻게 센 값인지) */
    sub?: string;
    points: TrendPoint[];
    kind?: "line" | "bar";
    unit?: string;
    /** 맨 위 큰 숫자: 마지막 값(기본) 또는 기간 합계 */
    headline?: "last" | "sum";
}

export function TrendChart({ title, sub, points, kind = "line", unit = "", headline = "last" }: TrendProps) {
    const id = useId();
    const [hover, setHover] = useState<number | null>(null);
    const W = 560, H = 170, padL = 40, padR = 10, padT = 10, padB = 22;
    const known = useMemo(() => points.map((p, i) => ({ ...p, i })).filter(p => typeof p.v === "number") as { day: string; v: number; i: number }[], [points]);
    const [lo, hi] = niceRange(known.map(p => p.v), kind === "bar");
    const n = points.length;
    const step = n > 1 ? (W - padL - padR) / (kind === "bar" ? n : n - 1) : 0;
    const x = (i: number) => padL + (kind === "bar" ? i * step + step / 2 : i * step);
    const y = (v: number) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo || 1));

    const last = known[known.length - 1];
    const first = known[0];
    const sum = known.reduce((s, p) => s + p.v, 0);
    const big = headline === "sum" ? sum : last?.v;
    const delta = headline === "last" && last && first && last.i !== first.i ? last.v - first.v : null;

    // 값이 비는 날은 선을 끊는다
    const segments: string[] = [];
    let cur = "";
    points.forEach((p, i) => {
        if (typeof p.v !== "number") { if (cur) segments.push(cur); cur = ""; return; }
        cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
    });
    if (cur) segments.push(cur);

    const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!n) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = kind === "bar" ? Math.floor((px - padL) / (step || 1)) : Math.round((px - padL) / (step || 1));
        setHover(Math.max(0, Math.min(n - 1, i)));
    };
    const hp = hover != null ? points[hover] : null;
    const ticks = [lo, (lo + hi) / 2, hi];
    const labelIdx = n <= 1 ? [0] : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    const bw = Math.max(2, Math.min(22, step * 0.7));

    return (
        <section className="rounded-[14px] bg-card p-4 shadow-[0_1px_4px_rgba(30,26,21,.08)]" aria-labelledby={`${id}-t`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 id={`${id}-t`} className="text-[14px] font-bold text-ink">{title}</h3>
                <p className="text-[13px] text-ink">
                    <span className="pica-num text-[19px] font-bold">{fmt(big, unit)}</span>
                    {headline === "sum" && <span className="ml-1 text-[12px] text-ink-soft">기간 합계</span>}
                    {delta != null && <span className="ml-1.5 text-[12px] text-ink-soft">{first ? `${md(first.day)}보다 ` : ""}{delta > 0 ? "+" : ""}{delta.toLocaleString("ko-KR")}{unit}</span>}
                </p>
            </div>
            {sub && <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{sub}</p>}

            {known.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-ink-soft">아직 쌓인 숫자가 없습니다.</p>
            ) : (
                <div className="relative mt-2">
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} 추이. ${first ? md(first.day) : ""}부터 ${last ? md(last.day) : ""}까지, 마지막 값 ${fmt(last?.v, unit)}`}
                        style={{ display: "block", touchAction: "pan-y" }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
                        {ticks.map((t, k) => (
                            <g key={k}>
                                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                                <text x={padL - 5} y={y(t) + 3.5} fontSize={10.5} textAnchor="end" fill={AXIS_TEXT}>{Math.round(t).toLocaleString("ko-KR")}</text>
                            </g>
                        ))}
                        {labelIdx.map(i => points[i] && (
                            <text key={i} x={x(i)} y={H - 6} fontSize={10.5} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill={AXIS_TEXT}>{md(points[i].day)}</text>
                        ))}
                        {kind === "bar"
                            ? known.map(p => {
                                const top = y(p.v), h = y(lo) - top;
                                return <rect key={p.day} x={x(p.i) - bw / 2} y={top} width={bw} height={Math.max(h, p.v ? 1.5 : 0)} rx={Math.min(3, bw / 2)} fill={CHART_GREEN} opacity={hover == null || hover === p.i ? 1 : 0.55} />;
                            })
                            : <>
                                {segments.map((d, k) => <path key={k} d={d} fill="none" stroke={CHART_GREEN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
                                {known.length === 1 && <circle cx={x(known[0].i)} cy={y(known[0].v)} r={4} fill={CHART_GREEN} />}
                                {last && known.length > 1 && <circle cx={x(last.i)} cy={y(last.v)} r={4} fill={CHART_GREEN} stroke="#fff" strokeWidth={2} />}
                            </>}
                        {hp && hover != null && (
                            <g pointerEvents="none">
                                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgba(30,26,21,.35)" strokeWidth={1} />
                                {kind === "line" && typeof hp.v === "number" && <circle cx={x(hover)} cy={y(hp.v)} r={4.5} fill={CHART_GREEN} stroke="#fff" strokeWidth={2} />}
                            </g>
                        )}
                    </svg>
                    {hp && hover != null && (
                        <div className="pointer-events-none absolute top-0 rounded-md bg-ink px-2 py-1 text-[12px] font-semibold text-paper"
                            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-105%" : "5%"})`, whiteSpace: "nowrap" }} role="status">
                            {md(hp.day)} · {fmt(hp.v, unit)}
                        </div>
                    )}
                </div>
            )}

            {known.length > 0 && (
                <details className="mt-1">
                    <summary className="cursor-pointer text-[12px] text-ink-soft">표로 보기</summary>
                    <div className="mt-1 max-h-[180px] overflow-y-auto">
                        <table className="w-full text-[12.5px] text-ink">
                            <thead><tr><th className="text-left font-semibold text-ink-soft">날짜</th><th className="text-right font-semibold text-ink-soft">{title}</th></tr></thead>
                            <tbody>{[...points].reverse().map(p => <tr key={p.day}><td>{p.day}</td><td className="pica-num text-right">{fmt(p.v, unit)}</td></tr>)}</tbody>
                        </table>
                    </div>
                </details>
            )}
        </section>
    );
}

/** 기간 고르기(14일·30일·90일) */
export function PeriodPicker({ value, onChange, options = [14, 30, 90] }: { value: number; onChange: (n: number) => void; options?: number[] }) {
    return (
        <div className="flex items-center gap-1.5" role="group" aria-label="기간">
            {options.map(n => (
                <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)}
                    className={`h-8 rounded-full px-3 text-[13px] font-semibold ${value === n ? "bg-ink text-paper" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                    최근 {n}일
                </button>
            ))}
        </div>
    );
}
