"use client";

import { useState } from "react";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";

export function CalendarSubscribe({ siteUrl }: { siteUrl: string }) {
    const [region, setRegion] = useState("");
    const [category, setCategory] = useState("");
    const [copied, setCopied] = useState(false);

    const qs = new URLSearchParams();
    if (region) qs.set("region", region);
    if (category) qs.set("category", category);
    const https = `${siteUrl}/calendar.ics${qs.toString() ? `?${qs}` : ""}`;
    const webcal = https.replace(/^https?:\/\//, "webcal://");
    const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

    const copy = async () => {
        try { await navigator.clipboard.writeText(https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* 주소 칸을 길게 눌러 복사 */ }
    };

    const field = "w-full border-[1.5px] border-line bg-paper px-3 py-2.5 text-[15px] text-ink";
    const btn = "inline-flex h-12 items-center justify-center border-[1.5px] border-ink px-5 text-[15px] font-bold";
    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="cal-region" className="mb-1.5 block text-[14px] font-semibold text-ink">지역</label>
                    <select id="cal-region" value={region} onChange={e => { const v = e.currentTarget.value; setRegion(v); }} className={field}>
                        <option value="">전체 지역</option>
                        {GN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="cal-category" className="mb-1.5 block text-[14px] font-semibold text-ink">분야</label>
                    <select id="cal-category" value={category} onChange={e => { const v = e.currentTarget.value; setCategory(v); }} className={field}>
                        <option value="">전체 분야</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <a href={google} target="_blank" rel="noopener noreferrer" className={`${btn} bg-accent text-on-accent`}>구글 캘린더에 구독</a>
                <a href={webcal} className={`${btn} bg-paper text-ink`}>애플·기타 캘린더에 구독</a>
            </div>
            <div>
                <label htmlFor="cal-url" className="mb-1.5 block text-[14px] font-semibold text-ink">구독 주소 (다른 캘린더 앱에 «URL로 추가»)</label>
                <div className="flex gap-2">
                    <input id="cal-url" readOnly value={https} className={`${field} min-w-0 flex-1 text-[13px]`} onFocus={e => e.currentTarget.select()} />
                    <button type="button" onClick={copy} className={`${btn} h-auto shrink-0 bg-paper px-3 text-ink`}>{copied ? "복사함" : "복사"}</button>
                </div>
            </div>
        </div>
    );
}
