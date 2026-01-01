"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { Settings, Plus, Trash2, Save, Globe, Instagram } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminConfigPage() {
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        const { data, error } = await supabase
            .from("crawler_configs")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) setConfigs(data);
        setLoading(false);
    };

    const addConfig = async () => {
        const newConfig = {
            target_type: "instagram",
            name: "신규 크롤링 대상",
            identifier: "@username",
            keywords: ["공연", "전시"],
            is_active: true
        };

        const { data, error } = await supabase
            .from("crawler_configs")
            .insert([newConfig])
            .select();

        if (data) setConfigs([data[0], ...configs]);
    };

    return (
        <main className="min-h-screen bg-neutral-50 pb-20">
            <AdminHeader />
            <div className="container mx-auto px-4 pt-28">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-neutral-900 flex items-center gap-3">
                            <Settings className="w-10 h-10 text-indigo-600" />
                            크롤링 설정 관리
                        </h1>
                        <div className="flex gap-4 mt-2">
                            <Link href="/admin/inbox" className="text-sm font-bold text-indigo-600 hover:underline">인박스 바로가기</Link>
                            <Link href="/admin/manual" className="text-sm font-bold text-indigo-600 hover:underline">수동 등록 바로가기</Link>
                        </div>
                    </div>
                    <button
                        onClick={addConfig}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        새 설정 추가
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configs.map((config) => (
                        <div key={config.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm ring-1 ring-neutral-200 hover:shadow-xl transition-all group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                    {config.target_type === 'instagram' ? <Instagram className="text-indigo-600" /> : <Globe className="text-indigo-600" />}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${config.is_active ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'}`}>
                                    {config.is_active ? '활성 상태' : '중단됨'}
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">이름 / 상호</label>
                                    <input
                                        defaultValue={config.name}
                                        className="w-full mt-1 font-extrabold text-xl text-neutral-800 bg-transparent border-b border-transparent focus:border-indigo-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">ID / URL</label>
                                    <p className="font-mono text-indigo-600 font-bold">{config.identifier}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">모니터링 키워드</label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {config.keywords?.map((kw: string) => (
                                            <span key={kw} className="px-3 py-1 bg-neutral-100 rounded-lg text-sm font-bold text-neutral-600">#{kw}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
                                <button className="text-neutral-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button className="flex items-center gap-2 px-6 h-11 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all">
                                    <Save className="w-4 h-4" />
                                    저장하기
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
