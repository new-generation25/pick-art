"use client";

import { SocialLoginButtons } from "@/components/ui/SocialLoginButtons";
import { LegalLinks } from "@/components/ui/LegalLinks";
import { InAppNotice } from "@/components/ui/InAppNotice";

// 로그인과 가입은 소셜 로그인 하나로 한다. 처음 온 사람은 /auth/callback 에서 가입 3단계(/welcome)로 간다.
// 맨 위 줄(Header)은 MainLayout 이 그린다. 색·글꼴은 공개 화면 종이 테마(specs/014 FR-001·002)
export default function LoginPage() {
    return (
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
            <div className="pica-box w-full max-w-md p-8">
                <div className="mb-8 text-center">
                    <h1 className="pica-display text-[30px] leading-tight text-ink">로그인</h1>
                    <p className="mt-2 text-[15px] text-ink-soft">가까운 곳의 공연·전시 소식을 만나보세요.</p>
                </div>

                <InAppNotice className="mb-4" />
                <SocialLoginButtons />
                <div className="mt-4"><LegalLinks /></div>

                <p className="mt-6 text-center text-[13px] text-ink-soft">
                    처음이면 그대로 계속하면 가입됩니다.
                </p>
            </div>
        </main>
    );
}
