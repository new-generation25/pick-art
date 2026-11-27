"use client";

// 대기함 › 공개 판단 (specs/019 A3). 자동화가 공개하지 못하고 사람에게 넘긴 것:
//   공개 후보·사람 판단·동의 필요 = 인스타 후보(raw_posts REVIEW)의 무더기, 자동 공개 대기 = 웹·블로그·KOPIS 수집분 중 검증에서 빠진 것.
//   최근 결과 = 승인한 것이 다음 정기 실행에서 어떻게 됐는지. 반영 안 한 것 = 되돌릴 수 있는 거절 목록.
// 이 화면은 행사를 바로 공개하지 않는다. 승인·고친 것은 다음 정기 실행(매일 08:20·15:00)이 날짜·링크·중복을 확인한 뒤 공개한다.
// (예전 «발행하기»·«예약 발행»·«현재 노출 삭제»는 없앴다. 공개된 행사는 «행사» 메뉴에서 찾고 고치고 숨긴다.)

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Info, RefreshCw, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/components/admin/AdminShell";
import { ReviewQueue, approvalState, type ReviewChange, type ReviewContent, type ReviewPost } from "./ReviewQueue";
import { ConsentGroups } from "./ConsentGroups";
import { CollectedQueue, type CollectedPost } from "./CollectedQueue";
import { PostDetailModal } from "./PostDetail";
import { CriteriaModal } from "./Criteria";
import { notesOf, opensDetail } from "./notes";

type Tab = "candidate" | "human" | "consent" | "pending" | "results" | "rejected";
const TABS: { key: Tab; label: string }[] = [
    { key: "candidate", label: "공개 후보" },
    { key: "human", label: "사람 판단" },
    { key: "consent", label: "동의 필요" },
    { key: "pending", label: "자동 공개 대기" },
    { key: "results", label: "최근 결과" },
    { key: "rejected", label: "반영 안 한 것" },
];

type Row = ReviewPost;
type ResultRow = Row & { event_id?: string | null };

async function readAll(apply: (from: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {   // 1,000건씩 끝까지 읽는다
        const { data, error } = await apply(from);
        if (error) throw new Error(error.message);
        out.push(...((data || []) as Row[]));
        if (!data || data.length < 1000) return out;
    }
}

const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
};

export default function AdminInboxPage() {
    return <Suspense fallback={null}><AdminInbox /></Suspense>;   // 주소의 ?tab= 을 읽는다
}

function AdminInbox() {
    const router = useRouter();
    const wanted = useSearchParams().get("tab") as Tab | null;
    const tab: Tab = wanted && TABS.some(t => t.key === wanted) ? wanted : "candidate";
    const { email, reload: reloadCounts } = useAdmin();

    const [review, setReview] = useState<Row[]>([]);
    const [collected, setCollected] = useState<Row[]>([]);
    const [rejected, setRejected] = useState<Row[]>([]);
    const [rejectedTotal, setRejectedTotal] = useState(0);
    const [results, setResults] = useState<ResultRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [detailId, setDetailId] = useState<string | null>(null);   // 자세히 보기 창에 띄운 글
    const [criteria, setCriteria] = useState(false);

    const load = useCallback(async () => {
        try {
            const [rv, col, rej, res] = await Promise.all([
                readAll(from => supabase.from("raw_posts").select("*").eq("status", "REVIEW").order("collected_at", { ascending: false }).range(from, from + 999)),
                readAll(from => supabase.from("raw_posts").select("*").in("status", ["COLLECTED", "PENDING"]).order("collected_at", { ascending: false }).range(from, from + 999)),
                supabase.from("raw_posts").select("*", { count: "exact" }).eq("status", "REJECTED").order("collected_at", { ascending: false }).limit(60),
                supabase.from("raw_posts").select("*").not("content->>publish_approved_at", "is", null).order("collected_at", { ascending: false }).limit(200),
            ]);
            setReview(rv); setCollected(col);
            setRejected((rej.data || []) as Row[]); setRejectedTotal(rej.count || 0);
            const approved = ((res.data || []) as ResultRow[])
                .sort((a, b) => String(b.content?.publish_approved_at || "").localeCompare(String(a.content?.publish_approved_at || ""))).slice(0, 40);
            // 공개된 것은 행사 주소를 붙인다
            const pubIds = approved.filter(r => r.status === "PUBLISHED").map(r => r.id);
            if (pubIds.length) {
                const { data: evs } = await supabase.from("events").select("id,raw_post_id").in("raw_post_id", pubIds);
                const byRaw = new Map((evs || []).map(e => [e.raw_post_id as string, e.id as string]));
                for (const r of approved) r.event_id = byRaw.get(r.id) || null;
            }
            setResults(approved);
            setError("");
        } catch (e) {
            setError(`읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
        }
        setLoading(false);
    }, []);

    useEffect(() => { (async () => { await load(); })(); }, [load]);

    const refresh = async () => { setLoading(true); await load(); await reloadCounts(); };

    // 인스타 후보에서 바뀐 줄 반영: REVIEW 면 내용만 바꾸고, 아니면(반영 안 함) 목록에서 빼 «반영 안 한 것»에 넣는다
    const onReviewChanged = (changes: ReviewChange[]) => {
        if (!changes.length) return;
        const by = new Map(changes.map(c => [c.id, c]));
        const gone = review.filter(p => by.has(p.id) && by.get(p.id)!.status !== "REVIEW").map(p => ({ ...p, status: by.get(p.id)!.status, content: by.get(p.id)!.content }));
        setReview(prev => prev.filter(p => !by.has(p.id) || by.get(p.id)!.status === "REVIEW").map(p => by.has(p.id) ? { ...p, content: by.get(p.id)!.content } : p));
        if (gone.length) { setRejected(prev => [...gone, ...prev]); setRejectedTotal(n => n + gone.length); }
        // 공개 승인한 글은 «최근 결과» 맨 위로 (갈래 목록에서는 아래 bucket() 이 뺀다)
        const approved = review.filter(p => by.has(p.id) && by.get(p.id)!.status === "REVIEW" && approvalState(by.get(p.id)!.content) === "waiting" && approvalState(p.content) !== "waiting")
            .map(p => ({ ...p, content: by.get(p.id)!.content }));
        if (approved.length) setResults(prev => [...approved, ...prev.filter(r => !approved.some(a => a.id === r.id))]);
        reloadCounts();
    };

    const onCollectedChanged = (id: string, next: CollectedPost | null) => {
        if (next) setCollected(prev => prev.map(p => p.id === id ? (next as Row) : p));
        else {
            const moved = collected.find(p => p.id === id);
            setCollected(prev => prev.filter(p => p.id !== id));
            if (moved) { setRejected(prev => [{ ...moved, status: "REJECTED" }, ...prev]); setRejectedTotal(n => n + 1); }
        }
        reloadCounts();
    };

    // 되돌리기: 인스타 후보였던 것(무더기가 있음)은 REVIEW 로, 그 밖은 COLLECTED 로(다음 정기 실행이 다시 검증한다)
    const restore = async (p: Row) => {
        const back = p.content?.review_bucket ? "REVIEW" : "COLLECTED";
        const { data, error: err } = await supabase.from("raw_posts").update({ status: back }).eq("id", p.id).eq("status", "REJECTED").select("id");
        if (err || !data?.length) { setError(`되돌리지 못했습니다: ${err?.message || "상태가 바뀜"}`); return; }
        setRejected(prev => prev.filter(x => x.id !== p.id)); setRejectedTotal(n => Math.max(0, n - 1));
        if (back === "REVIEW") setReview(prev => [{ ...p, status: back }, ...prev]); else setCollected(prev => [{ ...p, status: back }, ...prev]);
        reloadCounts();
    };

    // 자세히 보기: 어느 목록에 있든 id 로 찾는다(코멘트를 쓰면 목록의 content 가 바뀌므로 창도 함께 바뀐다)
    const detail = useMemo(() => detailId ? [...review, ...collected, ...rejected, ...results].find(p => p.id === detailId) || null : null,
        [detailId, review, collected, rejected, results]);
    const open = (p: { id: string }) => setDetailId(p.id);
    const onNoteSaved = (id: string, content: ReviewContent) => {
        const put = <T extends Row>(list: T[]): T[] => list.map(p => p.id === id ? ({ ...p, content } as T) : p);
        setReview(put); setCollected(put); setRejected(put); setResults(put);
    };

    // 갈래 목록에는 아직 판단하지 않은 글만 둔다: 공개 승인해 다음 정기 실행을 기다리는 글은 «최근 결과»로 간다
    // (운영자 2026-11-28 «공개 승인되면 리스트에서 없어져야지». 승인 뒤 검증에 걸린 글은 다시 판단하도록 남긴다)
    const bucket = useCallback((b: string) => review.filter(p => p.content?.review_bucket === b && approvalState(p.content || {}) !== "waiting"), [review]);
    const counts = useMemo<Record<Tab, number | null>>(() => ({
        candidate: bucket("candidate").length, human: bucket("human").length, consent: bucket("consent").length,
        pending: collected.length, results: null, rejected: rejectedTotal,
    }), [bucket, collected.length, rejectedTotal]);

    const go = (t: Tab) => router.replace(`/admin/inbox?tab=${t}`, { scroll: false });

    return (
        <div className="pt-4">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h1 className="pica-display text-[25px] leading-tight text-ink">공개 판단</h1>
                    <p className="mt-0.5 text-[13px] text-ink-soft">승인하거나 고친 것은 다음 정기 실행이 날짜·링크·중복을 확인한 뒤 공개합니다.</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(30,26,21,.12)] disabled:opacity-60">
                    <RefreshCw size={14} aria-hidden className={loading ? "animate-spin" : ""} />다시 읽기
                </button>
            </div>

            <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="공개 판단 갈래">
                {TABS.map(t => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)}
                        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold ${tab === t.key ? "bg-accent text-on-accent" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                        {t.label}
                        {counts[t.key] != null && <span className={`pica-num text-[12.5px] ${tab === t.key ? "text-on-accent" : "text-accent"}`}>{loading ? "…" : counts[t.key]}</span>}
                    </button>
                ))}
            </div>

            <button type="button" onClick={() => setCriteria(true)} className="mt-2 flex items-center gap-1 px-1 text-[13px] font-semibold text-accent underline underline-offset-4">
                <Info size={14} aria-hidden />판단 기준 한눈에 보기 — 어떤 글이 어느 갈래로 오는지
            </button>

            {error && <p className="pica-err mt-3" role="alert">{error}</p>}

            <div className="mt-4">
                {tab === "candidate" && <ReviewQueue bucket="candidate" posts={bucket("candidate")} loading={loading} onChanged={onReviewChanged} actor={email} onOpen={open} />}
                {tab === "human" && <ReviewQueue bucket="human" posts={bucket("human")} loading={loading} onChanged={onReviewChanged} actor={email} onOpen={open} />}
                {tab === "consent" && <ConsentGroups posts={bucket("consent")} loading={loading} onChanged={onReviewChanged} actor={email} onOpen={open} />}
                {tab === "pending" && <CollectedQueue posts={collected as unknown as CollectedPost[]} loading={loading} onChanged={onCollectedChanged} onOpen={open} />}

                {tab === "results" && (
                    loading ? <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">불러오는 중…</p>
                        : results.length === 0 ? <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">아직 승인한 후보가 없습니다. «공개 후보»에서 골라 승인하면 여기에 결과가 보입니다.</p>
                            : (
                                <div className="overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                                    {results.map((r, i) => {
                                        const c = r.content || {};
                                        const failed = c.publish_failed_at && String(c.publish_failed_at) >= String(c.publish_approved_at);
                                        const state = r.status === "PUBLISHED" ? { text: "공개됨", tone: "text-accent" }
                                            : r.status === "REVIEW" && failed ? { text: `검증에 걸림 — ${String(c.review_reason || "").replace("publish_failed: ", "")}`, tone: "text-[#8f2218]" }
                                                : r.status === "REVIEW" ? { text: "다음 정기 실행 대기", tone: "text-ink-soft" }
                                                    : { text: r.status === "DUPLICATE" ? "이미 공개된 행사와 같음" : r.status === "EXPIRED" ? "기간이 지나 만료" : r.status === "REJECTED" ? "반영 안 함" : r.status, tone: "text-ink-soft" };
                                        return (
                                            <div key={r.id} onClick={e => { if (opensDetail(e)) open(r); }}
                                                className={`flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 ${i < results.length - 1 ? "border-b border-line" : ""}`}>
                                                <button type="button" onClick={() => open(r)} className="min-w-0 flex-1 basis-[240px] text-left text-[14.5px] font-semibold text-ink">{c.title || "제목 없음"}{notesOf(c).length > 0 ? <span className="ml-1.5 text-[12px] font-medium text-ink-soft">코멘트 {notesOf(c).length}</span> : null}</button>
                                                <span className={`text-[13px] font-semibold ${state.tone}`}>{state.text}</span>
                                                <span className="text-[12.5px] text-ink-soft">승인 {fmt(c.publish_approved_at)}{c.publish_approved_by ? ` · ${String(c.publish_approved_by).split("@")[0]}` : ""}</span>
                                                {r.event_id
                                                    ? <Link href={`/events/${r.event_id}`} className="text-[13px] font-semibold text-accent">행사 보기</Link>
                                                    : <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[13px] font-semibold text-accent">원본 <ExternalLink size={12} aria-hidden /></a>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                )}

                {tab === "rejected" && (
                    loading ? <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">불러오는 중…</p>
                        : rejected.length === 0 ? <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">반영하지 않은 것이 없습니다.</p>
                            : (
                                <>
                                    <p className="px-1 text-[13px] text-ink-soft">
                                        «반영 안 함»으로 뺀 수집분입니다({rejectedTotal}건 중 최근 {rejected.length}건). 지우지 않고 남겨 두어 같은 글이 다시 수집되지 않습니다. 잘못 뺐으면 되돌리세요.
                                    </p>
                                    <div className="mt-3 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                                        {rejected.map((p, i) => (
                                            <div key={p.id} onClick={e => { if (opensDetail(e)) open(p); }}
                                                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i < rejected.length - 1 ? "border-b border-line" : ""}`}>
                                                <span className="min-w-0 flex-1">
                                                    <button type="button" onClick={() => open(p)} className="block w-full truncate text-left text-[14px] font-semibold text-ink">{p.content?.title || "제목 없음"}</button>
                                                    <span className="block truncate text-[12.5px] text-ink-soft">
                                                        {p.source}{p.content?.ai_suggestion?.account ? ` · @${p.content.ai_suggestion.account}` : ""}
                                                        {p.content?.rejected_reason ? ` · ${String(p.content.rejected_reason)}` : ""}{notesOf(p.content).length > 0 ? ` · 코멘트 ${notesOf(p.content).length}` : ""}
                                                    </span>
                                                </span>
                                                <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[13px] font-semibold text-accent">원본</a>
                                                <button type="button" onClick={() => restore(p)} className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-semibold text-ink">
                                                    <Undo2 size={13} aria-hidden />되돌리기
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )
                )}
            </div>

            <PostDetailModal post={detail} actor={email} onClose={() => setDetailId(null)} onSaved={onNoteSaved}
                onReview={onReviewChanged} onCollected={onCollectedChanged} onRestore={p => restore(p as Row)} />
            <CriteriaModal opened={criteria} onClose={() => setCriteria(false)} />

            <p className="mt-6 px-1 text-[12.5px] text-ink-soft">공개된 행사를 찾아 고치거나 숨기려면 <Link href="/admin/events" className="text-ink underline underline-offset-4">행사</Link> 메뉴로 가세요.</p>
        </div>
    );
}
