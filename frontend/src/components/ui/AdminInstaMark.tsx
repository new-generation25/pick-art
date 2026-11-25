"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { InstagramIcon } from "./InstagramLink";

/**
 * 행사 상세 「출처」 줄 옆의 피카 인스타 표시. 관리자(profiles.role='admin')에게만 보인다.
 * 방문자에게는 출처 구분을 보이지 않는다(2026-11-26 운영자: 사람들에게는 정보가 중요하지 출처 구분이 중요하지 않다).
 */
export function AdminInstaMark({ url, postedAt }: { url: string; postedAt?: string | null }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
            if (!cancelled && profile?.role === "admin") setIsAdmin(true);
        })();
        return () => { cancelled = true; };
    }, []);

    if (!isAdmin || !url.startsWith("https://www.instagram.com/")) return null;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`피카 인스타에 소개함${postedAt ? ` (${postedAt})` : ""} — 관리자에게만 보임`}
            aria-label="피카 인스타 게시물 (관리자에게만 보임)"
            className="ml-2 inline-flex translate-y-[2px] text-ink-soft hover:text-ink"
        >
            <InstagramIcon size={16} />
        </a>
    );
}
