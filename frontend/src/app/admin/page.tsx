"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminShell";
import { GROUP_LABEL, type QueueGroup, type QueueItem, type RoutineLine } from "@/lib/adminCounts";

// 관리자 첫 화면 «오늘 할 일» (specs/019 A2).
// 정기 실행(매일 08:20·15:00)이 수집·검증·공개·정리를 하고, 여기에는 자동화가 판단하지 못해 넘긴 것과 사람이 보낸 것만 모은다.
// 그래프·통계는 «현황»(/admin/status)에 있다.

const GROUPS: QueueGroup[] = ["publish", "received", "refine"];
const RUN_TIMES: [number, number][] = [[8, 20], [15, 0]];   // 정기 실행 시각(한국 시각). 이 PC의 예약 실행과 같아야 한다

const kst = (iso: string | Date) => new Date((typeof iso === "string" ? new Date(iso) : iso).getTime() + 9 * 3600 * 1000);
const pad = (n: number) => String(n).padStart(2, "0");

function dayTime(iso: string): string {
    const d = kst(iso);
    return `${d.getUTCMonth() + 1}.${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function waited(iso: string): string {
    const d = kst(iso);
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return `${d.getUTCMonth() + 1}.${d.getUTCDate()}부터${days >= 1 ? ` · ${days}일째` : ""}`;
}

function nextRun(): string {
    const now = kst(new Date());
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const next = RUN_TIMES.find(([h, m]) => h * 60 + m > mins);
    return next ? `오늘 ${pad(next[0])}:${pad(next[1])}` : `내일 ${pad(RUN_TIMES[0][0])}:${pad(RUN_TIMES[0][1])}`;
}

function Routine({ r }: { r: RoutineLine }) {
    const alerts = r.openAlerts;
    const missed = r.missed.state === "missed";
    const bad = missed || alerts.length > 0;
    return (
        <Link href="/admin/status" className={`mt-4 block rounded-[14px] border-[1.5px] bg-card px-4 py-3 no-underline ${bad ? "border-[#b5432f]" : "border-line"}`}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-[14.5px] text-ink">
                    {r.missed.state === "none" ? (
                        <b>정기 실행 기록이 아직 없습니다</b>
                    ) : missed ? (
                        <b className="text-[#b5432f]">마지막 정기 실행이 {Math.round(r.missed.hours)}시간 전입니다 ({dayTime(r.missed.lastRunAt)})</b>
                    ) : (
                        <><b>{dayTime(r.missed.lastRunAt)} 실행 끝</b> · 출처 {r.lastRunSources}곳{r.lastRunFailed ? <> · <b className="text-[#b5432f]">실패 {r.lastRunFailed}</b></> : " 정상"}</>
                    )}
                    {alerts.length > 0 && <> · <b className="text-[#b5432f]">경고 {alerts.length}건</b></>}
                    <span className="text-ink-soft"> · 다음 {nextRun()}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-ink-soft" aria-hidden />
            </div>
            {missed && <p className="mt-1 text-[13px] text-ink-soft">예정 시각에 이 PC가 꺼져 있었는지 확인해 주세요. 켜 두면 다음 회차에 이어서 돕니다.</p>}
            {alerts.length > 0 && (
                <ul className="mt-1.5 list-none space-y-0.5 p-0 text-[13px] text-ink-soft">
                    {alerts.slice(0, 3).map((a, i) => <li key={i} className="truncate">· {a.text}</li>)}
                    {alerts.length > 3 && <li>· 외 {alerts.length - 3}건 — 현황에서 모두 보기</li>}
                </ul>
            )}
        </Link>
    );
}

function Row({ item, last }: { item: QueueItem; last: boolean }) {
    return (
        <Link href={item.href} className={`flex items-center gap-3 px-4 py-3 no-underline hover:bg-soft ${last ? "" : "border-b border-line"}`}>
            <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold text-ink">{item.label}</span>
                <span className="block truncate text-[12.5px] text-ink-soft">
                    {item.hint}{item.oldest ? ` · ${waited(item.oldest)}` : ""}
                </span>
            </span>
            <span className="pica-num text-[21px] font-semibold text-accent">{item.count.toLocaleString("ko-KR")}</span>
            <ChevronRight size={17} className="shrink-0 text-ink-soft" aria-hidden />
        </Link>
    );
}

export default function AdminTodoPage() {
    const { counts, reload } = useAdmin();
    const [busy, setBusy] = useState(false);

    const refresh = async () => { setBusy(true); try { await reload(); } finally { setBusy(false); } };

    if (!counts) {
        return <div className="mx-auto max-w-3xl px-4 pt-6"><p className="text-[15px] font-semibold text-ink-soft" role="status">할 일을 세는 중…</p></div>;
    }

    const total = counts.items.reduce((n, i) => n + i.count, 0);
    return (
        <div className="mx-auto max-w-3xl px-4 pt-5">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h1 className="pica-display text-[27px] leading-tight text-ink">오늘 할 일</h1>
                    <p className="mt-0.5 text-[13px] text-ink-soft">자동화가 넘긴 것과 사람이 보낸 것만 모았습니다. {total === 0 ? "지금은 없습니다." : ""}</p>
                </div>
                <button type="button" onClick={refresh} disabled={busy}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(30,26,21,.12)] disabled:opacity-60">
                    <RefreshCw size={14} aria-hidden className={busy ? "animate-spin" : ""} />다시 읽기
                </button>
            </div>

            <Routine r={counts.routine} />

            {GROUPS.map(g => {
                const items = counts.items.filter(i => i.group === g);
                const open = items.filter(i => i.count > 0);
                const none = items.filter(i => i.count === 0);
                return (
                    <section key={g} className="mt-6" aria-label={GROUP_LABEL[g]}>
                        <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-soft">{GROUP_LABEL[g]}</h2>
                        {open.length > 0 && (
                            <div className="overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                                {open.map((item, i) => <Row key={item.key} item={item} last={i === open.length - 1} />)}
                            </div>
                        )}
                        {none.length > 0 && (
                            <p className={`px-1 text-[13px] text-ink-soft ${open.length ? "mt-2" : ""}`}>
                                없음: {none.map((i, k) => <span key={i.key}>{k > 0 && " · "}<Link href={i.href} className="text-ink-soft underline decoration-line underline-offset-4">{i.label}</Link></span>)}
                            </p>
                        )}
                    </section>
                );
            })}

            {counts.errors.length > 0 && (
                <div className="mt-6 rounded-[14px] border-[1.5px] border-[#b5432f] bg-card px-4 py-3 text-[13px] text-ink" role="alert">
                    <b>읽지 못한 것이 있습니다.</b> 아래 숫자는 0으로 보일 수 있습니다.
                    <ul className="mt-1 list-none space-y-0.5 p-0 text-ink-soft">{counts.errors.map((e, i) => <li key={i}>· {e}</li>)}</ul>
                </div>
            )}

            <p className="mt-6 px-1 text-[12.5px] text-ink-soft">{dayTime(counts.loadedAt)}에 읽음 · 통계와 실행 기록은 <Link href="/admin/status" className="text-ink underline underline-offset-4">현황</Link>에 있습니다.</p>
        </div>
    );
}
