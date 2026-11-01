"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 구글·카카오 로그인 후 돌아오는 곳.
// supabase-js가 주소의 토큰으로 세션을 만든다(detectSessionInUrl).
// 프로필(닉네임)이 없는 첫 방문이면 가입 화면(/welcome: 지역 → 관심 분야 → 닉네임)으로 보낸다 —
// 구글·카카오의 실명이 그대로 공개되지 않도록 (봉황메모리즈와 같은 원칙).
export default function AuthCallbackPage() {
    const router = useRouter();
    const [message, setMessage] = useState("로그인 처리 중...");

    useEffect(() => {
        const finish = async () => {
            const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
            const providerError = params.get("error_description") || params.get("error");
            if (providerError) {
                setMessage(`로그인에 실패했습니다: ${providerError}`);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setMessage("로그인 정보를 받지 못했습니다. 다시 시도해 주세요.");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("nickname")
                .eq("id", session.user.id)
                .maybeSingle();

            router.replace(profile?.nickname ? "/" : "/welcome");
        };
        finish();
    }, [router]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-neutral-50">
            <p className="font-bold text-neutral-600">{message}</p>
        </main>
    );
}
