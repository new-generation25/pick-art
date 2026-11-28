"use client";

// 대기함의 글 하나를 크게 보는 창 (specs/019 A7). 어느 탭에서든 줄을 누르면 열린다.
//   · 왜 대기함에 있는지(정기 실행이 붙인 분류 이유를 풀어서) · 수집한 글 전체 · 원문 열기
//   · 운영자 코멘트: raw_posts.content.admin_notes 에 쌓는다. raw_posts 는 관리자만 읽는 표다.
//     코멘트마다 그때의 갈래·분류 이유를 함께 적어, 나중에 분류 규칙을 손볼 때 근거로 읽는다
//     (모아 보기: collector/tools/review_notes.py).
// content 는 jsonb 라 통째로 바뀐다 → 쓰기 직전에 최신 값을 다시 읽어 admin_notes 만 고친다.
//   · 이 창 안에서도 처리한다(운영자 2026-11-28 «개별 카드에서도 반영, 반영안함 할수 있어야지»): 공개 승인 · 동의 필요로 옮기기 ·
//     반영 안 함 · 되돌리기. 쓰는 방식은 목록(ReviewQueue·CollectedQueue)과 같고, 결과는 페이지의 목록에 바로 반영된다.
//   · Mantine 창은 화면 맨 바깥에 그려져 종이 테마의 색 값(--pk-…)이 닿지 않는다. 그래서 버튼 바탕색이 빠져 글자만 보였다.
//     창 내용에 pica-portal 을 붙여 색 값을 준다.

import { useState } from "react";
import { Modal } from "@mantine/core";
import { Check, ExternalLink, MessageSquarePlus, RotateCcw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { InstagramIcon } from "@/components/ui/InstagramLink";
import { BUCKET_LABEL, reasonText, type ReviewBucket, type ReviewChange, type ReviewContent, type ReviewPost } from "./ReviewQueue";
import { reasonOf, type CollectedPost } from "./CollectedQueue";
import { notesOf, type AdminNote } from "./notes";
import { IgHandle, withIgLinks } from "./igLinks";

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
        const detail = reason.startsWith("admin_moved") ? (b === "consent" ? "운영자가 사람 판단에서 동의 필요로 옮겼습니다." : "운영자가 직접 공개 후보로 옮겼습니다.") : REASON_DETAIL[reason] || (reason ? reasonText(reason) : "");
        if (b === "candidate") return { head: "공개 후보", lines: [detail, "운영자가 승인하면 다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개합니다. 승인 전에는 공개되지 않습니다."].filter(Boolean) };
        if (b === "consent") return { head: "동의 필요", lines: [detail, "소개 허락(댓글·DM)을 받았으면 «공개 승인»을 누릅니다. 계정을 «상시 동의»로 바꿔 두면 날짜가 있는 글은 다음 정기 실행이 공개 후보로 옮깁니다."].filter(Boolean) };
        if (b === "human") return { head: "사람 판단", lines: [detail, "원문을 열어 보고 공개할 만하면 «공개 승인», 작가·단체 글이라 허락이 필요하면 «동의 필요로 옮기기», 아니면 «반영 안 함»을 누릅니다. 날짜가 없는 글은 시작일·끝나는 날을 넣어야 승인됩니다."].filter(Boolean) };
        return { head: "아직 나누기 전", lines: ["다음 정기 실행이 공개 후보·동의 필요·사람 판단 가운데 하나로 나눕니다."] };
    }
    if (p.status === "COLLECTED" || p.status === "PENDING") {
        const r = reasonOf(p as unknown as CollectedPost, today);
        if (r === "nodate") return { head: "자동 공개 대기 — 날짜 없음", lines: ["시작일·끝나는 날을 읽지 못해 자동 공개 검증에서 빠졌습니다.", "원문에서 날짜를 확인해 적으면 다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개합니다."] };
        if (r === "later") return { head: "자동 공개 대기 — 60일 뒤 행사", lines: ["시작일이 오늘부터 60일보다 뒤입니다. 때가 되면 정기 실행이 자동으로 공개합니다. 할 일이 없습니다."] };
        if (r === "ended") return { head: "이미 끝난 행사", lines: ["다음 정기 실행이 «만료»로 정리합니다."] };
        return { head: "자동 공개 대기 — 검증에서 멈춤", lines: ["날짜는 공개 범위 안인데 공개되지 않았습니다. 원문 링크가 열리지 않거나 극장 영화로 걸러진 경우입니다.", "다음 정기 실행이 다시 확인합니다. 원문이 열리는지 봐 주세요."] };
    }
    if (p.status === "REJECTED") return { head: "반영 안 함", lines: [c.rejected_reason ? `이유: ${String(c.rejected_reason)}` : "운영자가 반영하지 않기로 한 글입니다.", "같은 글이 다시 수집되지 않도록 지우지 않고 남겨 둡니다. 되돌리면 판단 대기로 돌아갑니다."] };
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
    /** 인스타 후보(REVIEW)를 승인·옮김·반영 안 함 한 뒤 */
    onReview: (changes: ReviewChange[]) => void;
    /** 자동 공개 대기(COLLECTED·PENDING)를 반영 안 함 한 뒤 */
    onCollected: (id: string, next: null) => void;
    /** 반영 안 한 것을 되돌린다 */
    onRestore: (post: ReviewPost) => Promise<void>;
}

export function PostDetailModal({ post, actor, onClose, ...handlers }: Props) {
    return (
        <Modal opened={!!post} onClose={onClose} size="xl" centered title={<span className="text-[13px] font-semibold text-ink-soft">판단 대기 글 자세히 보기</span>}
            classNames={{ content: "pica-portal" }} styles={{ body: { paddingTop: 0 } }}>
            {post && <Detail key={post.id} post={post} actor={actor} {...handlers} />}
        </Modal>
    );
}

type Handlers = Pick<Props, "onSaved" | "onReview" | "onCollected" | "onRestore">;

function Detail({ post, actor, onSaved, onReview, onCollected, onRestore }: { post: ReviewPost; actor: string } & Handlers) {
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

    // ── 이 창에서 처리하기. 목록과 같은 방식: 최신 값을 다시 읽고, 그사이 상태가 바뀌었으면 쓰지 않는다
    const [actMsg, setActMsg] = useState("");
    const bucket = c.review_bucket as ReviewBucket | undefined;
    const approved = !!c.publish_approved_at;
    // 사람 판단 글은 이 창에서 바로 공개 승인한다(운영자 2026-11-28). 날짜가 없으면 원문을 보고 넣어야 승인된다
    const DAY = /^20\d\d-\d\d-\d\d$/;
    const needDates = (bucket === "human" || bucket === "consent") &&!(DAY.test(a.date_start || "") && DAY.test(a.date_end || ""));
    const [typed, setTyped] = useState({ start: "", end: "" });
    const typedOk = DAY.test(typed.start) && DAY.test(typed.end) && typed.start <= typed.end;
    const reviewAct = async (kind: "approve" | "consent" | "reject") => {
        const title = c.title || "제목 없음";
        const ask = kind === "approve" ? `${bucket === "consent" ? "작가·단체 계정 글입니다. 이 글을 소개해도 된다는 허락(댓글·DM)을 받았나요?\n\n" : ""}«${title}»을(를) 공개 승인할까요?${needDates ? `\n\n넣은 날짜: ${typed.start} ~ ${typed.end}` : ""}\n\n다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개합니다.`
            : kind === "consent" ? `«${title}»을(를) «동의 필요»로 옮길까요?\n\n작가·단체 계정 글이라 소개 허락을 받은 뒤 공개할 글이면 옮깁니다(아직 공개하지 않습니다).`
                : `«${title}»을(를) 반영하지 않을까요?\n\n«반영 안 한 것»으로 갑니다. 거기서 되돌릴 수 있습니다.`;
        if (!window.confirm(ask)) return;
        setBusy(true); setActMsg("");
        const { data: cur, error: readErr } = await supabase.from("raw_posts").select("status,content").eq("id", post.id).maybeSingle();
        if (readErr || !cur || cur.status !== "REVIEW") { setBusy(false); setActMsg(`처리하지 못했습니다: ${readErr?.message || "이미 처리된 글입니다. 창을 닫고 다시 읽어 주세요"}`); return; }
        const now = new Date().toISOString();
        const next: ReviewContent = { ...((cur.content || {}) as ReviewContent) };
        let status = "REVIEW";
        if (kind === "approve") {
            next.publish_approved_at = now; next.publish_approved_by = actor || undefined;
            // 사람 판단에서 날짜를 넣어 승인한 경우: 공개 단계가 읽는 자리에 쓴다
            if (needDates) {
                next.ai_suggestion = { ...(next.ai_suggestion || {}), date_start: typed.start, date_end: typed.end };
                next.dates_set_by_admin = { at: now, by: actor || undefined, start: typed.start, end: typed.end };
            }
            // 동의 필요에서 바로 승인: 운영자가 이 글의 허락을 확인했다는 기록
            if (bucket === "consent") next.consent_confirmed_by_admin = { at: now, by: actor || undefined };
        }
        else if (kind === "consent") {
            next.review_bucket = "consent"; next.review_bucket_at = now;
            next.review_reason = `admin_moved_from_${bucket || "human"}`; next.review_moved_by = actor || undefined;
        } else {
            // 승인 표시는 지운다: 되돌렸을 때 다시 승인하지 않은 채 공개되지 않게
            delete next.publish_approved_at; delete next.publish_failed_at; status = "REJECTED";
        }
        const { data, error } = await supabase.from("raw_posts").update(status === "REVIEW" ? { content: next } : { status, content: next })
            .eq("id", post.id).eq("status", "REVIEW").select("id");
        setBusy(false);
        if (error || !data?.length) { setActMsg(`처리하지 못했습니다: ${error?.message || "관리자 권한 또는 상태 변경을 확인해 주세요"}`); return; }
        onReview([{ id: post.id, status, content: next }]);
        setActMsg(kind === "approve" ? "공개 승인했습니다. 다음 정기 실행이 확인한 뒤 공개합니다." : kind === "consent" ? "동의 필요로 옮겼습니다." : "반영하지 않기로 했습니다.");
    };
    const collectedReject = async () => {
        if (!window.confirm(`«${c.title || "제목 없음"}»을(를) 반영하지 않을까요?\n\n«반영 안 한 것»으로 갑니다. 거기서 되돌릴 수 있습니다.`)) return;
        setBusy(true); setActMsg("");
        const { data, error } = await supabase.from("raw_posts").update({ status: "REJECTED" }).eq("id", post.id).in("status", ["COLLECTED", "PENDING"]).select("id");
        setBusy(false);
        if (error || !data?.length) { setActMsg(`처리하지 못했습니다: ${error?.message || "이미 처리된 글입니다"}`); return; }
        onCollected(post.id, null);
        setActMsg("반영하지 않기로 했습니다.");
    };
    const restore = async () => { setBusy(true); setActMsg(""); await onRestore(post); setBusy(false); setActMsg("판단 대기로 되돌렸습니다."); };

    const btn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[14.5px] font-bold no-underline disabled:opacity-50";
    const primary = `${btn} bg-accent text-on-accent`;
    const ghost = `${btn} bg-card text-ink shadow-[inset_0_0_0_1.5px_var(--pk-ink)]`;
    const actions = post.status === "REVIEW" ? (
        <>
            {(bucket === "candidate" || bucket === "human" || bucket === "consent") && !approved && <button type="button" disabled={busy || (needDates && !typedOk)}
                title={needDates && !typedOk ? "시작일·끝나는 날을 넣어야 승인할 수 있습니다" : undefined}
                onClick={() => reviewAct("approve")} className={primary}><Check size={16} aria-hidden />공개 승인</button>}
            {bucket === "human" && !approved && <button type="button" disabled={busy} onClick={() => reviewAct("consent")} className={ghost}>동의 필요로 옮기기</button>}
            <button type="button" disabled={busy} onClick={() => reviewAct("reject")} className={ghost}><X size={16} aria-hidden />반영 안 함</button>
        </>
    ) : post.status === "COLLECTED" || post.status === "PENDING" ? (
        <button type="button" disabled={busy} onClick={collectedReject} className={ghost}><X size={16} aria-hidden />반영 안 함</button>
    ) : post.status === "REJECTED" ? (
        <button type="button" disabled={busy} onClick={restore} className={primary}><RotateCcw size={16} aria-hidden />판단 대기로 되돌리기</button>
    ) : null;

    const label = "text-[12px] font-semibold text-ink-soft";
    return (
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div>
                {poster && imgOk
                    // eslint-disable-next-line @next/next/no-img-element -- 인스타·기관 누리집의 그림 주소를 그대로 보여 준다(관리자만 보는 창)
                    ? <img src={poster} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="max-h-[420px] w-full rounded-[12px] bg-soft object-contain" />
                    : <div className="flex h-[180px] items-center justify-center rounded-[12px] bg-soft px-4 text-center text-[13px] leading-[1.5] text-ink-soft">{poster ? "포스터를 불러오지 못했습니다. 원문에서 확인해 주세요." : "포스터 없음"}</div>}
                <a href={post.source_url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14.5px] font-bold text-white no-underline">
                    {isInsta ? <InstagramIcon size={18} /> : <ExternalLink size={16} aria-hidden />}
                    {isInsta ? "인스타그램에서 원문 열기" : "원문 페이지 열기"}
                </a>
                <p className="mt-2 break-all text-[11.5px] leading-[1.5] text-ink-soft">{post.source_url}</p>
                {isInsta && <p className="mt-1 text-[11.5px] leading-[1.5] text-ink-soft">정기 실행의 링크 확인은 인스타그램 글이 지워졌는지는 가려내지 못합니다. 승인 전에 원문이 열리는지 봐 주세요.</p>}
            </div>

            <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink-soft">
                    {post.source}{a.account ? <> · <IgHandle handle={a.account} /></> : ""}{a.author && a.author !== a.account ? ` · ${a.author}` : ""}{a.role ? ` · ${a.role}` : ""}
                </p>
                <h2 className="mt-0.5 text-[19px] font-bold leading-snug text-ink" style={{ wordBreak: "break-word" }}>{c.title || "제목 없음"}</h2>
                <p className="mt-1 text-[14px] text-ink">
                    {a.date_start || "시작일 없음"} ~ {a.date_end || "끝나는 날 없음"} · {[a.region, a.venue].filter(Boolean).join(" · ") || "장소 없음"}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-soft">수집 {fmt(post.collected_at)}{c.review_bucket_at ? ` · 나눈 때 ${fmt(String(c.review_bucket_at))}` : ""}</p>

                <section className="mt-3 rounded-[14px] bg-[var(--pk-accent-soft)] px-4 py-3" aria-label="대기 이유">
                    <p className={label}>왜 판단 대기에 있나</p>
                    <p className="text-[15px] font-bold text-ink">{why.head}</p>
                    {why.lines.map((l, i) => <p key={i} className="mt-1 text-[13.5px] leading-relaxed text-ink">{l}</p>)}
                    {c.review_reason && <p className="mt-1 text-[11.5px] text-ink-soft">분류 기록: {String(c.review_bucket ? BUCKET_LABEL[c.review_bucket as ReviewBucket] || c.review_bucket : post.status)} · {String(c.review_reason)}</p>}
                </section>

                {(actions || actMsg) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="이 글 처리하기">
                        {post.status === "REVIEW" && needDates && !approved && (
                            <div className="flex basis-full flex-wrap items-center gap-2 text-[13px] text-ink-soft">
                                <span className="font-semibold text-[#9a4b12]">날짜가 없습니다. 원문에서 확인해 넣으면 승인할 수 있습니다:</span>
                                <input type="date" className="pica-date" aria-label="시작일" value={typed.start}
                                    onChange={(e) => setTyped((t) => ({ ...t, start: e.target.value }))} />
                                <span>~</span>
                                <input type="date" className="pica-date" aria-label="끝나는 날" value={typed.end} min={typed.start || undefined}
                                    onChange={(e) => setTyped((t) => ({ ...t, end: e.target.value }))} />
                            </div>
                        )}
                        {actions}
                        {actMsg && <span className="basis-full text-[13px] font-semibold text-ink" role="status">{actMsg}</span>}
                    </div>
                )}

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
                    {/* Enter = 저장, Shift+Enter = 줄바꿈 (운영자 2026-11-28 «코맨트박스에서 엔터를 누르면 저장되도록»).
                        한글 입력 중(글자 조합 중) Enter 는 조합을 끝내는 키라 저장하지 않는다 */}
                    <textarea value={draft} onChange={e => setDraft(e.currentTarget.value)} maxLength={MAX_LEN} rows={3} aria-label="코멘트 쓰기 (Enter 저장, Shift+Enter 줄바꿈)"
                        onKeyDown={e => {
                            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
                            e.preventDefault();
                            if (!busy && draft.trim()) add();
                        }}
                        placeholder="예: 기관 계정인데 날짜를 못 읽음 — 포스터 그림에만 날짜가 있음 / 이 계정은 공연 후기만 올림 (Enter 저장 · Shift+Enter 줄바꿈)"
                        className="mt-2 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[14px] text-ink" />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={busy || !draft.trim()} onClick={add} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-card px-4 text-[14px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--pk-ink)] disabled:opacity-50"><MessageSquarePlus size={15} aria-hidden />코멘트 남기기</button>
                        <span className="text-[12.5px] text-ink-soft" role="status">{msg}</span>
                    </div>
                </section>

                <section className="mt-4" aria-label="수집한 글">
                    <p className={label}>수집한 글</p>
                    {body
                        ? <p className="mt-1 max-h-[320px] overflow-y-auto rounded-[10px] bg-soft px-3 py-2 text-[13.5px] leading-relaxed text-ink" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{withIgLinks(body)}</p>
                        : <p className="mt-1 text-[13px] text-ink-soft">수집한 본문이 없습니다. 원문을 열어 확인해 주세요.</p>}
                </section>
            </div>
        </div>
    );
}
