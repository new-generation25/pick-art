import { supabase } from "@/lib/supabase";

// 사이트에서 받은 동의(specs/016 정식 협약): 단체·예술인이 /partners 에서 동의서를 보내면 partner_agreements 에 쌓이고,
// 운영자가 «협약 확인»을 누르면 status 가 confirmed 가 된다. 관리자 화면은 이 표를 인스타 계정으로 찾아
// «확정 동의»(확인됨)·«사이트 신청»(확인 전)으로 보여 준다. 댓글·DM으로 받은 임시·상시 동의(whitelist.consent)와는 다른 칸이다.
// 운영자 2026-11-27 «협약신청 확인되면 상시동의로 전환»: «협약 확인»을 누르면 그 인스타 계정의 출처(whitelist) 동의 단계를
// 상시(standing)로, «철회 처리»를 누르면 철회(withdrawn)로 바꾼다(setSourceConsent). 수집·공개 판정은 whitelist.consent 를 본다.

export type SiteConsent = { status: "confirmed" | "new"; orgName: string; at: string | null };

/** 인스타 계정(소문자, @ 없음) → 사이트 동의. 확인된 것이 신청보다 앞선다. 관리자만 읽을 수 있다 */
export async function fetchSiteConsents(): Promise<Record<string, SiteConsent>> {
    const { data } = await supabase.from("partner_agreements")
        .select("insta_handle,status,org_name,created_at,handled_at")
        .in("status", ["new", "confirmed"]).not("insta_handle", "is", null).limit(2000);
    const map: Record<string, SiteConsent> = {};
    for (const r of data || []) {
        const h = String(r.insta_handle || "").replace(/^@/, "").toLowerCase();
        if (!h) continue;
        const next: SiteConsent = { status: r.status as "confirmed" | "new", orgName: r.org_name as string, at: ((r.status === "confirmed" ? r.handled_at : r.created_at) as string | null)?.slice(0, 10) || null };
        if (!map[h] || (map[h].status === "new" && next.status === "confirmed")) map[h] = next;
    }
    return map;
}

export const SITE_CONSENT_LABEL = { confirmed: "확정 동의", new: "사이트 신청 · 확인 전" } as const;
export const SITE_CONSENT_HINT = {
    confirmed: "피카 사이트의 협약 페이지에서 동의서를 보냈고 운영자가 확인했습니다.",
    new: "피카 사이트에서 동의서를 보냈습니다. «협약 신청»에서 확인해 주세요.",
} as const;

/** 출처 값(인스타 주소 또는 @계정) → 계정(소문자, @ 없음) */
export function instaHandle(value: string): string {
    const m = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    return (m ? m[1] : value.trim().replace(/^@/, "")).toLowerCase();
}

/** 정렬 순위(작을수록 위): 확정 동의 → 상시 → 임시 → 사이트 신청(확인 전) → 없음 → 철회 */
export function consentRank(tier: string | undefined, site: SiteConsent | undefined): number {
    if (site?.status === "confirmed") return 0;
    if (tier === "standing") return 1;
    if (tier === "temporary") return 2;
    if (site?.status === "new") return 3;
    if (tier === "withdrawn") return 5;
    return 4;
}

/** 협약 신청에 적힌 인스타 계정(소문자, @ 없음). 계정 칸이 비었으면 공식 주소가 인스타그램 주소일 때 거기서 읽는다 */
export function agreementHandle(a: { insta_handle?: string | null; official_url?: string | null }): string | null {
    const direct = (a.insta_handle || "").trim().replace(/^@/, "").toLowerCase();
    if (direct) return direct;
    // «instagram.com/@계정» 처럼 @ 를 붙여 적는 사람이 있다(2026-11-28 앙상블 블랑쉬: 이 때문에 협약 확인 때 동의 단계가 안 바뀜)
    const m = (a.official_url || "").match(/instagram\.com\/@?([A-Za-z0-9._]+)/i);
    return m && !["p", "reel", "reels", "explore", "stories"].includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
}

/**
 * 출처(whitelist)의 그 인스타 계정 동의 단계를 바꾼다. 관리자만 된다(RLS).
 * 돌려주는 값: changed = 바뀐 출처 줄 수(0 이면 출처에 그 계정이 없다), error = 실패 까닭
 */
export async function setSourceConsent(handle: string, tier: "standing" | "withdrawn", evidence: string, today: string): Promise<{ changed: number; error?: string }> {
    const { data, error } = await supabase.from("whitelist").select("id,value").eq("type", "instagram").ilike("value", `%instagram.com/${handle}%`).limit(20);
    if (error) return { changed: 0, error: error.message };
    const ids = (data || []).filter(r => instaHandle(String(r.value)) === handle).map(r => r.id as string);   // «abc» 가 «abc2» 에 걸리지 않게 계정 이름이 똑같은 줄만
    if (!ids.length) return { changed: 0 };
    const up = await supabase.from("whitelist").update({ consent: tier, consent_at: today, consent_evidence: evidence.slice(0, 500) }).in("id", ids).select("id");
    if (up.error) return { changed: 0, error: up.error.message };
    return { changed: up.data?.length || 0 };
}
