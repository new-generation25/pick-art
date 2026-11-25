import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calendar } from "@/lib/ics";
import { SITE_URL } from "@/lib/site";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES, HIDDEN_CATEGORIES } from "@/lib/categories";
import { todayKST } from "@/lib/utils";
import { addDays } from "@/lib/feedOrder";

// 지역·분야 캘린더 구독 (specs/008): /calendar.ics?region=김해&category=전시
// 가입 없이 구글·애플 캘린더가 이 주소를 주기적으로 다시 읽는다. 오늘부터 60일 안의 공개 행사
export const revalidate = 3600;

export async function GET(req: Request) {
    const sp = new URL(req.url).searchParams;
    const region = sp.get("region");
    const category = sp.get("category");
    if (region && !GN_REGIONS.includes(region)) return new NextResponse("없는 지역입니다.", { status: 400 });
    if (category && !CATEGORIES.includes(category)) return new NextResponse("없는 분야입니다.", { status: 400 });

    const today = todayKST();
    let q = supabase.from("events")
        .select("id,title,event_date_start,event_date_end,venue,region,description")
        .eq("status", "PUBLISHED")
        .gte("event_date_end", today)
        .lte("event_date_start", addDays(today, 60));
    for (const c of HIDDEN_CATEGORIES) q = q.neq("category", c);
    if (region) q = q.eq("region", region);
    if (category) q = q.eq("category", category);
    const { data, error } = await q.order("event_date_start").limit(1000);
    if (error) return new NextResponse("행사를 읽지 못했습니다.", { status: 502 });

    const name = ["피카", region || "전체 지역", category || ""].filter(Boolean).join(" · ");
    const body = calendar((data || []).map(e => ({ ...e, url: `${SITE_URL}/events/${e.id}` })), name);
    return new NextResponse(body, {
        headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
}
