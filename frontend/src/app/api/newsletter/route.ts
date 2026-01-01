import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const email = formData.get("email") as string;

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from("subscribers")
            .upsert([{ email, is_active: true }], { onConflict: "email" });

        if (error) {
            console.error("Subscription error:", error);
            return NextResponse.json({ error: "구독 중 오류가 발생했습니다." }, { status: 500 });
        }

        // 성공 시 메인 페이지로 리다이렉트 (추후 성공 페이지로 변경 가능)
        return NextResponse.redirect(new URL("/?subscribed=true", request.url));
    } catch (err) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
