"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import {
    AFTER_SUBMIT, CONSENT_ITEMS, CONSENT_KEYS, CONSENT_PRIVACY, CONSENT_SUMMARY, CONTACT_EMAIL, EMPTY_AGREEMENT, EXTRAS, IS_DRAFT, PRIVACY_NOTICE, STATUS_LABEL,
    TERMS_SECTIONS, TERMS_VERSION, checkAgreement, toRow, type AgreementInput,
} from "@/lib/partnerAgreement";
import { loginHref } from "@/lib/reports";
import { InAppNotice } from "@/components/ui/InAppNotice";

// 정보 제공 협약(동의) 받기 (specs/016). /partners 맨 끝 #join 에 들어간다.
// 로그인한 사람만 보낸다 (specs/023, 운영자 2026-11-27 «카톡은 채널구독, 피카에서는 로그인»). 인스타 앱 안 브라우저에서는
// 구글 로그인이 막히므로 그때는 «외부 브라우저로 열기» 안내(InAppNotice)를 먼저 보인다.
// 보내기는 DB 함수 submit_partner_agreement() 로만(회원 하루 3건·같은 연락처 하루 1번). 운영자가 확인해야 협약으로 표시된다.
// 필수 동의 체크는 «전체 동의» 하나다(네 항목은 그 아래 목록, 개인정보는 따로 구분).
type Mine = { id: string; org_name: string; status: string; created_at: string; withdraw_requested_at: string | null };

function day(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const field = "w-full border-[1.5px] border-line bg-[var(--pk-card)] px-3 py-3 text-[16px] text-ink";
const label = "mb-1.5 block text-[15px] font-bold text-ink";
const check = "mt-0.5 h-6 w-6 shrink-0 accent-[var(--pk-accent)]";

export function AgreementForm() {
    const [form, setForm] = useState<AgreementInput>(EMPTY_AGREEMENT);
    const [errors, setErrors] = useState<string[]>([]);
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);   // undefined = 확인 중
    const [mine, setMine] = useState<Mine[]>([]);
    const [trap, setTrap] = useState("");  // 사람 눈에는 안 보이는 칸. 채워져 있으면 자동 프로그램으로 보고 보내지 않는다

    const loadMine = useCallback(async () => {
        const { data } = await supabase.from("partner_agreements")
            .select("id, org_name, status, created_at, withdraw_requested_at")
            .order("created_at", { ascending: false }).limit(20);
        setMine((data || []) as Mine[]);
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setLoggedIn(!!session?.user);
            if (session?.user) loadMine();
        });
    }, [loadMine]);

    // 값은 이벤트 처리 중에 먼저 읽는다(나중에 도는 상태 갱신 함수 안에서는 currentTarget 이 비어 있다)
    const setText = (k: keyof AgreementInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.currentTarget.value;
        setForm(f => ({ ...f, [k]: value }));
    };
    const setCheck = (k: keyof AgreementInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.currentTarget.checked;
        setForm(f => ({ ...f, [k]: checked }));
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (trap) return;
        const errs = checkAgreement(form);
        setErrors(errs);
        if (errs.length) return;
        setState("sending");
        const { error } = await supabase.rpc("submit_partner_agreement", { p: toRow(form) });
        if (error) {
            setState("idle");
            setErrors([
                error.message.includes("login_required") ? "로그인이 풀렸어요. 화면을 새로 고쳐 다시 로그인한 뒤 보내 주세요."
                    : error.message.includes("daily_limit") ? "오늘 신청이 많아 더 받을 수 없어요. 내일 다시 보내 주시거나 메일로 알려 주세요."
                    : error.message.includes("duplicate") ? "같은 이름·연락처로 오늘 이미 받았어요. 확인한 뒤 연락드릴게요."
                        : `보내지 못했어요. 잠시 뒤 다시 해 주시거나 메일(${CONTACT_EMAIL})로 알려 주세요.`,
            ]);
            return;
        }
        setState("sent");
        setForm(EMPTY_AGREEMENT);
        loadMine();
    };

    const withdraw = async (m: Mine) => {
        if (!window.confirm(`«${m.org_name}» 협약 철회를 요청할까요? 피카가 7일 안에 단체 정보를 내리고 협약 표시를 지워요.`)) return;
        const { data, error } = await supabase.rpc("request_partner_withdrawal", { p_id: m.id });
        if (error || !data) { window.alert(`요청하지 못했어요. 메일(${CONTACT_EMAIL})로 알려 주세요.`); return; }
        loadMine();
    };

    const myList = mine.length > 0 && (
        <div className="mt-8">
            <h3 className="text-[17px] font-bold text-ink">내가 보낸 신청</h3>
            <ul className="mt-2 flex flex-col gap-2">
                {mine.map(m => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-[1.5px] border-line bg-[var(--pk-card)] px-4 py-3 text-[15px] text-ink">
                        <span><b>{m.org_name}</b> · {day(m.created_at)} · {STATUS_LABEL[m.status] || m.status}
                            {m.withdraw_requested_at && m.status !== "withdrawn" && " · 철회 요청함"}</span>
                        {(m.status === "new" || m.status === "confirmed") && !m.withdraw_requested_at && (
                            <button type="button" onClick={() => withdraw(m)} className="min-h-11 text-[14px] underline underline-offset-4">철회 요청</button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );

    if (loggedIn === undefined) return null;
    if (!loggedIn) {
        return (
            <div className="border-[1.5px] border-line bg-[var(--pk-card)] p-5 text-[15px] leading-relaxed text-ink">
                <p>협약 신청은 로그인한 뒤 보낼 수 있어요. 로그인하면 이 화면으로 돌아와요.</p>
                <InAppNotice className="mt-3" />
                <Link href={loginHref("/partners#join")} className="mt-4 flex h-14 items-center justify-center bg-[var(--pk-accent)] px-5 text-[17px] font-bold text-[var(--pk-on-accent)] no-underline">로그인하고 신청하기</Link>
            </div>
        );
    }

    if (state === "sent") {
        return (
            <div>
                <div className="border-2 border-[var(--pk-accent)] bg-[var(--pk-card)] p-5 text-[15px] leading-relaxed text-ink">
                    <p className="text-[18px] font-bold">받았어요. 고맙습니다.</p>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5">
                        {AFTER_SUBMIT.map(t => <li key={t}>{t}</li>)}
                    </ol>
                    <p className="mt-3 text-[14px] text-ink-soft">메일: <span className="select-all font-mono">{CONTACT_EMAIL}</span></p>
                    <button type="button" onClick={() => setState("idle")} className="mt-4 min-h-11 underline underline-offset-4">다른 단체로 하나 더 보내기</button>
                </div>
                {myList}
            </div>
        );
    }

    const allAgreed = CONSENT_KEYS.every(k => form[k]);
    const setAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.currentTarget.checked;
        setForm(f => ({ ...f, agree_listing: v, agree_collect: v, agree_confirm: v, agree_privacy: v }));
    };

    return (
        <div>
            <form onSubmit={send} className="flex flex-col gap-6" noValidate>
                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-3 text-[18px] font-bold text-ink">① 무엇에 동의하나요</legend>
                    <div className="border-[1.5px] border-line bg-[var(--pk-card)] p-4">
                        <label className="flex cursor-pointer gap-3">
                            <input type="checkbox" className={check} checked={allAgreed} onChange={setAll} />
                            <span className="text-[16px] font-bold leading-relaxed text-ink">아래 내용에 모두 동의해요 *</span>
                        </label>
                        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-[14.5px] leading-relaxed text-ink">
                            {CONSENT_ITEMS.map(it => <li key={it.title}><b>{it.title}</b> — {it.text}</li>)}
                        </ul>
                        <div className="mt-3 border-l-4 border-[var(--pk-accent)] bg-[var(--pk-accent-soft)] px-3 py-2.5 text-[14.5px] leading-relaxed text-ink">
                            <b>{CONSENT_PRIVACY.title}</b> — {CONSENT_PRIVACY.text}
                            <span className="mt-1 block text-[13px] text-ink-soft">{PRIVACY_NOTICE} <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link></span>
                        </div>
                        <details className="mt-3 text-[14px] leading-relaxed text-ink">
                            <summary className="min-h-8 cursor-pointer text-[15px] font-bold">동의서 전문 보기{IS_DRAFT ? " (초안)" : ""}</summary>
                            {IS_DRAFT && <p className="mt-2 text-ink-soft">법률 검토 전 초안이에요({TERMS_VERSION}). 문구가 바뀌면 신청한 단체에 먼저 알려 드려요.</p>}
                            {TERMS_SECTIONS.map(s => (
                                <section key={s.title} className="mt-3">
                                    <h4 className="font-bold">{s.title}</h4>
                                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                                        {s.items.map((it, i) => <li key={i}>{it.strong && <b>{it.strong}</b>}{it.strong && it.text ? " " : ""}{it.text}</li>)}
                                    </ol>
                                </section>
                            ))}
                        </details>
                    </div>
                    <div className="border-[1.5px] border-line bg-[var(--pk-card)] p-4 text-[15px] leading-relaxed text-ink">
                        <b className="block text-[16px]">{CONSENT_SUMMARY.image.title} *</b>{CONSENT_SUMMARY.image.text}
                        <div className="mt-3 flex flex-col gap-2">
                            <label className="flex min-h-11 items-center gap-3"><input type="radio" name="pa-image" className="h-6 w-6 accent-[var(--pk-accent)]" checked={form.image_use === "yes"} onChange={() => setForm(f => ({ ...f, image_use: "yes" }))} />포스터·사진도 써도 돼요</label>
                            <label className="flex min-h-11 items-center gap-3"><input type="radio" name="pa-image" className="h-6 w-6 accent-[var(--pk-accent)]" checked={form.image_use === "no"} onChange={() => setForm(f => ({ ...f, image_use: "no" }))} />글 정보만 실어 주세요</label>
                        </div>
                    </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4">
                    <legend className="mb-3 text-[18px] font-bold text-ink">② 누구인가요</legend>
                    <div>
                        <label htmlFor="pa-org" className={label}>단체·활동 이름 *</label>
                        <input id="pa-org" value={form.org_name} onChange={setText("org_name")} maxLength={120} className={field} placeholder="극단 이름, 갤러리 이름, 활동명" autoComplete="organization" />
                    </div>
                    <div>
                        <label htmlFor="pa-url" className={label}>공식 SNS·누리집 주소 *</label>
                        <input id="pa-url" type="url" inputMode="url" value={form.official_url} onChange={setText("official_url")} maxLength={500} className={field} placeholder="https://instagram.com/계정" />
                    </div>
                    <div>
                        <label htmlFor="pa-contact" className={label}>담당 연락처 * <span className="font-normal text-ink-soft">공개하지 않아요</span></label>
                        <input id="pa-contact" value={form.contact_private} onChange={setText("contact_private")} maxLength={200} className={field} placeholder="전화 또는 메일" autoComplete="email" />
                    </div>
                    <details className="border-[1.5px] border-line bg-[var(--pk-card)] px-4 py-3">
                        <summary className="min-h-8 cursor-pointer text-[15px] font-bold text-ink">더 적기 (선택)</summary>
                        <div className="mt-3 flex flex-col gap-4">
                            <div>
                                <label htmlFor="pa-insta" className={label}>인스타그램 계정</label>
                                <input id="pa-insta" value={form.insta_handle} onChange={setText("insta_handle")} maxLength={80} className={field} placeholder="@계정 (위 주소가 인스타면 안 적어도 돼요)" />
                            </div>
                            <div>
                                <label htmlFor="pa-region" className={label}>주로 활동하는 곳</label>
                                <select id="pa-region" value={form.region} onChange={setText("region")} className={field}>
                                    <option value="">고르기</option>
                                    {GN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="pa-rep" className={label}>대표자</label>
                                <input id="pa-rep" value={form.representative} onChange={setText("representative")} maxLength={60} className={field} />
                            </div>
                            <div>
                                <label htmlFor="pa-reg" className={label}>고유번호·사업자등록번호</label>
                                <input id="pa-reg" value={form.reg_no} onChange={setText("reg_no")} maxLength={30} className={field} inputMode="numeric" />
                            </div>
                            <div>
                                <label htmlFor="pa-public" className={label}>공개해도 되는 문의 연락처</label>
                                <input id="pa-public" value={form.contact_public} onChange={setText("contact_public")} maxLength={200} className={field} placeholder="예매 문의 전화 등" />
                            </div>
                            {EXTRAS.map(x => (
                                <label key={x.key} className="flex gap-3 text-[15px] text-ink"><input type="checkbox" className={check} checked={form[x.key]} onChange={setCheck(x.key)} /><span>{x.label}</span></label>
                            ))}
                            {form.grant_alerts && (
                                <div>
                                    <label htmlFor="pa-grant" className={label}>지원사업 알림용: 지역·장르·단체 형태·활동 연수</label>
                                    <textarea id="pa-grant" value={form.grant_profile} onChange={setText("grant_profile")} maxLength={500} rows={2} className={field} placeholder="예) 김해 · 연극 · 비영리 민간단체 · 7년" />
                                </div>
                            )}
                        </div>
                    </details>
                    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                        <label htmlFor="pa-website">비워 두세요</label>
                        <input id="pa-website" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.currentTarget.value)} />
                    </div>
                </fieldset>

                {errors.length > 0 && (
                    <ul className="list-disc border-l-4 border-[var(--pk-accent)] py-1 pl-8 text-[15px] text-ink" role="alert">
                        {errors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                )}
                <button type="submit" disabled={state === "sending"} className="h-14 w-full bg-[var(--pk-accent)] px-5 text-[17px] font-bold text-[var(--pk-on-accent)] disabled:opacity-50">
                    {state === "sending" ? "보내는 중…" : "동의하고 보내기"}
                </button>
                <p className="text-[14px] leading-relaxed text-ink-soft">
                    보내면 운영자가 확인한 뒤 일주일 안에 연락드려요. 아래 «내가 보낸 신청»에서 진행 상황을 볼 수 있어요.
                </p>
            </form>
            {myList}
        </div>
    );
}
