import { NextResponse } from "next/server";
import { getEventById } from "@/lib/supabase";
import { calendar } from "@/lib/ics";
import { SITE_URL } from "@/lib/site";

// 행사 하나를 내 캘린더에 넣는 .ics 파일 (specs/008). 공개 행사만(RLS)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const e = await getEventById(id);
    if (!e) return new NextResponse("찾을 수 없는 행사입니다.", { status: 404 });
    const body = calendar([{ ...e, url: `${SITE_URL}/events/${e.id}` }], `피카 · ${e.title}`);
    return new NextResponse(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="pica-${e.id.slice(0, 8)}.ics"`,
            "Cache-Control": "public, max-age=600",
        },
    });
}
