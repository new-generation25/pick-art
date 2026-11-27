import { supabase } from "@/lib/supabase";

// 사이트에서 받은 동의(specs/016 정식 협약): 단체·예술인이 /partners 에서 동의서를 보내면 partner_agreements 에 쌓이고,
// 운영자가 «협약 확인»을 누르면 status 가 confirmed 가 된다. 관리자 화면은 이 표를 인스타 계정으로 찾아
// «확정 동의»(확인됨)·«사이트 신청»(확인 전)으로 보여 준다. 댓글·DM으로 받은 임시·상시 동의(whitelist.consent)와는 다른 칸이다.

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
