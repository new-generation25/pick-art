"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { UserPlus, Lock, Mail, Phone, MapPin, Heart, User } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        nickname: "",
        phone: "",
        region: "창원",
        interests: [] as string[]
    });

    const regions = ["창원", "김해", "진주", "통영", "거제", "양산", "밀양", "함안", "기타"];
    const categories = ["전시", "공연", "축제", "전통문화", "체험/교육"];

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // 1. Supabase Auth 가입
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
        });

        if (authError) {
            alert("가입 오류: " + authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // 2. 추가 프로필 정보 저장
            const { error: profileError } = await supabase.from("profiles").insert([
                {
                    id: authData.user.id,
                    nickname: formData.nickname,
                    phone: formData.phone,
                    region: formData.region,
                    interests: formData.interests
                }
            ]);

            if (profileError) {
                alert("프로필 생성 오류: " + profileError.message);
            } else {
                alert("회원가입이 완료되었습니다! 로그인해 주세요.");
                router.push("/login");
            }
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 py-20">
            <div className="w-full max-w-xl bg-white rounded-[3rem] p-10 md:p-16 shadow-2xl ring-1 ring-neutral-200">
                <div className="text-center mb-12">
                    <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                        <UserPlus className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-neutral-900 mb-2">회원가입</h1>
                    <p className="text-neutral-500 font-medium">경남 아트 네비게이터의 새로운 가족이 되어주세요.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-full">
                            <label className="text-sm font-black text-neutral-700 ml-1">이메일 (ID)</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold"
                                    placeholder="example@mail.com"
                                />
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-neutral-700 ml-1">비밀번호</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold"
                                    placeholder="••••••••"
                                />
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-neutral-700 ml-1">닉네임</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    value={formData.nickname}
                                    onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold"
                                    placeholder="홍길동"
                                />
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-neutral-700 ml-1">전화번호</label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold"
                                    placeholder="010-1234-5678"
                                />
                                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            </div>
                        </div>

                        <div className="space-y-2 col-span-full">
                            <label className="text-sm font-black text-neutral-700 ml-1">거주지</label>
                            <div className="relative">
                                <select
                                    value={formData.region}
                                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold appearance-none"
                                >
                                    {regions.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            </div>
                        </div>

                        <div className="space-y-2 col-span-full">
                            <label className="text-sm font-black text-neutral-700 ml-1">관심 분야 (선택)</label>
                            <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                                {categories.map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => {
                                            if (formData.interests.includes(category)) {
                                                setFormData({
                                                    ...formData,
                                                    interests: formData.interests.filter(i => i !== category)
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    interests: [...formData.interests, category]
                                                });
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                                            formData.interests.includes(category)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                                        }`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-500 ml-1">관심 있는 분야를 선택하세요 (복수 선택 가능)</p>
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full h-16 bg-neutral-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-neutral-800 transition-all shadow-xl active:scale-[0.98] mt-4 disabled:opacity-50"
                    >
                        {loading ? "가입 처리 중..." : "회원가입 완료"}
                    </button>
                </form>

                <div className="mt-10 text-center">
                    <p className="text-neutral-500 font-bold">
                        이미 계정이 있으신가요?{" "}
                        <Link href="/login" className="text-indigo-600 hover:underline ml-2">로그인하기</Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
