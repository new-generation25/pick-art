"use client";

import { Header } from "@/components/ui/Header";
import { User } from "lucide-react";
import { SocialLoginButtons } from "@/components/ui/SocialLoginButtons";
import { LegalLinks } from "@/components/ui/LegalLinks";

// 로그인과 가입은 소셜 로그인 하나로 한다. 처음 온 사람은 /auth/callback 에서 가입 3단계(/welcome)로 간다.
export default function LoginPage() {
    return (
        <main className="min-h-screen bg-neutral-50">
            <Header />
            <div className="container mx-auto px-4 flex items-center justify-center min-h-screen pt-20">
                <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-indigo-100/50 ring-1 ring-neutral-200">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-neutral-900 mb-2">로그인</h1>
                        <p className="text-neutral-500 font-medium">가까운 곳의 공연·전시 소식을 만나보세요.</p>
                    </div>

                    <SocialLoginButtons />
                    <div className="mt-4"><LegalLinks /></div>

                    <p className="mt-8 text-center text-sm font-medium text-neutral-400">
                        처음이면 그대로 계속하면 가입됩니다.
                    </p>
                </div>
            </div>
        </main>
    );
}
