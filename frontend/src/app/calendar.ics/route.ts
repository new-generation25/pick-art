import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calendar } from "@/lib/ics";
import { SITE_URL } from "@/lib/site";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES, HIDDEN_CATEGORIES } from "@/lib/categories";
import { todayKST } from "@/lib/utils";
import { addDays } from "@/lib/feedOrder";
import { UUID } from "@/lib/places";

// 지역·분야 캘린더 구독 (specs/008): /calendar.ics?region=김해&category=전시
// 장소·단체별 (specs/012): /calendar.ics?venue=<장소 id>, /calendar.ics?org=<단체 id>
// 가입 없이 구글·애플 캘린더가 이 주소를 주기적으로 다시 읽는다. 오늘부터 60일 안의 공개 행사
export const revalidate = 3600;

export async function GET(req: Request) {
    const sp = new URL(req.url).searchParams;
    const region = sp.get("region");
    const category = sp.get("category");
    if (region && !GN_REGIONS.includes(region)) return new NextResponse("없는 지역입니다.", { status: 400 });
    if (category && !CATEGORIES.includes(category)) return new NextResponse("없는 분야입니다.", { status: 400 });
    const venue = sp.get("venue");
    const org = sp.get("org");
    if (venue && !UUID.test(venue)) return new NextResponse("없는 장소입니다.", { status: 400 });
    if (org && !UUID.test(org)) return new NextResponse("없는 단체입니다.", { status: 400 });
    let label = "";
    let orgEvents: string[] | null = null;
    if (venue) {
        const { data } = await supabase.from("public_venues").select("name").eq("id", venue).maybeSingle();
        if (!data) return new NextResponse("없는 장소입니다.", { status: 404 });
        label = data.name;
    }
    if (org) {
        const { data } = await supabase.from("orgs").select("name").eq("id", org).maybeSingle();
        if (!data) return new NextResponse("없는 단체입니다.", { status: 404 });
        label = data.name;
        const { data: links } = await supabase.from("event_orgs").select("event_id").eq("org_id", org).limit(1000);
        orgEvents = [...new Set((links || []).map(l => l.event_id as string))];
    }

    const today = todayKST();
    let q = supabase.from("events")
        .select("id,title,event_date_start,event_date_end,venue,region,description")
        .eq("status", "PUBLISHED")
        .gte("event_date_end", today)
        .lte("event_date_start", addDays(today, 60));
    for (const c of HIDDEN_CATEGORIES) q = q.neq("category", c);
    if (region) q = q.eq("region", region);
    if (category) q = q.eq("category", category);
    if (venue) q = q.eq("venue_id", venue);
    if (orgEvents) q = q.in("id", orgEvents.length ? orgEvents : ["00000000-0000-0000-0000-000000000000"]);
    const { data, error } = await q.order("event_date_start").limit(1000);
    if (error) return new NextResponse("행사를 읽지 못했습니다.", { status: 502 });

    const name = label ? `피카 · ${label}` : ["피카", region || "전체 지역", category || ""].filter(Boolean).join(" · ");
    const body = calendar((data || []).map(e => ({ ...e, url: `${SITE_URL}/events/${e.id}` })), name);
    return new NextResponse(body, {
        headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
}
