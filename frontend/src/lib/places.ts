import { supabase } from "@/lib/supabase";
import { HIDDEN_CATEGORIES } from "@/lib/categories";
import { todayKST, monthsAgoKST } from "@/lib/utils";

/** 공간(장소)·단체 페이지의 데이터 (specs/012). 익명 키로 읽어 RLS가 비공개 행사를 가린다 */
export type PlaceEvent = {
    id: string; title: string; category: string; region: string | null; venue: string | null;
    event_date_start: string | null; event_date_end: string | null; poster_image_url: string | null; is_free: boolean | null;
    poster_placeholder?: boolean | null; source?: string | null;
};
const EVENT_COLS = "id,title,category,region,venue,event_date_start,event_date_end,poster_image_url,is_free,poster_placeholder,source";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 다가오는 행사(끝나지 않은 것, 시작일 순)와 지난 1년 행사(최근 끝난 순 30건) */
async function splitEvents(filter: (q: any) => any): Promise<{ upcoming: PlaceEvent[]; past: PlaceEvent[] }> {
    const today = todayKST();
    let up = filter(supabase.from("events").select(EVENT_COLS).eq("status", "PUBLISHED").gte("event_date_end", today));
    let past = filter(supabase.from("events").select(EVENT_COLS).eq("status", "PUBLISHED").lt("event_date_end", today).gte("event_date_end", monthsAgoKST(12)));
    for (const c of HIDDEN_CATEGORIES) { up = up.neq("category", c); past = past.neq("category", c); }
    const [u, p] = await Promise.all([
        up.order("event_date_start", { ascending: true }).limit(200),
        past.order("event_date_end", { ascending: false }).limit(30),
    ]);
    return { upcoming: (u.data || []) as PlaceEvent[], past: (p.data || []) as PlaceEvent[] };
}

export type Venue = { id: string; name: string; region: string | null; district: string | null; lat: number; lng: number; closed_days: string | null; capacity: number | null };

export async function getVenuePage(id: string) {
    if (!UUID.test(id)) return null;
    const { data: venue } = await supabase.from("public_venues").select("id,name,region,district,lat,lng,closed_days,capacity").eq("id", id).maybeSingle();
    if (!venue) return null;
    return { venue: venue as Venue, ...(await splitEvents(q => q.eq("venue_id", id))) };
}

export type Org = { id: string; name: string; kind: "기관" | "단체" | "계정"; insta_handle: string | null; small: boolean };
export const ROLE_ORDER = ["주최", "주관", "기획", "제작", "게시"] as const;

export async function getOrgPage(id: string) {
    if (!UUID.test(id)) return null;
    const { data: org } = await supabase.from("orgs").select("id,name,kind,insta_handle,small").eq("id", id).maybeSingle();
    if (!org) return null;
    const { data: links } = await supabase.from("event_orgs").select("event_id,role").eq("org_id", id).limit(2000);
    const ids = [...new Set((links || []).map(l => l.event_id as string))];
    const roles = [...new Set((links || []).map(l => l.role as string))].sort((a, b) => ROLE_ORDER.indexOf(a as any) - ROLE_ORDER.indexOf(b as any));
    if (!ids.length) return { org: org as Org, roles, upcoming: [], past: [] };
    return { org: org as Org, roles, ...(await splitEvents(q => q.in("id", ids.slice(0, 1000)))) };
}

/** 행사 상세의 «주최·주관» 줄: 이 행사에 이어진 단체 (게시 계정은 «올린 곳») */
export async function getEventOrgs(eventId: string): Promise<{ org: Org; role: string }[]> {
    const { data } = await supabase.from("event_orgs").select("role, orgs(id,name,kind,insta_handle,small)").eq("event_id", eventId);
    return ((data || []) as any[]).filter(r => r.orgs).map(r => ({ org: r.orgs as Org, role: r.role as string }))
        .sort((a, b) => ROLE_ORDER.indexOf(a.role as any) - ROLE_ORDER.indexOf(b.role as any));
}
