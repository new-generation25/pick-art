"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { loginHref } from "@/lib/reports";
import {
    checkLeaflet, givenFields, DAILY_LIMIT, IMAGE_KINDS, PRIVACY_NOTE, RIGHTS_CHECKS, RIGHTS_ONE, RIGHTS_VERSION_SITE, type LeafletInput,
} from "@/lib/leaflets";

const EMPTY: LeafletInput = { image_kind: "", group_name: "", official_url: "", title: "", date_text: "", venue: "", note: "", rights: [false] };

type Mine = { id: string; status: "uploaded" | "read" | "published" | "rejected"; created_at: string; group_name: string | null; given: Record<string, string>; event_id: string | null; ai_result: any };
const STATUS = { uploaded: "올림 — 글자 읽기 기다리는 중", read: "읽음 — 운영자 확인 중", published: "피카에 올라감", rejected: "반영하지 않음" } as const;

/** 이미지를 긴 변 2048px 안으로 줄여 JPEG로 다시 저장한다. 다시 그리면서 사진 위치(EXIF) 같은 정보가 빠진다 */
export async function shrink(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error("decode");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) throw new Error("encode");
    return blob;
}

export function LeafletForm() {
    const [userId, setUserId] = useState<string | null | undefined>(undefined);
    const [form, setForm] = useState<LeafletInput>(EMPTY);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const [mine, setMine] = useState<Mine[]>([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
    }, []);

    const loadMine = useCallback(async () => {
        const { data } = await supabase.from("leaflet_submissions")
            .select("id,status,created_at,group_name,given,event_id,ai_result").order("created_at", { ascending: false }).limit(20);
        setMine((data || []) as Mine[]);
    }, []);
    useEffect(() => { if (userId) loadMine(); }, [userId, loadMine]);

    const set = (k: "group_name" | "official_url" | "title" | "date_text" | "venue" | "note") =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const value = e.currentTarget.value; setForm(f => ({ ...f, [k]: value })); };

    const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.currentTarget.files?.[0] ?? null;
        setFile(f);
        setPreview(p => { if (p) URL.revokeObjectURL(p); return f ? URL.createObjectURL(f) : null; });
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = checkLeaflet(form, file);
        setErrors(errs);
        if (errs.length || !file || !userId) return;
        setState("sending");
        try {
            const { data: today } = await supabase.rpc("my_leaflets_today");
            if (typeof today === "number" && today >= DAILY_LIMIT) throw new Error(`limit`);
            let blob: Blob;
            try { blob = await shrink(file); } catch { throw new Error("decode"); }
            if (blob.size > 10 * 1024 * 1024) throw new Error("big");
            const id = crypto.randomUUID();
            const path = `${userId}/${id}.jpg`;
            const up = await supabase.storage.from("leaflets").upload(path, blob, { contentType: "image/jpeg", upsert: false });
            if (up.error) throw new Error("upload");
            const { error } = await supabase.from("leaflet_submissions").insert({
                id, image_path: path, image_kind: form.image_kind, group_name: form.group_name.trim(),
                official_url: form.official_url.trim() || null, given: givenFields(form), note: form.note.trim() || null,
                rights_version: RIGHTS_VERSION_SITE,
            });
            if (error) throw new Error(error.message.includes("row-level security") ? "limit" : "insert");
            setState("sent");
            setForm(EMPTY); setFile(null); setPreview(null);
            loadMine();
        } catch (err) {
            const m = (err as Error).message;
            setErrors([
                m === "limit" ? `오늘은 더 올릴 수 없어요(하루 ${DAILY_LIMIT}장). 내일 다시 올려 주세요.`
                    : m === "decode" ? "이 이미지를 열지 못했어요. jpg·png 파일로 바꿔 올려 주세요(아이폰 HEIC는 «호환성 우선»으로 저장)."
                    : m === "big" ? "줄여도 10MB가 넘어요. 더 작은 이미지로 올려 주세요."
                    : "올리지 못했습니다. 잠시 뒤 다시 해 주세요.",
            ]);
            setState("idle");
        }
    };

    if (userId === undefined) return null;
    if (userId === null) {
        return (
            <div className="pica-box p-5 text-[15px]">
                <p className="text-ink">리플렛은 로그인한 뒤 올릴 수 있어요. 누가 보냈는지 알아야 확인할 때 다시 여쭐 수 있습니다.</p>
                <Link href={loginHref("/tip/leaflet")} className="mt-4 inline-flex h-12 items-center border-[1.5px] border-ink bg-accent px-5 font-bold text-on-accent">로그인하고 올리기</Link>
            </div>
        );
    }

    const field = "w-full border-[1.5px] border-line bg-paper px-3 py-2.5 text-[15px] text-ink";
    return (
        <div className="flex flex-col gap-10">
            {state === "sent" ? (
                <div className="pica-box p-5 text-[15px]">
                    <p className="font-bold text-ink">고맙습니다. 리플렛을 받았어요.</p>
                    <p className="mt-2 text-ink-soft">글자를 읽어 행사 칸을 채운 뒤 운영자가 확인하고 올립니다. 진행 상황은 아래 «내가 보낸 리플렛»에서 볼 수 있어요.</p>
                    <button type="button" onClick={() => setState("idle")} className="mt-4 border-[1.5px] border-ink px-4 py-2 font-bold">하나 더 올리기</button>
                </div>
            ) : (
                <form onSubmit={send} className="flex flex-col gap-5" noValidate>
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-[15px] font-bold text-ink">이미지 종류</legend>
                        {IMAGE_KINDS.map(k => (
                            <label key={k.value} className="flex cursor-pointer items-start gap-2.5 border-[1.5px] border-line bg-paper p-3">
                                <input type="radio" name="image_kind" value={k.value} checked={form.image_kind === k.value}
                                    onChange={() => setForm(f => ({ ...f, image_kind: k.value }))} className="mt-1" />
                                <span><span className="font-bold text-ink">{k.label}</span><br /><span className="text-[13px] text-ink-soft">{k.hint}</span></span>
                            </label>
                        ))}
                    </fieldset>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-[15px] font-bold text-ink">리플렛·포스터 이미지</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={pick} className="text-[14px]" />
                        {preview && <img src={preview} alt="올릴 이미지 미리보기" className="mt-2 max-h-72 w-auto self-start border-[1.5px] border-line" />}
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-[15px] font-bold text-ink">단체 이름</span>
                        <input value={form.group_name} onChange={set("group_name")} maxLength={80} className={field} placeholder="예) 극단 ○○, ○○ 갤러리" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[15px] font-bold text-ink">공식 안내 주소 <span className="font-normal text-ink-soft">(있으면)</span></span>
                        <input value={form.official_url} onChange={set("official_url")} inputMode="url" className={field} placeholder="단체 누리집·인스타그램 게시물·예매 페이지 주소" />
                        <span className="text-[13px] text-ink-soft">적어 주시면 행사 화면의 «원본 안내»가 이 주소로 이어집니다. 없으면 «단체 제공»으로 표시합니다.</span>
                    </label>

                    <details className="border-[1.5px] border-dashed border-line px-3 py-2">
                        <summary className="cursor-pointer text-[14px] font-semibold text-ink">아는 내용 먼저 적기 (선택 — 비우면 이미지에서 읽습니다)</summary>
                        <div className="mt-3 flex flex-col gap-3">
                            <input value={form.title} onChange={set("title")} maxLength={200} className={field} placeholder="행사 이름" />
                            <input value={form.date_text} onChange={set("date_text")} maxLength={200} className={field} placeholder="날짜·시간 (예: 2026.12.5(토) 19:30)" />
                            <input value={form.venue} onChange={set("venue")} maxLength={200} className={field} placeholder="장소" />
                            <textarea value={form.note} onChange={set("note")} maxLength={1000} rows={3} className={field} placeholder="더 알려 줄 것 (예매 방법, 바뀐 내용 등)" />
                        </div>
                    </details>

                    <fieldset className="flex flex-col gap-2 border-[1.5px] border-ink p-3">
                        <legend className="px-1 text-[15px] font-bold text-ink">권리 확인</legend>
                        <label className="flex cursor-pointer items-start gap-2.5 text-[15px] font-semibold leading-relaxed text-ink">
                            <input type="checkbox" checked={form.rights[0]} className="mt-1 h-5 w-5 flex-none"
                                onChange={e => { const v = e.currentTarget.checked; setForm(f => ({ ...f, rights: [v] })); }} />
                            <span>{RIGHTS_ONE}</span>
                        </label>
                        <ul className="list-disc space-y-1 pl-9 text-[13px] leading-relaxed text-ink-soft">
                            {RIGHTS_CHECKS.map(text => <li key={text}>{text}</li>)}
                        </ul>
                        <p className="text-[13px] text-ink-soft">{PRIVACY_NOTE} 이미지는 1년 동안 보관한 뒤 지웁니다.</p>
                    </fieldset>

                    {errors.length > 0 && (
                        <ul className="text-[14px] font-semibold text-accent" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>
                    )}
                    <button type="submit" disabled={state === "sending"} className="inline-flex h-12 items-center justify-center self-start border-[1.5px] border-ink bg-accent px-6 font-bold text-on-accent disabled:opacity-50">
                        {state === "sending" ? "올리는 중…" : "리플렛 올리기"}
                    </button>
                </form>
            )}

            {mine.length > 0 && (
                <section>
                    <h2 className="pica-display text-[22px] text-ink">내가 보낸 리플렛</h2>
                    <ul className="mt-3 divide-y divide-line border-y border-line">
                        {mine.map(m => (
                            <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-[14px]">
                                <span className="min-w-0 font-semibold text-ink">
                                    {m.given?.title || m.ai_result?.title?.value || m.group_name || "제목 읽는 중"}
                                    <span className="ml-2 font-normal text-ink-soft">{new Date(m.created_at).toLocaleDateString("ko-KR")}</span>
                                </span>
                                {m.status === "published" && m.event_id
                                    ? <Link href={`/events/${m.event_id}`} className="font-bold text-accent underline underline-offset-4">{STATUS.published} →</Link>
                                    : <span className="text-ink-soft">{STATUS[m.status]}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
