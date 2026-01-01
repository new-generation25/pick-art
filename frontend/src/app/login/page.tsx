"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/Header";
import { Lock, Mail, AlertCircle, User, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError("이메일 또는 비밀번호가 올바르지 않습니다.");
            } else {
                router.push("/");
            }
        } catch (err) {
            setError("로그인 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

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
                        <p className="text-neutral-500 font-medium">경남의 예술 정보를 만나보세요.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold text-sm">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-neutral-700 ml-1">Email</label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    required
                                    className="w-full h-14 pl-12 pr-6 rounded-2xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                                />
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-indigo-600 transition-colors" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-neutral-700 ml-1">Password</label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full h-14 pl-12 pr-6 rounded-2xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                                />
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-indigo-600 transition-colors" />
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            className="w-full h-14 bg-neutral-900 text-white rounded-2xl font-bold text-lg hover:bg-neutral-800 transition-all shadow-lg active:scale-[0.98] mt-4 disabled:opacity-50"
                        >
                            {loading ? "로그인 중..." : "로그인"}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium">
                        <p className="text-neutral-400">
                            아직 회원이 아니신가요?{" "}
                            <Link href="/signup" className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-1">
                                <UserPlus className="w-4 h-4" /> 가입하기
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
