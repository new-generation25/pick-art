"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/ui/Header";
import { User, Mail, Bell, Shield, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const [user, setUser] = useState<any>(null);
    const [nickname, setNickname] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [region, setRegion] = useState("");
    const [interests, setInterests] = useState<string[]>([]);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [newEventNotifications, setNewEventNotifications] = useState(true);

    const regions = ["창원", "김해", "진주", "통영", "거제", "양산", "밀양", "함안", "기타"];
    const categories = ["전시", "공연", "축제", "전통문화", "체험/교육"];

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            router.push('/login');
            return;
        }

        setUser(session.user);
        setEmail(session.user.email || '');

        // 프로필 정보 가져오기
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            setNickname(profile.nickname || '');
            setPhone(profile.phone || '');
            setRegion(profile.region || '');
            setInterests(profile.interests || []);
            setEmailNotifications(profile.email_notifications ?? true);
            setNewEventNotifications(profile.new_event_notifications ?? true);
        } else {
            // 프로필이 없으면 기본값 사용
            setNickname(session.user.email?.split('@')[0] || '');
        }

        setLoading(false);
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        setMessage("");

        try {
            // 프로필 업데이트 또는 생성
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    nickname: nickname,
                    phone: phone,
                    region: region,
                    interests: interests,
                    email_notifications: emailNotifications,
                    new_event_notifications: newEventNotifications,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (error) throw error;

            setMessage("✅ 설정이 저장되었습니다!");
            setTimeout(() => setMessage(""), 3000);
        } catch (error: any) {
            setMessage(`❌ 저장 실패: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50">
                <Header />
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50">
            <Header />
            <main className="container mx-auto px-4 py-12 max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-neutral-900 mb-2">설정</h1>
                    <p className="text-neutral-500">프로필 정보와 알림 설정을 관리하세요</p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl font-bold ${message.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {message}
                    </div>
                )}

                <div className="space-y-6">
                    {/* 프로필 정보 */}
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-neutral-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <User className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-bold text-neutral-900">프로필 정보</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">
                                    닉네임
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl focus:border-indigo-400 focus:outline-none font-medium"
                                    placeholder="닉네임을 입력하세요"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">
                                    이메일
                                </label>
                                <div className="flex items-center gap-3 px-4 py-3 bg-neutral-100 rounded-xl">
                                    <Mail className="w-5 h-5 text-neutral-400" />
                                    <span className="font-medium text-neutral-600">{email}</span>
                                </div>
                                <p className="text-xs text-neutral-500 mt-1">이메일은 변경할 수 없습니다</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">
                                    전화번호
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl focus:border-indigo-400 focus:outline-none font-medium"
                                    placeholder="010-1234-5678"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">
                                    거주 지역
                                </label>
                                <select
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl focus:border-indigo-400 focus:outline-none font-medium"
                                >
                                    <option value="">지역을 선택하세요</option>
                                    {regions.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">
                                    관심 분야
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map((category) => (
                                        <button
                                            key={category}
                                            type="button"
                                            onClick={() => {
                                                if (interests.includes(category)) {
                                                    setInterests(interests.filter(i => i !== category));
                                                } else {
                                                    setInterests([...interests, category]);
                                                }
                                            }}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                                                interests.includes(category)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                            }`}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-neutral-500 mt-2">관심 있는 분야를 선택하세요 (복수 선택 가능)</p>
                            </div>
                        </div>
                    </div>

                    {/* 알림 설정 */}
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-neutral-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Bell className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-bold text-neutral-900">알림 설정</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-neutral-900">이메일 알림</h3>
                                    <p className="text-sm text-neutral-500">중요한 업데이트를 이메일로 받습니다</p>
                                </div>
                                <button
                                    onClick={() => setEmailNotifications(!emailNotifications)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${emailNotifications ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </button>
                            </div>

                            <div className="border-t border-neutral-200 pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-neutral-900">새 이벤트 알림</h3>
                                        <p className="text-sm text-neutral-500">새로운 문화 이벤트가 등록되면 알려드립니다</p>
                                    </div>
                                    <button
                                        onClick={() => setNewEventNotifications(!newEventNotifications)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${newEventNotifications ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${newEventNotifications ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 계정 정보 */}
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-neutral-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Shield className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-bold text-neutral-900">계정 정보</h2>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-neutral-600">사용자 ID</span>
                                <span className="font-mono text-neutral-400 text-xs">{user?.id.substring(0, 8)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-600">가입일</span>
                                <span className="font-medium text-neutral-900">
                                    {new Date(user?.created_at).toLocaleDateString('ko-KR')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 저장 버튼 */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? "저장 중..." : "변경사항 저장"}
                    </button>
                </div>
            </main>
        </div>
    );
}
