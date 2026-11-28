"use client";

// «자동 공개 대기»: 웹·블로그·KOPIS 수집분(raw_posts COLLECTED·PENDING) 가운데 정기 실행의 자동 공개에서 빠진 것 (specs/019 FR-017).
// 정기 실행(collector/tools/publish_verified.py)의 규칙과 같은 순서로 이유를 나눈다:
//   날짜 없음   — 시작일·끝나는 날이 YYYY-MM-DD 가 아님 → 여기서 날짜를 적으면 다음 실행이 검증(날짜·링크·중복)한 뒤 공개한다
//   60일 뒤     — 시작일이 오늘+60일보다 뒤 → 때가 되면 자동으로 공개 대상이 된다(할 일 없음)
//   검증에서 멈춤 — 날짜는 범위 안인데 남아 있는 것(원본 링크가 안 열림 등). 다음 실행에서 다시 본다
// 이 화면은 바로 공개하지 않는다. 검증 없이 올리는 길은 «단체 제공»(리플렛)뿐이다(헌장 I).

import { useMemo, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Button, Text } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { DateFields, JudgeCard } from "./JudgeCard";

export interface CollectedPost {
    id: string;
    source: string;
    source_url: string;
    content: Record<string, unknown> & { title?: string; ai_suggestion?: Record<string, string | undefined> };
    image_urls: string[];
    collected_at: string;
    status: string;
}

type Reason = "nodate" | "stuck" | "later" | "ended";
const ISO = /^20\d\d-\d\d-\d\d$/;
const WINDOW_DAYS = 60;   // 정기 실행의 공개 범위(오늘~60일 뒤, collector/main.py)

function addDays(day: string, n: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

export function reasonOf(p: CollectedPost, today: string): Reason {
    const a = p.content?.ai_suggestion || {};
    const s = a.date_start || "", e = a.date_end || "";
    if (!ISO.test(s) || !ISO.test(e)) return "nodate";
    if (e < today) return "ended";
    if (s > addDays(today, WINDOW_DAYS)) return "later";
    return "stuck";
}

const md = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`;

function Card({ p, reason, today, onDone, onOpen }: { p: CollectedPost; reason: Reason; today: string; onDone: (id: string, next: CollectedPost | null) => void; onOpen?: (p: CollectedPost) => void }) {
    const a = p.content?.ai_suggestion || {};
    const [start, setStart] = useState(ISO.test(a.date_start || "") ? a.date_start! : "");
    const [end, setEnd] = useState(ISO.test(a.date_end || "") ? a.date_end! : "");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    // content 는 jsonb 라 통째로 바뀐다 → 쓰기 직전에 최신 값을 다시 읽어 날짜만 고친다(정기 실행이 쓴 키를 지우지 않게)
    const saveDates = async () => {
        if (!ISO.test(start) || !ISO.test(end)) { setMsg("시작일과 끝나는 날을 모두 넣어 주세요."); return; }
        if (end < start) { setMsg("끝나는 날이 시작일보다 앞입니다."); return; }
        if (end < today) { setMsg("이미 끝난 날짜입니다."); return; }
        setBusy(true); setMsg("");
        const { data: cur, error: readErr } = await supabase.from("raw_posts").select("status,content").eq("id", p.id).maybeSingle();
        if (readErr || !cur || !["COLLECTED", "PENDING"].includes(cur.status)) {
            setBusy(false); setMsg("그사이 상태가 바뀌었습니다. 다시 읽어 주세요."); return;
        }
        const content = { ...(cur.content || {}), ai_suggestion: { ...((cur.content || {}).ai_suggestion || {}), date_start: start, date_end: end, date_by: "admin" } };
        const { data, error } = await supabase.from("raw_posts").update({ content }).eq("id", p.id).in("status", ["COLLECTED", "PENDING"]).select("id");
        setBusy(false);
        if (error || !data?.length) { setMsg(`저장하지 못했습니다: ${error?.message || "권한 확인"}`); return; }
        onDone(p.id, { ...p, content });
    };

    const reject = async () => {
        setBusy(true); setMsg("");
        const { data, error } = await supabase.from("raw_posts").update({ status: "REJECTED" }).eq("id", p.id).in("status", ["COLLECTED", "PENDING"]).select("id");
        setBusy(false);
        if (error || !data?.length) { setMsg(`처리하지 못했습니다: ${error?.message || "상태가 바뀜"}`); return; }
        onDone(p.id, null);
    };

    // 모양은 공개 판단의 다른 탭과 같은 카드(JudgeCard). 이 탭은 날짜 넣기·«날짜 저장»·«반영 안 함»만 다르다
    return (
        <JudgeCard post={p} onOpen={onOpen ? () => onOpen(p) : undefined}
            reason={{ text: reason === "nodate" ? "날짜 없음 — 자동 공개에서 빠짐" : "날짜는 범위 안인데 검증에서 멈춤(원본 링크 등)" }}
            extra={<DateFields start={start} end={end} onStart={setStart} onEnd={setEnd} />}
            actions={<>
                <Button variant="default" size="xs" radius="xl" disabled={busy} onClick={reject} leftSection={<XCircle size={14} />}>반영 안 함</Button>
                <Button color="teal" size="xs" radius="xl" disabled={busy} onClick={saveDates} leftSection={<CheckCircle size={14} />}>날짜 저장</Button>
            </>}
            note={<Text size="xs" c={msg ? "red" : "dimmed"} role="status">
                {msg || (reason === "nodate" ? "원본에서 날짜를 확인해 적으면, 다음 정기 실행이 날짜·링크·중복을 확인한 뒤 공개합니다." : "날짜는 범위 안입니다. 원본 링크가 열리는지 확인해 주세요. 다음 정기 실행에서 다시 검증합니다.")}
            </Text>}
        />
    );
}

export function CollectedQueue({ posts, loading, onChanged, onOpen }: { posts: CollectedPost[]; loading: boolean; onChanged: (id: string, next: CollectedPost | null) => void; onOpen?: (p: CollectedPost) => void }) {
    const today = todayKST();
    const groups = useMemo(() => {
        const g: Record<Reason, CollectedPost[]> = { nodate: [], stuck: [], later: [], ended: [] };
        for (const p of posts) g[reasonOf(p, today)].push(p);
        g.later.sort((x, y) => (x.content.ai_suggestion?.date_start || "").localeCompare(y.content.ai_suggestion?.date_start || ""));
        return g;
    }, [posts, today]);

    if (loading) return <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">불러오는 중…</p>;
    if (posts.length === 0) return <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">자동 공개에서 빠진 수집분이 없습니다.</p>;

    const head = "mb-2 mt-6 px-1 text-[14px] font-bold text-ink";
    return (
        <div>
            <p className="px-1 text-[13px] text-ink-soft">정기 실행이 공개하지 않고 남긴 수집분입니다. 이 화면에서는 바로 공개하지 않고, 고친 것은 다음 실행이 검증한 뒤 공개합니다.</p>

            <h2 className={head}>날짜 없음 <span className="pica-num text-accent">{groups.nodate.length}</span></h2>
            {groups.nodate.length === 0 ? <p className="px-1 text-[13px] text-ink-soft">없음</p> : (
                <div className="grid gap-4">{groups.nodate.map(p => <Card key={p.id} p={p} reason="nodate" today={today} onDone={onChanged} onOpen={onOpen} />)}</div>
            )}

            <h2 className={head}>검증에서 멈춘 것 <span className="pica-num text-accent">{groups.stuck.length}</span></h2>
            {groups.stuck.length === 0 ? <p className="px-1 text-[13px] text-ink-soft">없음</p> : (
                <div className="grid gap-4">{groups.stuck.map(p => <Card key={p.id} p={p} reason="stuck" today={today} onDone={onChanged} onOpen={onOpen} />)}</div>
            )}

            <details className="mt-6 rounded-[14px] bg-card px-4 py-3 shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                <summary className="cursor-pointer text-[14px] font-bold text-ink">
                    60일 뒤 행사 <span className="pica-num text-accent">{groups.later.length}</span>
                    <span className="ml-2 text-[12.5px] font-medium text-ink-soft">때가 되면 자동으로 공개 대상이 됩니다 — 할 일 없음</span>
                </summary>
                <ul className="mt-2 list-none space-y-1.5 p-0">
                    {groups.later.map(p => {
                        const s = p.content.ai_suggestion?.date_start || "";
                        return (
                            <li key={p.id} className="flex items-baseline gap-2 text-[13.5px] text-ink">
                                <span className="pica-num w-[52px] shrink-0 text-ink-soft">{md(s)}</span>
                                {onOpen
                                    ? <button type="button" onClick={() => onOpen(p)} className="min-w-0 flex-1 truncate text-left text-ink hover:underline">{p.content.title || "제목 없음"}</button>
                                    : <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-ink no-underline hover:underline">{p.content.title || "제목 없음"}</a>}
                                <span className="shrink-0 text-[12px] text-ink-soft">{md(addDays(s, -WINDOW_DAYS))}부터 대상</span>
                            </li>
                        );
                    })}
                </ul>
            </details>

            {groups.ended.length > 0 && <p className="mt-3 px-1 text-[12.5px] text-ink-soft">이미 끝난 것 {groups.ended.length}건은 다음 정기 실행이 «만료»로 정리합니다.</p>}
        </div>
    );
}
