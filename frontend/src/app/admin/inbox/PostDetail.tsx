"use client";

// 대기함의 글 하나를 크게 보는 창 (specs/019 A7). 어느 탭에서든 줄을 누르면 열린다.
//   · 왜 대기함에 있는지(정기 실행이 붙인 분류 이유를 풀어서) · 수집한 글 전체 · 원문 열기
//   · 운영자 코멘트: raw_posts.content.admin_notes 에 쌓는다. raw_posts 는 관리자만 읽는 표다.
//     코멘트마다 그때의 갈래·분류 이유를 함께 적어, 나중에 분류 규칙을 손볼 때 근거로 읽는다
//     (모아 보기: collector/tools/review_notes.py).
// content 는 jsonb 라 통째로 바뀐다 → 쓰기 직전에 최신 값을 다시 읽어 admin_notes 만 고친다.

import { useState } from "react";
import { Modal } from "@mantine/core";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { BUCKET_LABEL, reasonText, type ReviewBucket, type ReviewContent, type ReviewPost } from "./ReviewQueue";
import { reasonOf, type CollectedPost } from "./CollectedQueue";
import { notesOf, type AdminNote } from "./notes";

const MAX_NOTES = 20;
const MAX_LEN = 500;

const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
};

// 정기 실행이 붙인 분류 이유(collector/tools/triage_review.py 의 rule)를 운영자 말로 푼 것
const REASON_DETAIL: Record<string, string> = {
    official_complete: "기관 계정의 글이고 날짜와 장소가 모두 읽혔습니다.",
    standing_consent: "작가·단체 계정이지만 «상시 동의»를 받은 계정이고 날짜가 있습니다.",
    small_needs_consent: "작가·단체 계정의 글입니다. 게시 동의를 받기 전에는 공개하지 않습니다.",
    informant: "여러 곳의 행사 소식을 옮겨 싣는 계정(인플루언서)의 글입니다. 주최 측 안내로 내용을 확인해야 합니다.",
    no_date: "글에서 행사 날짜를 읽지 못했습니다.",
    image_only: "글 본문이 거의 없고 포스터 그림에만 정보가 있습니다.",
    no_venue: "기관 계정이고 날짜는 있지만 장소를 읽지 못했습니다.",
    no_role: "이 계정이 기관인지 작가·단체인지 정해져 있지 않습니다.",
};

/** 이 글이 왜 지금 이 자리에 있는지: 제목 한 줄 + 설명 줄들 */
export function waitingReason(p: ReviewPost, today: string): { head: string; lines: string[] } {
    const c = p.content || {};
    const reason = String(c.review_reason || "");
    if (p.status === "REVIEW") {
        const approved = c.publish_approved_at ? Date.parse(c.publish_approved_at) : NaN;
        const failed = c.publish_failed_at ? Date.parse(c.publish_failed_at) : NaN;
        if (!Number.isNaN(approved) && !Number.isNaN(failed) && failed >= approved) {
            return { head: "승인했지만 공개 검증에 걸림", lines: [reasonText(reason) || "검증 실패", "승인은 그대로 남아 있어 다음 정기 실행(08:20·15:00)이 다시 확인합니다. 날짜·원문 링크를 확인해 주세요."] };
        }
        if (!Number.isNaN(approved)) {
            return { head: "승인됨 — 다음 정기 실행 대기", lines: [`${fmt(c.publish_approved_at)}에 승인했습니다. 다음 정기 실행(08:20·15:00)이 날짜·원문 링크·중복을 확인한 뒤 공개합니다.`] };
        }
        const b = c.review_bucket as ReviewBucket | undefined;
        const detail = reason.startsWith("admin_moved") ? "운영자가 직접 공개 후보로 옮겼습니다." : REASON_DETAIL[reason] || (reason ? reasonText(reason) : "");
        if (b === "candidate") return { head: "공개 후보", lines: [detail, "운영자가 승인하면 다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개합니다. 승인 전에는 공개되지 않습니다."].filter(Boolean) };
        if (b === "consent") return { head: "동의 필요", lines: [detail, "게시 동의를 받으면 «공개 후보로 옮기기»를 누릅니다. 계정을 «상시 동의»로 바꿔 두면 날짜가 있는 글은 다음 정기 실행이 공개 후보로 옮깁니다."].filter(Boolean) };
        if (b === "human") return { head: "사람 판단", lines: [detail, "원문을 열어 보고 공개할 만하면 «공개 후보로 옮기기», 아니면 «반영 안 함»을 누릅니다."].filter(Boolean) };
        return { head: "아직 나누기 전", lines: ["다음 정기 실행이 공개 후보·동의 필요·사람 판단 가운데 하나로 나눕니다."] };
    }
    if (p.status === "COLLECTED" || p.status === "PENDING") {
        const r = reasonOf(p as unknown as CollectedPost, today);
        if (r === "nodate") return { head: "자동 공개 대기 — 날짜 없음", lines: ["시작일·끝나는 날을 읽지 못해 자동 공개 검증에서 빠졌습니다.", "원문에서 날짜를 확인해 적으면 다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개합니다."] };
        if (r === "later") return { head: "자동 공개 대기 — 60일 뒤 행사", lines: ["시작일이 오늘부터 60일보다 뒤입니다. 때가 되면 정기 실행이 자동으로 공개합니다. 할 일이 없습니다."] };
        if (r === "ended") return { head: "이미 끝난 행사", lines: ["다음 정기 실행이 «만료»로 정리합니다."] };
        return { head: "자동 공개 대기 — 검증에서 멈춤", lines: ["날짜는 공개 범위 안인데 공개되지 않았습니다. 원문 링크가 열리지 않거나 극장 영화로 걸러진 경우입니다.", "다음 정기 실행이 다시 확인합니다. 원문이 열리는지 봐 주세요."] };
    }
    if (p.status === "REJECTED") return { head: "반영 안 함", lines: [c.rejected_reason ? `이유: ${String(c.rejected_reason)}` : "운영자가 반영하지 않기로 한 글입니다.", "같은 글이 다시 수집되지 않도록 지우지 않고 남겨 둡니다. 되돌리면 대기함으로 돌아갑니다."] };
    if (p.status === "PUBLISHED") return { head: "공개됨", lines: ["정기 실행의 검증을 통과해 공개된 글입니다."] };
    if (p.status === "DUPLICATE") return { head: "이미 공개된 행사와 같음", lines: ["같은 행사가 이미 공개돼 있어 따로 올리지 않았습니다."] };
    if (p.status === "EXPIRED") return { head: "기간이 지나 만료", lines: ["끝나는 날이 지나 공개하지 않았습니다."] };
    return { head: p.status, lines: [] };
}

interface Props {
    post: ReviewPost | null;
    actor: string;
    onClose: () => void;
    /** 코멘트를 쓰거나 지운 뒤: 페이지가 목록의 content 를 바꾼다 */
    onSaved: (id: string, content: ReviewContent) => void;
}

export function PostDetailModal({ post, actor, onClose, onSaved }: Props) {
    return (
        <Modal opened={!!post} onClose={onClose} size="xl" centered title={<span className="text-[13px] font-semibold text-ink-soft">대기함 글 자세히 보기</span>}
            styles={{ body: { paddingTop: 0 } }}>
            {post && <Detail key={post.id} post={post} actor={actor} onSaved={onSaved} />}
        </Modal>
    );
}

function Detail({ post, actor, onSaved }: { post: ReviewPost; actor: string; onSaved: (id: string, content: ReviewContent) => void }) {
    const c = post.content || {};
    const a = c.ai_suggestion || {};
    const today = todayKST();
    const why = waitingReason(post, today);
    const body = String(c.description || c.text || c.caption || "").trim();
    const poster = post.image_urls?.[0] || a.poster_url || "";
    const notes = notesOf(c);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [imgOk, setImgOk] = useState(true);
    const isInsta = /instagram\.com/.test(post.source_url || "");

    // 최신 content 를 다시 읽어 admin_notes 만 바꿔 쓴다. 그사이 상태가 바뀌었으면 쓰지 않는다
    const write = async (change: (prev: AdminNote[], cur: ReviewContent, status: string) => AdminNote[]) => {
        setBusy(true); setMsg("");
        const { data: cur, error: readErr } = await supabase.from("raw_posts").select("status,content").eq("id", post.id).maybeSingle();
        if (readErr || !cur) { setBusy(false); setMsg(`읽지 못했습니다: ${readErr?.message || "글이 없습니다"}`); return false; }
        const curContent = (cur.content || {}) as ReviewContent;
        const content: ReviewContent = { ...curContent, admin_notes: change(notesOf(curContent), curContent, cur.status).slice(-MAX_NOTES) };
        const { data, error } = await supabase.from("raw_posts").update({ content }).eq("id", post.id).eq("status", cur.status).select("id");
        setBusy(false);
        if (error || !data?.length) { setMsg(`저장하지 못했습니다: ${error?.message || "그사이 상태가 바뀌었습니다. 창을 닫고 다시 읽어 주세요"}`); return false; }
        onSaved(post.id, content);
        return true;
    };

    const add = async () => {
        const text = draft.trim().slice(0, MAX_LEN);
        if (!text) { setMsg("코멘트를 적어 주세요."); return; }
        const ok = await write((prev, cur, status) => [...prev, {
            at: new Date().toISOString(), by: actor || undefined, text,
            bucket: String(cur.review_bucket || status), reason: cur.review_reason ? String(cur.review_reason) : undefined,
        }]);
        if (ok) { setDraft(""); setMsg("코멘트를 남겼습니다."); }
    };
    const remove = async (at: string) => { if (await write(prev => prev.filter(n => n.at !== at))) setMsg("코멘트를 지웠습니다."); };

    const label = "text-[12px] font-semibold text-ink-soft";
    return (
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div>
                {poster && imgOk
                    // eslint-disable-next-line @next/next/no-img-element -- 인스타·기관 누리집의 그림 주소를 그대로 보여 준다(관리자만 보는 창)
                    ? <img src={poster} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="max-h-[420px] w-full rounded-[12px] bg-soft object-contain" />
                    : <div className="flex h-[180px] items-center justify-center rounded-[12px] bg-soft text-[13px] text-ink-soft">{poster ? "포스터를 불러오지 못했습니다" : "포스터 없음"}</div>}
                <a href={post.source_url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-bold text-on-accent no-underline">
                    {isInsta ? "인스타그램에서 원문 열기" : "원문 페이지 열기"} <ExternalLink size={14} aria-hidden />
                </a>
                <p className="mt-1.5 break-all text-[11.5px] text-ink-soft">{post.source_url}</p>
                {isInsta && <p className="mt-1 text-[11.5px] text-ink-soft">정기 실행의 링크 확인은 인스타그램 글이 지워졌는지는 가려내지 못합니다. 승인 전에 원문이 열리는지 봐 주세요.</p>}
            </div>

            <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink-soft">
                    {post.source}{a.account ? ` · @${a.account}` : ""}{a.author && a.author !== a.account ? ` · ${a.author}` : ""}{a.role ? ` · ${a.role}` : ""}
                </p>
                <h2 className="mt-0.5 text-[19px] font-bold leading-snug text-ink" style={{ wordBreak: "break-word" }}>{c.title || "제목 없음"}</h2>
                <p className="mt-1 text-[14px] text-ink">
                    {a.date_start || "시작일 없음"} ~ {a.date_end || "끝나는 날 없음"} · {[a.region, a.venue].filter(Boolean).join(" · ") || "장소 없음"}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-soft">수집 {fmt(post.collected_at)}{c.review_bucket_at ? ` · 나눈 때 ${fmt(String(c.review_bucket_at))}` : ""}</p>

                <section className="mt-3 rounded-[12px] border-[1.5px] border-accent bg-[var(--pk-accent-soft)] px-3.5 py-3" aria-label="대기 이유">
                    <p className={label}>왜 대기함에 있나</p>
                    <p className="text-[15px] font-bold text-ink">{why.head}</p>
                    {why.lines.map((l, i) => <p key={i} className="mt-1 text-[13.5px] leading-relaxed text-ink">{l}</p>)}
                    {c.review_reason && <p className="mt-1 text-[11.5px] text-ink-soft">분류 기록: {String(c.review_bucket ? BUCKET_LABEL[c.review_bucket as ReviewBucket] || c.review_bucket : post.status)} · {String(c.review_reason)}</p>}
                </section>

                <section className="mt-3" aria-label="운영자 코멘트">
                    <p className={label}>운영자 코멘트 <span className="font-medium">— 관리자만 봅니다. 이 판단이 왜 맞거나 틀렸는지 적어 두면 분류 규칙을 손볼 때 근거로 씁니다.</span></p>
                    {notes.length === 0 && <p className="mt-1 text-[13px] text-ink-soft">아직 남긴 코멘트가 없습니다.</p>}
                    <ul className="mt-1 list-none space-y-1.5 p-0">
                        {notes.map(n => (
                            <li key={n.at} className="rounded-[10px] bg-soft px-3 py-2">
                                <p className="text-[14px] leading-relaxed text-ink" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-soft">
                                    <span>{fmt(n.at)}{n.by ? ` · ${n.by.split("@")[0]}` : ""}</span>
                                    {n.bucket && <span>그때 갈래: {BUCKET_LABEL[n.bucket as ReviewBucket] || n.bucket}{n.reason ? ` (${n.reason})` : ""}</span>}
                                    <button type="button" disabled={busy} onClick={() => remove(n.at)} className="underline underline-offset-2 disabled:opacity-50">지우기</button>
                                </p>
                            </li>
                        ))}
                    </ul>
                    <textarea value={draft} onChange={e => setDraft(e.currentTarget.value)} maxLength={MAX_LEN} rows={3} aria-label="코멘트 쓰기"
                        placeholder="예: 기관 계정인데 날짜를 못 읽음 — 포스터 그림에만 날짜가 있음 / 이 계정은 공연 후기만 올림"
                        className="mt-2 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[14px] text-ink" />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={busy || !draft.trim()} onClick={add} className="h-9 rounded-full bg-ink px-4 text-[13.5px] font-bold text-paper disabled:opacity-50">코멘트 남기기</button>
                        <span className="text-[12.5px] text-ink-soft" role="status">{msg}</span>
                    </div>
                </section>

                <section className="mt-4" aria-label="수집한 글">
                    <p className={label}>수집한 글</p>
                    {body
                        ? <p className="mt-1 max-h-[320px] overflow-y-auto rounded-[10px] bg-soft px-3 py-2 text-[13.5px] leading-relaxed text-ink" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</p>
                        : <p className="mt-1 text-[13px] text-ink-soft">수집한 본문이 없습니다. 원문을 열어 확인해 주세요.</p>}
                </section>
            </div>
        </div>
    );
}
