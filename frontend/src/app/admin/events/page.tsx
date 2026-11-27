"use client";

// 행사 › 찾기·고치기·숨김 (specs/019 A4). 공개·숨김 행사 전체에서 찾아 한 양식으로 고치고, 내릴 때는 지우지 않고 숨긴다.
// 자동화(중복 정리)가 숨긴 것도 «숨김»에 이유와 함께 보이고 되돌릴 수 있다. 되돌린 행사는 중복 정리가 다시 숨기지 않는다(keep_visible).
// 찾기는 DB에서 하고 50건씩 읽는다(공개 행사가 1,000건을 넘는다).

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { ExternalLink, EyeOff, Pencil, Plus, Search, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";
import { todayKST } from "@/lib/utils";
import { EventFields, checkEvent, eventColumns, type EventDraft } from "@/components/admin/EventFields";

type Ev = {
    id: string; title: string; category: string | null; subcategory: string | null; region: string | null; venue: string | null;
    event_date_start: string | null; event_date_end: string | null; source: string | null; original_url: string | null;
    poster_image_url: string | null; price_info: string | null; is_free: boolean | null; description: string | null;
    insta_post_url: string | null; status: string; hidden_reason: string | null; hidden_by: string | null; hidden_at: string | null;
};
const COLS = "id,title,category,subcategory,region,venue,event_date_start,event_date_end,source,original_url,poster_image_url,price_info,is_free,description,insta_post_url,status,hidden_reason,hidden_by,hidden_at";
const PAGE = 50;
type When = "active" | "ended" | "all";
const HIDE_REASONS = ["같은 행사가 따로 있음(중복)", "취소·연기됨", "날짜·장소 정보가 틀림", "단체가 내려 달라고 함", "부산·경남 행사가 아님"];

const md = (d: string | null) => d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : "";
const period = (e: Ev) => e.event_date_end && e.event_date_end !== e.event_date_start ? `${md(e.event_date_start)}~${md(e.event_date_end)}` : md(e.event_date_start);
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }) : "";

function draftOf(e: Ev): EventDraft {
    return {
        title: e.title || "", category: e.category || "", subcategory: e.subcategory || "", region: e.region || "", venue: e.venue || "",
        date_start: e.event_date_start || "", date_end: e.event_date_end || "", price_info: e.price_info || "", is_free: !!e.is_free,
        original_url: e.original_url || "", description: e.description || "",
    };
}

export default function AdminEventsPage() {
    return <Suspense fallback={null}><AdminEvents /></Suspense>;
}

function AdminEvents() {
    const router = useRouter();
    const sp = useSearchParams();
    const tab = sp.get("tab") === "hidden" ? "hidden" : "published";
    const [q, setQ] = useState("");
    const [typed, setTyped] = useState("");
    const [region, setRegion] = useState("");
    const [category, setCategory] = useState("");
    const [span, setSpan] = useState<When>("active");
    const [rows, setRows] = useState<Ev[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<Ev | null>(null);
    const [draft, setDraft] = useState<EventDraft | null>(null);
    const [poster, setPoster] = useState("");
    const [formMsg, setFormMsg] = useState("");
    const [hiding, setHiding] = useState<string | null>(null);
    const [reason, setReason] = useState(HIDE_REASONS[0]);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    const fetchRows = useCallback(async (from: number) => {
        const today = todayKST();
        let qy = supabase.from("events").select(COLS, { count: "exact" }).eq("status", tab === "hidden" ? "HIDDEN" : "PUBLISHED");
        const text = q.replace(/[,()%*\\]/g, " ").trim();   // PostgREST or() 문법에 쓰이는 글자는 뺀다
        if (text) qy = qy.or(`title.ilike.%${text}%,venue.ilike.%${text}%,source.ilike.%${text}%`);
        if (region) qy = qy.eq("region", region);
        if (category) qy = qy.eq("category", category);
        if (tab === "published" && span === "active") qy = qy.gte("event_date_end", today);
        if (tab === "published" && span === "ended") qy = qy.lt("event_date_end", today);
        qy = tab === "hidden" ? qy.order("hidden_at", { ascending: false, nullsFirst: false })
            : qy.order("event_date_start", { ascending: span === "active" });
        return qy.order("id").range(from, from + PAGE - 1);
    }, [tab, q, region, category, span]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, count, error: err } = await fetchRows(0);
            if (cancelled) return;
            if (err) setError(`읽지 못했습니다: ${err.message}`); else setError("");
            setRows((data || []) as Ev[]); setTotal(count || 0); setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchRows]);

    const more = async () => {
        setBusy(true);
        const { data, error: err } = await fetchRows(rows.length);
        setBusy(false);
        if (err) { setError(`더 읽지 못했습니다: ${err.message}`); return; }
        setRows(prev => [...prev, ...((data || []) as Ev[])]);
    };

    const openEdit = (e: Ev) => { setEditing(e); setDraft(draftOf(e)); setPoster(e.poster_image_url || ""); setFormMsg(""); };

    const saveEdit = async () => {
        if (!editing || !draft) return;
        const bad = checkEvent(draft);
        if (bad.length) { setFormMsg(`${bad.join(" · ")}을(를) 확인해 주세요.`); return; }
        if (poster && !/^https?:\/\//.test(poster)) { setFormMsg("포스터 주소는 http로 시작해야 합니다."); return; }
        setBusy(true);
        const patch: Record<string, unknown> = { ...eventColumns(draft), poster_image_url: poster.trim() || null, edited_at: new Date().toISOString() };
        // 세부 갈래를 운영자가 정했으면 «운영자 확정»으로 남겨 다음 자동 판정이 덮지 않게 한다(공개 화면의 관리자 버튼과 같은 값)
        if ((draft.subcategory || null) !== (editing.subcategory || null)) {
            Object.assign(patch, draft.subcategory
                ? { subcategory_by: "admin", subcategory_pending: false, subcategory_evidence: "운영자 확정" }
                : { subcategory_by: null, subcategory_pending: false, subcategory_evidence: null });
        }
        const { data, error: err } = await supabase.from("events").update(patch).eq("id", editing.id).select(COLS);
        setBusy(false);
        if (err || !data?.length) { setFormMsg(`저장하지 못했습니다: ${err?.message || "권한 확인"}`); return; }
        setRows(prev => prev.map(r => r.id === editing.id ? (data[0] as Ev) : r));
        setEditing(null);
    };

    const hide = async (e: Ev) => {
        setBusy(true);
        const text = [reason, note.trim()].filter(Boolean).join(" — ").slice(0, 300);
        const { data, error: err } = await supabase.from("events")
            .update({ status: "HIDDEN", hidden_reason: text, hidden_by: "운영자", hidden_at: new Date().toISOString() })
            .eq("id", e.id).eq("status", "PUBLISHED").select("id");
        setBusy(false);
        if (err || !data?.length) { setError(`숨기지 못했습니다: ${err?.message || "상태가 바뀜"}`); return; }
        setRows(prev => prev.filter(r => r.id !== e.id)); setTotal(n => Math.max(0, n - 1)); setHiding(null); setNote("");
    };

    const restore = async (e: Ev) => {
        setBusy(true);
        const { data, error: err } = await supabase.from("events")
            .update({ status: "PUBLISHED", keep_visible: true, hidden_reason: null, hidden_by: null, hidden_at: null })
            .eq("id", e.id).eq("status", "HIDDEN").select("id");
        setBusy(false);
        if (err || !data?.length) { setError(`되돌리지 못했습니다: ${err?.message || "상태가 바뀜"}`); return; }
        setRows(prev => prev.filter(r => r.id !== e.id)); setTotal(n => Math.max(0, n - 1));
    };

    const chip = (on: boolean) => `flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13.5px] font-semibold ${on ? "bg-accent text-on-accent" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`;
    const sel = "h-9 max-w-full rounded-full border-0 bg-card px-3 text-[13.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]";

    return (
        <div className="pt-4">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h1 className="pica-display text-[25px] leading-tight text-ink">행사</h1>
                    <p className="mt-0.5 text-[13px] text-ink-soft">고친 내용과 숨김은 공개 화면에 몇 분 안에 반영됩니다.</p>
                </div>
                <Link href="/admin/events/new" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13.5px] font-bold text-on-accent no-underline">
                    <Plus size={15} aria-hidden />새 행사
                </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="행사 상태">
                <button type="button" role="tab" aria-selected={tab === "published"} className={chip(tab === "published")} onClick={() => { setLoading(true); router.replace("/admin/events", { scroll: false }); }}>공개</button>
                <button type="button" role="tab" aria-selected={tab === "hidden"} className={chip(tab === "hidden")} onClick={() => { setLoading(true); router.replace("/admin/events?tab=hidden", { scroll: false }); }}>숨김</button>
            </div>

            <form className="mt-3 flex flex-wrap items-center gap-1.5" onSubmit={e => { e.preventDefault(); setLoading(true); setQ(typed); }}>
                <label className="flex h-9 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-full bg-card px-3 shadow-[0_1px_4px_rgba(30,26,21,.1)]">
                    <Search size={15} className="shrink-0 text-ink-soft" aria-hidden />
                    <input className="min-w-0 flex-1 bg-transparent text-[14px] text-ink !outline-none" placeholder="제목·장소·출처로 찾기" value={typed} onChange={e => setTyped(e.currentTarget.value)} aria-label="행사 찾기" />
                </label>
                <select className={sel} value={region} onChange={e => { setLoading(true); setRegion(e.currentTarget.value); }} aria-label="지역">
                    <option value="">지역 전체</option>{GN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select className={sel} value={category} onChange={e => { setLoading(true); setCategory(e.currentTarget.value); }} aria-label="분야">
                    <option value="">분야 전체</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {tab === "published" && (
                    <select className={sel} value={span} onChange={e => { setLoading(true); setSpan(e.currentTarget.value as When); }} aria-label="기간">
                        <option value="active">진행 중·예정</option><option value="ended">끝난 것</option><option value="all">전체</option>
                    </select>
                )}
                <button type="submit" className="h-9 rounded-full bg-ink px-3.5 text-[13.5px] font-bold text-paper">찾기</button>
            </form>

            {error && <p className="pica-err mt-3" role="alert">{error}</p>}

            <p className="mt-3 px-1 text-[13px] text-ink-soft" role="status">
                {loading ? "찾는 중…" : <><b className="pica-num text-ink">{total.toLocaleString("ko-KR")}</b>건{rows.length < total ? ` 중 ${rows.length}건 보는 중` : ""}{tab === "hidden" ? " · 숨긴 행사는 공개 화면에 나오지 않습니다" : ""}</>}
            </p>

            {!loading && rows.length === 0 && <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">조건에 맞는 행사가 없습니다.</p>}

            <div className="mt-2 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                {rows.map((e, i) => (
                    <div key={e.id} className={`px-4 py-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                            <span className="pica-num w-[84px] shrink-0 pt-0.5 text-[13.5px] font-semibold text-accent">{period(e)}</span>
                            <span className="min-w-0 flex-1 basis-[220px]">
                                <span className="block text-[15px] font-semibold leading-snug text-ink">{e.title}</span>
                                <span className="block text-[12.5px] text-ink-soft">
                                    {[e.region, e.venue].filter(Boolean).join(" · ") || "장소 없음"} · {e.category}{e.subcategory ? ` › ${e.subcategory}` : ""} · {e.source || "출처 없음"}
                                </span>
                                {tab === "hidden" && (
                                    <span className="mt-1 block text-[12.5px] text-ink">
                                        <b>숨긴 이유</b> {e.hidden_reason || "기록 없음"}<span className="text-ink-soft"> · {e.hidden_by || "기록 없음"}{e.hidden_at ? ` · ${when(e.hidden_at)}` : ""}</span>
                                    </span>
                                )}
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                                {tab === "published" ? (
                                    <>
                                        <a href={`/events/${e.id}`} target="_blank" rel="noopener noreferrer" className="flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-accent no-underline">보기 <ExternalLink size={12} aria-hidden /></a>
                                        <button type="button" onClick={() => openEdit(e)} className="flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-semibold text-ink"><Pencil size={13} aria-hidden />고치기</button>
                                        <button type="button" onClick={() => { setHiding(hiding === e.id ? null : e.id); setReason(HIDE_REASONS[0]); setNote(""); }} className="flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-semibold text-ink"><EyeOff size={13} aria-hidden />숨김</button>
                                    </>
                                ) : (
                                    <>
                                        {e.original_url && <a href={e.original_url} target="_blank" rel="noopener noreferrer" className="flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-accent no-underline">원본 <ExternalLink size={12} aria-hidden /></a>}
                                        <button type="button" disabled={busy} onClick={() => restore(e)} className="flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-semibold text-ink disabled:opacity-50"><Undo2 size={13} aria-hidden />되돌리기</button>
                                    </>
                                )}
                            </span>
                        </div>
                        {hiding === e.id && (
                            <div className="mt-2 rounded-xl bg-paper px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <select className="h-9 max-w-full rounded-lg border border-line bg-card px-2 text-[14px] text-ink" value={reason} onChange={ev => setReason(ev.currentTarget.value)} aria-label="숨기는 이유">
                                        {HIDE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <input className="h-9 min-w-0 flex-1 basis-[180px] rounded-lg border border-line bg-card px-2 text-[14px] text-ink" placeholder="덧붙일 말(없어도 됨)" value={note} onChange={ev => setNote(ev.currentTarget.value)} maxLength={200} aria-label="덧붙일 말" />
                                    <button type="button" disabled={busy} onClick={() => hide(e)} className="h-9 rounded-full bg-ink px-3.5 text-[13.5px] font-bold text-paper disabled:opacity-50">숨기기</button>
                                    <button type="button" onClick={() => setHiding(null)} className="h-9 rounded-full px-2 text-[13.5px] font-semibold text-ink-soft">취소</button>
                                </div>
                                <p className="mt-1.5 text-[12.5px] text-ink-soft">
                                    지우지 않고 숨깁니다. «숨김»에서 언제든 되돌릴 수 있습니다.
                                    {e.insta_post_url && <b className="text-[#8f2218]"> 이 행사는 피카 인스타그램에 소개한 게시물이 있습니다 — 게시물은 따로 내려야 합니다.</b>}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {rows.length < total && !loading && (
                <div className="mt-3 text-center">
                    <button type="button" disabled={busy} onClick={more} className="h-9 rounded-full border border-line bg-card px-4 text-[13.5px] font-semibold text-ink disabled:opacity-50">더 보기 ({rows.length}/{total})</button>
                </div>
            )}

            <Modal opened={!!editing} onClose={() => setEditing(null)} title="행사 고치기" size="lg" centered>
                {editing && draft && (
                    <Stack gap="sm">
                        <Text size="xs" c="dimmed">출처 «{editing.source || "없음"}» · 원본에서 확인한 내용만 고쳐 주세요. 추측한 날짜·장소·요금은 넣지 않습니다.</Text>
                        <EventFields value={draft} onChange={setDraft} />
                        <TextInput label="포스터 그림 주소" value={poster} onChange={e => setPoster(e.currentTarget.value)} placeholder="https://" description="공식 출처의 원본 포스터 주소만. 비우면 글자 포스터로 보입니다." />
                        {formMsg && <Text size="sm" className="pica-err" role="alert">{formMsg}</Text>}
                        <Group justify="flex-end">
                            <Button variant="default" onClick={() => setEditing(null)}>취소</Button>
                            <Button loading={busy} onClick={saveEdit}>저장</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </div>
    );
}
