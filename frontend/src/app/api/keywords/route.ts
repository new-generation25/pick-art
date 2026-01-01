import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const email = formData.get("email")?.toString();
        const keywordsStr = formData.get("keywords")?.toString();

        if (!email || !keywordsStr) {
            return NextResponse.json({ error: "Email and keywords are required" }, { status: 400 });
        }

        // Split and clean keywords
        const keywords = keywordsStr.split(",").map(k => k.trim()).filter(k => k !== "");

        // Upsert keywords for the user
        // We'll store one row per keyword per user to make searching easier later
        const insertData = keywords.map(keyword => ({
            email,
            keyword
        }));

        const { error } = await supabase
            .from("keywords")
            .upsert(insertData, { onConflict: "email, keyword" });

        if (error) {
            console.error("Error saving keywords:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Redirect back with success message
        return NextResponse.redirect(new URL("/?alerted=true", request.url), {
            status: 303,
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
