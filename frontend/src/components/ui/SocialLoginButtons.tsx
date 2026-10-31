"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Provider = "google" | "kakao";

// Supabase에서 카카오 공급자를 켠 뒤 .env.local 에 NEXT_PUBLIC_KAKAO_LOGIN=on 을 넣으면 버튼이 보인다.
// 켜기 전에 누르면 'provider is not enabled' 오류 화면이 나오기 때문에 기본은 숨긴다.
const KAKAO_ENABLED = process.env.NEXT_PUBLIC_KAKAO_LOGIN === "on";

// 구글·카카오 로그인. 로그인과 가입이 같은 흐름이다 — 처음 온 사람은
// /auth/callback 에서 닉네임을 정하는 설정 화면으로 보낸다.
export function SocialLoginButtons() {
    const [pending, setPending] = useState<Provider | null>(null);
    const [error, setError] = useState<string | null>(null);

    const signIn = async (provider: Provider) => {
        setPending(provider);
        setError(null);
        // prompt를 지정하지 않는다: 계정이 하나뿐인 사람에게 매번 선택 창을 띄우지 않기 위해 (봉황메모리즈와 같은 판단)
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
            setError(`${provider === "google" ? "구글" : "카카오"} 로그인을 시작하지 못했습니다: ${error.message}`);
            setPending(null);
        }
        // 성공하면 브라우저가 공급자 로그인 화면으로 이동한다
    };

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => signIn("google")}
                disabled={pending !== null}
                className="w-full h-14 rounded-2xl bg-white border border-neutral-200 font-bold text-neutral-800 hover:bg-neutral-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
                <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                </svg>
                {pending === "google" ? "구글로 이동 중..." : "구글로 계속하기"}
            </button>
            {KAKAO_ENABLED && <button
                type="button"
                onClick={() => signIn("kakao")}
                disabled={pending !== null}
                className="w-full h-14 rounded-2xl bg-[#FEE500] font-bold text-[#191919] hover:brightness-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#191919" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.5 10-7.8S17.5 3 12 3z" />
                </svg>
                {pending === "kakao" ? "카카오로 이동 중..." : "카카오로 계속하기"}
            </button>}
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>
    );
}
