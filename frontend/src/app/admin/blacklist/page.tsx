"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { ShieldAlert, Plus, Trash2, Search, Globe, Instagram, Tag, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BlacklistItem {
    id: string;
    type: 'source' | 'keyword' | 'user';
    value: string;
    reason: string;
    created_at: string;
}

export default function AdminBlacklistPage() {
    const [list, setList] = useState<BlacklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // New Entry Form
    const [newVal, setNewVal] = useState("");
    const [newType, setNewType] = useState<'source' | 'keyword' | 'user'>('source');
    const [newReason, setNewReason] = useState("");

    useEffect(() => {
        fetchBlacklist();
    }, []);

    const fetchBlacklist = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("blacklist")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) setList(data);
        setLoading(false);
    };

    const addBlacklist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVal) return;

        const { data, error } = await supabase
            .from("blacklist")
            .insert([{ type: newType, value: newVal, reason: newReason }])
            .select();

        if (data) {
            setList([data[0], ...list]);
            setNewVal("");
            setNewReason("");
        }
    };

    const deleteItem = async (id: string) => {
        const { error } = await supabase.from("blacklist").delete().eq("id", id);
        if (!error) {
            setList(list.filter(item => item.id !== id));
        }
    };

    const filteredList = list.filter(item =>
        item.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-neutral-50 pb-20">
            <AdminHeader />
            <div className="container mx-auto px-4 pt-28">
                <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-neutral-900 flex items-center gap-3">
                            <ShieldAlert className="w-10 h-10 text-red-600" />
                            블랙리스트 관리
                        </h1>
                        <p className="text-neutral-500 mt-2 font-medium italic">부적절한 광고성 계정이나 키워드를 수집 대상에서 영구 제외합니다.</p>
                    </div>

                    {/* Add Form */}
                    <form onSubmit={addBlacklist} className="bg-white p-6 rounded-[2rem] shadow-sm ring-1 ring-neutral-200 flex flex-wrap gap-4 items-end grow max-w-3xl">
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">유형</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                            >
                                <option value="source">도메인/URL</option>
                                <option value="user">인스타 계정</option>
                                <option value="keyword">금지 키워드</option>
                            </select>
                        </div>
                        <div className="flex-[2] min-w-[200px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">값 (Value)</label>
                            <input
                                type="text"
                                value={newVal}
                                onChange={(e) => setNewVal(e.target.value)}
                                placeholder="예: spam-site.com 또는 @baduser"
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                            />
                        </div>
                        <div className="flex-[2] min-w-[200px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">사유 (선택사항)</label>
                            <input
                                type="text"
                                value={newReason}
                                onChange={(e) => setNewReason(e.target.value)}
                                placeholder="예: 광고성 계정"
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                            />
                        </div>
                        <button className="h-12 px-8 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2">
                            <Plus className="w-5 h-5" /> 추가
                        </button>
                    </form>
                </div>

                {/* List Table */}
                <div className="bg-white rounded-[2.5rem] shadow-sm ring-1 ring-neutral-200 overflow-hidden">
                    <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="목록 내 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-neutral-700 w-64"
                            />
                        </div>
                        <p className="text-xs font-bold text-neutral-400">총 {filteredList.length}개의 항목이 차단됨</p>
                    </div>

                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-50">
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">유형</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">차단 대상</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">차단 사유</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">차단 일시</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-20 text-center text-neutral-300 font-bold animate-pulse">차단 목록 로드 중...</td></tr>
                            ) : filteredList.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-32 text-center text-neutral-300 font-bold">등록된 블랙리스트가 없습니다.</td></tr>
                            ) : (
                                filteredList.map((item) => (
                                    <tr key={item.id} className="hover:bg-red-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'source' ? 'bg-blue-50 text-blue-600' :
                                                    item.type === 'user' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                {item.type === 'source' ? <Globe className="w-5 h-5" /> :
                                                    item.type === 'user' ? <Instagram className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-extrabold text-neutral-800 tracking-tight">{item.value}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-neutral-500 font-medium">{item.reason || "-"}</span>
                                        </td>
                                        <td className="px-8 py-5 text-neutral-400 text-sm font-medium">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5">
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                className="p-2 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Warning Card */}
                <div className="mt-12 p-8 rounded-[2.5rem] bg-amber-50 border border-amber-100 flex gap-6 items-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-amber-900 mb-1">블랙리스트 관리 주의사항</h4>
                        <p className="text-amber-800/70 font-medium leading-relaxed">
                            블랙리스트에 등록된 계정이나 키워드는 수집 엔진이 자동으로 필터링하여 인박스에도 노출되지 않습니다.
                            광고성 게시물이 반복되는 출처를 등록하여 검토 효율을 높이세요.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
