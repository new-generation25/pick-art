"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import {
    checkTip, couponOpen, loginHref, normalizeTipUrl, tipErrorText, COUPON_DETAIL, EMPTY_TIP, KAKAO_CHAT, POINTS_NOTE, REWARD_CONSENT_TEXT, REWARD_CONSENT_VERSION,
    TIP_PHOTO_MAX, TIP_POINTS, type TipInput,
} from "@/lib/reports";
import { todayKST } from "@/lib/utils";
import { shrink } from "./leaflet/LeafletForm";

// 행사 제보 「숨은 행사 찾기」 (specs/020 → 021). 로그인 회원이 보낸다. 꼭 받는 것은 행사 이름 + 원문 링크나 사진 하나.
// 접수는 submit_tip() 으로만 하고, 사진은 그 함수가 돌려준 경로(tips/<id>.jpg)에 한 번 올린다. 공개는 관리자가 확인한 뒤(헌장 I)
// 피카에 실리면(관리자 «반영함») 보낸 회원에게 100포인트가 쌓인다 — DB 트리거가 한다
type Mine = { id: string; status: "new" | "done" | "rejected"; created_at: string; event_id: string | null; tip: { title?: string } | null };
const MINE_STATUS = { new: "확인 중", done: `피카에 실림 · +${TIP_POINTS}P`, rejected: "반영하지 않음" } as const;
type TextKey = "title" | "url" | "date_start" | "date_end" | "venue" | "region" | "body" | "contact" | "credit" | "website";
type Sent = { photoFailed: boolean; withContact: boolean };

export function TipForm() {
    const [form, setForm] = useState<TipInput>(EMPTY_TIP);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState<Sent | null>(null);
    const [userId, setUserId] = useState<string | null | undefined>(undefined);   // undefined = 확인 중
    const [mine, setMine] = useState<Mine[]>([]);
    const coupon = couponOpen(todayKST());

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
    }, []);
    const loadMine = useCallback(async (uid: string) => {
        const { data } = await supabase.from("reports").select("id,status,created_at,event_id,tip")
            .eq("kind", "tip").eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
        setMine((data || []) as Mine[]);
    }, []);
    useEffect(() => { if (userId) loadMine(userId); }, [userId, loadMine]);

    // 값은 이벤트 처리 중에 먼저 읽는다(나중에 도는 상태 갱신 함수 안에서는 currentTarget 이 비어 있다)
    const set = (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.currentTarget.value;
        setForm(f => ({ ...f, [k]: value }));
    };

    const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.currentTarget.files?.[0] ?? null;
        setFile(f);
        setPreview(p => { if (p) URL.revokeObjectURL(p); return f ? URL.createObjectURL(f) : null; });
    };

    const reset = () => {
        setForm(EMPTY_TIP);
        setFile(null);
        setPreview(p => { if (p) URL.revokeObjectURL(p); return null; });
        setErrors([]);
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = checkTip(form, !!file);
        setErrors(errs);
        if (errs.length) return;
        // 보이지 않는 칸이 차 있으면 자동 프로그램이다: 보내지 않고 끝낸다
        if (form.website.trim()) { setSent({ photoFailed: false, withContact: false }); reset(); return; }
        setSending(true);
        let blob: Blob | null = null;
        if (file) {
            try { blob = await shrink(file); } catch {
                setSending(false);
                setErrors(["이 사진을 열지 못했어요. jpg·png 파일로 바꿔 올리거나 링크를 넣어 주세요(아이폰 HEIC는 «호환성 우선»으로 저장)."]);
                return;
            }
            if (blob.size > TIP_PHOTO_MAX) {
                setSending(false);
                setErrors(["줄여도 10MB가 넘어요. 더 작은 사진으로 올려 주세요."]);
                return;
            }
        }
        const contact = coupon ? form.contact.trim() : "";
        const { data, error } = await supabase.rpc("submit_tip", {
            p: {
                title: form.title.trim(), url: normalizeTipUrl(form.url), has_photo: blob ? "true" : "false",
                date_start: form.date_start, date_end: form.date_end, venue: form.venue.trim(), region: form.region,
                body: form.body.trim(), credit_name: form.credit.trim(),
                reward_contact: contact, reward_consent: contact && form.consent ? REWARD_CONSENT_VERSION : "",
                website: form.website,
            },
        });
        if (error) {
            setSending(false);
            setErrors([tipErrorText(error.message)]);
            return;
        }
        const res = (data || {}) as { id?: string | null; photo_path?: string | null };
        let photoFailed = false;
        if (blob && res.id && res.photo_path) {
            const up = await supabase.storage.from("leaflets").upload(res.photo_path, blob, { contentType: "image/jpeg", upsert: false });
            if (up.error) {
                photoFailed = true;
                await supabase.rpc("tip_photo_failed", { p_id: res.id });
            }
        }
        setSending(false);
        setSent({ photoFailed, withContact: !!contact });
        reset();
        if (userId) loadMine(userId);
    };

    const mineList = mine.length > 0 && (
        <section className="mt-8">
            <h2 className="pica-display text-[20px] text-ink">내가 보낸 제보</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
                {mine.map(m => (
                    <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 text-[14px]">
                        <span className="min-w-0 font-semibold text-ink" style={{ overflowWrap: "anywhere" }}>
                            {m.tip?.title || "제보"}
                            <span className="ml-2 font-normal text-ink-soft">{new Date(m.created_at).toLocaleDateString("ko-KR")}</span>
                        </span>
                        {m.status === "done" && m.event_id
                            ? <Link href={`/events/${m.event_id}`} className="font-bold text-accent underline underline-offset-4">{MINE_STATUS.done} →</Link>
                            : <span className={m.status === "done" ? "font-bold text-accent" : "text-ink-soft"}>{MINE_STATUS[m.status]}</span>}
                    </li>
                ))}
            </ul>
        </section>
    );

    if (userId === undefined) return null;
    if (userId === null) {
        return (
            <div className="rounded-[14px] bg-card p-5 text-[15px] shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                <p className="leading-relaxed text-ink">제보는 로그인한 뒤 보낼 수 있어요. 로그인하면 이 화면으로 돌아와요.</p>
                <Link href={loginHref("/tip")} className="mt-4 flex h-14 items-center justify-center rounded-full bg-accent px-6 text-[17px] font-bold text-on-accent no-underline">로그인하고 제보하기</Link>
            </div>
        );
    }

    if (sent) {
        return (
            <div className="rounded-[14px] bg-card p-5 text-[15px] shadow-[0_1px_4px_rgba(30,26,21,.08)]" role="status">
                <p className="pica-display text-[22px] text-ink">고맙습니다. 제보를 받았어요.</p>
                <p className="mt-2 leading-relaxed text-ink-soft">원문을 확인한 뒤 피카에 올려요. 확인이 안 되면 올리지 않을 수 있어요.</p>
                <p className="mt-1 leading-relaxed text-ink">피카에 실리면 <b>{TIP_POINTS}포인트</b>가 쌓여요. <Link href="/me#points" className="underline underline-offset-2">내 정보</Link>에서 볼 수 있어요.</p>
                {sent.withContact && <p className="mt-1 leading-relaxed text-ink-soft">커피 쿠폰은 매주 5명께, 적어 주신 연락처로 보내요. 당첨은 인스타그램과 카카오톡 채널 «피카»에서 알려요.</p>}
                {sent.photoFailed && <p className="mt-2 font-semibold leading-relaxed text-ink">사진은 올라가지 않았어요. 링크를 알면 한 번 더 보내 주세요.</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSent(null)} className="h-12 rounded-full bg-accent px-5 text-[15px] font-bold text-on-accent">하나 더 제보하기</button>
                    <Link href="/" className="flex h-12 items-center rounded-full border border-line bg-paper px-5 text-[15px] font-semibold text-ink no-underline">피카 둘러보기</Link>
                </div>
                {mineList}
            </div>
        );
    }

    const field = "w-full rounded-[10px] border border-line bg-card px-3 py-3 text-[16px] text-ink";
    const label = "mb-1.5 block text-[15px] font-bold text-ink";
    const hint = "mt-1 text-[13px] leading-relaxed text-ink-soft";
    const fold = "rounded-[12px] border border-line bg-card px-4 py-3";
    const foldTitle = "cursor-pointer text-[15px] font-bold text-ink";
    return (
        <>
        <form onSubmit={send} className="flex flex-col gap-5" noValidate>
            <div>
                <label htmlFor="tip-title" className={label}>행사 이름</label>
                <input id="tip-title" value={form.title} onChange={set("title")} maxLength={120} className={field} placeholder="예) 골목 버스킹 〈겨울밤 어쿠스틱〉" />
            </div>

            <fieldset className="flex flex-col gap-4">
                <legend className={label}>원문 링크나 사진 <span className="font-normal text-ink-soft">(둘 중 하나는 꼭)</span></legend>
                {/* 이름표가 안 보이면 빈 상자가 링크 칸인지 알 수 없다 — «링크 입력란이 없는데 링크가 없다고 한다»(운영자 2026-11-28) */}
                <div>
                    <label htmlFor="tip-url" className="mb-1 block text-[13px] font-semibold text-ink-soft">링크 붙여 넣기</label>
                    <input id="tip-url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={form.url} onChange={set("url")} maxLength={500} className={field} placeholder="https://… 인스타그램 게시물·예매 페이지 주소" />
                </div>
                <div>
                    <p className="mb-1 text-[13px] font-semibold text-ink-soft">또는 사진 올리기</p>
                    <input id="tip-photo" type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={pick} className="peer sr-only" />
                    <label htmlFor="tip-photo" className="flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-dashed border-ink-soft bg-card px-4 text-[15px] font-semibold text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--pk-accent)]">
                        {file ? "다른 사진으로 바꾸기" : "포스터·현수막 사진 한 장 올리기"}
                    </label>
                    {preview && <img src={preview} alt="올릴 사진 미리보기" className="mt-2 max-h-64 w-auto rounded-[8px] border border-line" />}
                    <p className={hint}>사진은 운영자만 봐요. 날짜와 장소를 확인하는 데 써요.</p>
                </div>
            </fieldset>

            <details className={fold}>
                <summary className={foldTitle}>더 알려 주기 <span className="font-normal text-ink-soft">(선택 — 날짜·장소)</span></summary>
                <div className="mt-3 flex flex-col gap-3">
                    {/* 날짜 칸은 휴대폰에서 한 줄에 하나씩: 두 칸을 나란히 두면 폭 150px 에 날짜 글자와 달력 그림이 겹친다(운영자 2026-11-28).
                        아이폰은 빈 날짜 칸이 납작해지거나 칸 밖으로 넘치므로 block·최소 높이·max-w-full 을 준다 */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                            <label htmlFor="tip-start" className="mb-1 block text-[13px] font-semibold text-ink-soft">시작 날짜</label>
                            <input id="tip-start" type="date" value={form.date_start} onChange={set("date_start")} className={`${field} block min-h-[51px] min-w-0 max-w-full`} />
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="tip-end" className="mb-1 block text-[13px] font-semibold text-ink-soft">끝나는 날짜</label>
                            <input id="tip-end" type="date" value={form.date_end} onChange={set("date_end")} className={`${field} block min-h-[51px] min-w-0 max-w-full`} />
                        </div>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                        <div>
                            <label htmlFor="tip-venue" className="mb-1 block text-[13px] font-semibold text-ink-soft">장소</label>
                            <input id="tip-venue" value={form.venue} onChange={set("venue")} maxLength={120} className={field} placeholder="예) 봉황동 ○○카페 2층" />
                        </div>
                        <div>
                            <label htmlFor="tip-region" className="mb-1 block text-[13px] font-semibold text-ink-soft">지역</label>
                            <select id="tip-region" value={form.region} onChange={set("region")} className={field}>
                                <option value="">고르기</option>
                                {GN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="tip-body" className="mb-1 block text-[13px] font-semibold text-ink-soft">덧붙일 말</label>
                        <textarea id="tip-body" value={form.body} onChange={set("body")} maxLength={2000} rows={3} className={field} placeholder="시간, 관람료, 아이와 갈 만한지 등" />
                    </div>
                </div>
            </details>

            {/* 선택 항목 하나로 (specs/023): 쿠폰 연락처(12월까지) + 이름 남기기 */}
            <details className={fold}>
                <summary className={foldTitle}>선택 항목 <span className="font-normal text-ink-soft">({coupon ? "커피 쿠폰 연락처 · 이름 남기기" : "이름 남기기"})</span></summary>
                <div className="mt-3 flex flex-col gap-4">
                    {coupon && (
                        <div className="flex flex-col gap-3">
                            <div>
                                <label htmlFor="tip-contact" className="mb-1 block text-[13px] font-semibold text-ink-soft">커피 쿠폰을 받을 전화번호나 이메일</label>
                                <input id="tip-contact" value={form.contact} onChange={set("contact")} maxLength={100} autoComplete="off" className={field} placeholder="쿠폰을 받을 곳" />
                                <p className={hint}>{COUPON_DETAIL} 연락처는 운영자만 봐요. 적지 않아도 제보는 똑같이 받고 포인트도 똑같이 쌓여요.</p>
                            </div>
                            <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-relaxed text-ink">
                                <input type="checkbox" checked={form.consent} className="mt-1 h-4 w-4 flex-none"
                                    onChange={e => { const v = e.currentTarget.checked; setForm(f => ({ ...f, consent: v })); }} />
                                <span>{REWARD_CONSENT_TEXT} <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link></span>
                            </label>
                        </div>
                    )}
                    <div>
                        <label htmlFor="tip-credit" className="mb-1 block text-[13px] font-semibold text-ink-soft">행사 화면에 보일 이름이나 아이디</label>
                        <input id="tip-credit" value={form.credit} onChange={set("credit")} maxLength={30} autoComplete="off" className={field} placeholder="예) 봉황동 주민, @pica_fan" />
                        <p className={hint}>적으면 행사 화면에 「제보: ○○」로 보여요. 비우면 이름은 어디에도 나오지 않아요.</p>
                    </div>
                </div>
            </details>

            {/* 사람 눈에 안 보이는 칸(자동 프로그램 걸러내기). 화면 낭독기·탭 이동에서도 빠진다 */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="tip-website">이 칸은 비워 두세요</label>
                <input id="tip-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </div>

            {errors.length > 0 && (
                <ul className="list-disc rounded-[10px] bg-[var(--pk-accent-soft)] py-3 pl-8 pr-4 text-[14.5px] font-semibold leading-relaxed text-ink" role="alert">
                    {errors.map(e => <li key={e}>{e}</li>)}
                </ul>
            )}
            <button type="submit" disabled={sending} className="h-14 rounded-full bg-accent px-6 text-[17px] font-bold text-on-accent disabled:opacity-50">
                {sending ? "보내는 중…" : "제보 보내기"}
            </button>
            <p className="text-center text-[14px] leading-relaxed text-ink-soft">
                카카오톡이 편하면 채널 «피카»의 「행사 제보하기」로 사진·글을 보내도 돼요.{" "}
                <a href={KAKAO_CHAT} target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline underline-offset-4">카카오톡으로 보내기</a>
            </p>
            <p className="text-center text-[13px] leading-relaxed text-ink-soft">{POINTS_NOTE}</p>
        </form>
        {mineList}
        </>
    );
}
