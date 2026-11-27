"use client";

// 출처·단체 › 단체 (specs/019 A5). 행사의 주최·주관으로 이어진 기관·단체·계정 목록.
// 협약 표시(맺은 날), 종류, 인스타 계정을 고치고 메모를 남긴다. 메모는 관리자만 읽는 표(org_admin_notes)에 있다.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Group, Modal, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { ExternalLink, Pencil, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { appendOrgNote } from "@/lib/orgNotes";

type Org = { id: string; name: string; kind: "기관" | "단체" | "계정"; insta_handle: string | null; small: boolean; partner_since: string | null };
const COLS = "id,name,kind,insta_handle,small,partner_since";
const PAGE = 50;
type Only = "" | "partner" | "small";

export default function AdminOrgsPage() {
    const [typed, setTyped] = useState("");
    const [q, setQ] = useState("");
    const [kind, setKind] = useState("");
    const [only, setOnly] = useState<Only>("");
    const [rows, setRows] = useState<Org[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<Org | null>(null);
    const [form, setForm] = useState({ kind: "단체", insta_handle: "", partner_since: "", note: "" });
    const [savedNote, setSavedNote] = useState("");
    const [formMsg, setFormMsg] = useState("");

    const fetchRows = useCallback(async (from: number) => {
        let qy = supabase.from("orgs").select(COLS, { count: "exact" });
        const text = q.replace(/[,()%*\\]/g, " ").trim();
        if (text) qy = qy.or(`name.ilike.%${text}%,insta_handle.ilike.%${text.replace(/^@/, "")}%`);
        if (kind) qy = qy.eq("kind", kind);
        if (only === "partner") qy = qy.not("partner_since", "is", null);
        if (only === "small") qy = qy.eq("small", true);
        return qy.order("name").range(from, from + PAGE - 1);
    }, [q, kind, only]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, count, error: err } = await fetchRows(0);
            if (cancelled) return;
            setError(err ? `읽지 못했습니다: ${err.message}` : "");
            setRows((data || []) as Org[]); setTotal(count || 0); setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchRows]);

    const more = async () => {
        setBusy(true);
        const { data } = await fetchRows(rows.length);
        setBusy(false);
        setRows(prev => [...prev, ...((data || []) as Org[])]);
    };

    const openEdit = async (o: Org) => {
        setEditing(o); setFormMsg(""); setSavedNote("");
        setForm({ kind: o.kind, insta_handle: o.insta_handle || "", partner_since: o.partner_since || "", note: "" });
        const { data } = await supabase.from("org_admin_notes").select("note").eq("org_id", o.id).maybeSingle();
        setSavedNote((data?.note as string) || "");
    };

    const save = async () => {
        if (!editing) return;
        const handle = form.insta_handle.trim().replace(/^@/, "").toLowerCase();
        if (handle && !/^[a-z0-9._]{1,30}$/.test(handle)) { setFormMsg("인스타 계정은 영문·숫자·점·밑줄만 넣어 주세요."); return; }
        if (form.partner_since && form.partner_since > todayKST()) { setFormMsg("협약 맺은 날은 오늘보다 뒤일 수 없습니다."); return; }
        setBusy(true);
        const patch = { kind: form.kind, insta_handle: handle || null, partner_since: form.partner_since || null };
        const { data, error: err } = await supabase.from("orgs").update(patch).eq("id", editing.id).select(COLS);
        if (err || !data?.length) { setBusy(false); setFormMsg(`저장하지 못했습니다: ${err?.message || "권한 확인"}${err?.code === "23505" ? " (같은 인스타 계정의 단체가 이미 있습니다)" : ""}`); return; }
        // 협약 표시가 바뀌었으면 메모에 날짜를 남긴다(풀면 맺은 날이 지워지므로)
        const lines: string[] = [];
        if ((editing.partner_since || "") !== form.partner_since) {
            lines.push(form.partner_since ? `${todayKST()} 협약 표시(${form.partner_since}부터)` : `${editing.partner_since}~${todayKST()} 협약 풂`);
        }
        if (form.note.trim()) lines.push(`${todayKST()} ${form.note.trim()}`);
        if (lines.length) {
            const noteErr = await appendOrgNote(editing.id, lines.join(" / "));
            if (noteErr) { setBusy(false); setFormMsg(`단체는 저장했지만 메모를 남기지 못했습니다: ${noteErr}`); return; }
        }
        setBusy(false);
        setRows(prev => prev.map(r => r.id === editing.id ? (data[0] as Org) : r));
        setEditing(null);
    };

    const sel = "h-9 max-w-full rounded-full border-0 bg-card px-3 text-[13.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]";
    return (
        <div className="mx-auto max-w-5xl px-4 pt-4">
            <h1 className="pica-display text-[25px] leading-tight text-ink">단체</h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">행사의 주최·주관으로 이어진 기관·단체·계정입니다. 새 단체는 정기 실행이 행사와 함께 만들고, 협약 신청을 확인할 때도 만들어집니다.</p>

            <form className="mt-3 flex flex-wrap items-center gap-1.5" onSubmit={e => { e.preventDefault(); setLoading(true); setQ(typed); }}>
                <label className="flex h-9 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-full bg-card px-3 shadow-[0_1px_4px_rgba(30,26,21,.1)]">
                    <Search size={15} className="shrink-0 text-ink-soft" aria-hidden />
                    <input className="min-w-0 flex-1 bg-transparent text-[14px] text-ink !outline-none" placeholder="이름·인스타 계정으로 찾기" value={typed} onChange={e => setTyped(e.currentTarget.value)} aria-label="단체 찾기" />
                </label>
                <select className={sel} value={kind} onChange={e => { setLoading(true); setKind(e.currentTarget.value); }} aria-label="종류">
                    <option value="">종류 전체</option><option value="기관">기관</option><option value="단체">단체</option><option value="계정">계정</option>
                </select>
                <select className={sel} value={only} onChange={e => { setLoading(true); setOnly(e.currentTarget.value as Only); }} aria-label="묶음">
                    <option value="">모두</option><option value="partner">협약 단체만</option><option value="small">소규모만</option>
                </select>
                <button type="submit" className="h-9 rounded-full bg-ink px-3.5 text-[13.5px] font-bold text-paper">찾기</button>
            </form>

            {error && <p className="mt-3 rounded-xl border-[1.5px] border-[#b5432f] bg-card px-3 py-2 text-[13.5px] text-ink" role="alert">{error}</p>}
            <p className="mt-3 px-1 text-[13px] text-ink-soft" role="status">
                {loading ? "찾는 중…" : <><b className="pica-num text-ink">{total.toLocaleString("ko-KR")}</b>곳{rows.length < total ? ` 중 ${rows.length}곳 보는 중` : ""}</>}
            </p>
            {!loading && rows.length === 0 && <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">조건에 맞는 단체가 없습니다.</p>}

            <div className="mt-2 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                {rows.map((o, i) => (
                    <div key={o.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
                        <span className="min-w-0 flex-1 basis-[200px]">
                            <span className="block text-[15px] font-semibold text-ink">{o.name}</span>
                            <span className="block text-[12.5px] text-ink-soft">
                                {o.kind}{o.small ? " · 소규모" : ""}{o.insta_handle ? ` · @${o.insta_handle}` : ""}
                            </span>
                        </span>
                        {o.partner_since && <span className="shrink-0 rounded-md bg-[var(--pk-accent-soft)] px-2 py-0.5 text-[12px] font-bold text-accent">협약 {o.partner_since}부터</span>}
                        <span className="flex shrink-0 items-center gap-1.5">
                            <Link href={`/orgs/${o.id}`} target="_blank" className="flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-accent no-underline">보기 <ExternalLink size={12} aria-hidden /></Link>
                            <button type="button" onClick={() => openEdit(o)} className="flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-semibold text-ink"><Pencil size={13} aria-hidden />고치기</button>
                        </span>
                    </div>
                ))}
            </div>
            {rows.length < total && !loading && (
                <div className="mt-3 text-center">
                    <button type="button" disabled={busy} onClick={more} className="h-9 rounded-full border border-line bg-card px-4 text-[13.5px] font-semibold text-ink disabled:opacity-50">더 보기 ({rows.length}/{total})</button>
                </div>
            )}

            <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.name || "단체"} centered>
                {editing && (
                    <Stack gap="sm">
                        <Select label="종류" data={["기관", "단체", "계정"]} value={form.kind} allowDeselect={false} onChange={v => setForm({ ...form, kind: v || "단체" })} />
                        <TextInput label="인스타 계정" placeholder="@ 없이" value={form.insta_handle} onChange={e => setForm({ ...form, insta_handle: e.currentTarget.value })} />
                        <TextInput label="협약 맺은 날" type="date" max={todayKST()} value={form.partner_since} onChange={e => setForm({ ...form, partner_since: e.currentTarget.value })}
                            description="날짜가 있으면 단체 화면에 «협약» 도장이 보입니다. 비우면 협약 표시를 풉니다." />
                        {savedNote && <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>지금까지의 메모(관리자만 봄): {savedNote}</Text>}
                        <Textarea label="메모 덧붙이기(관리자만 봄)" autosize minRows={2} value={form.note} onChange={e => setForm({ ...form, note: e.currentTarget.value })} maxLength={300} />
                        {formMsg && <Text size="sm" c="red" role="alert">{formMsg}</Text>}
                        <Group justify="flex-end">
                            <Button variant="default" onClick={() => setEditing(null)}>취소</Button>
                            <Button loading={busy} onClick={save}>저장</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </div>
    );
}
