"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { CheckCircle2, Plus, Trash2, Search, Globe, Instagram, Zap, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface WhitelistItem {
    id: string;
    type: 'source' | 'user';
    value: string;
    name: string;
    auto_publish: boolean;
    created_at: string;
}

export default function AdminWhitelistPage() {
    const [list, setList] = useState<WhitelistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // New Entry Form
    const [newVal, setNewVal] = useState("");
    const [newType, setNewType] = useState<'source' | 'user'>('source');
    const [newName, setNewName] = useState("");
    const [autoPublish, setAutoPublish] = useState(true);

    useEffect(() => {
        fetchWhitelist();
    }, []);

    const fetchWhitelist = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("whitelist")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) setList(data);
        setLoading(false);
    };

    const addWhitelist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVal) return;

        const { data, error } = await supabase
            .from("whitelist")
            .insert([{
                type: newType,
                value: newVal,
                name: newName,
                auto_publish: autoPublish
            }])
            .select();

        if (data) {
            setList([data[0], ...list]);
            setNewVal("");
            setNewName("");
        }
    };

    const deleteItem = async (id: string) => {
        const { error } = await supabase.from("whitelist").delete().eq("id", id);
        if (!error) {
            setList(list.filter(item => item.id !== id));
        }
    };

    const filteredList = list.filter(item =>
        item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-neutral-50 pb-20">
            <AdminHeader />
            <div className="container mx-auto px-4 pt-28">
                <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-neutral-900 flex items-center gap-3">
                            <ShieldCheck className="w-10 h-10 text-green-600" />
                            화이트리스트 관리
                        </h1>
                        <p className="text-neutral-500 mt-2 font-medium">검증된 공공기관이나 신뢰할 수 있는 계정은 인박스 검토 없이 <b>즉시 발행</b>됩니다.</p>
                    </div>

                    {/* Add Form */}
                    <form onSubmit={addWhitelist} className="bg-white p-6 rounded-[2rem] shadow-sm ring-1 ring-neutral-200 flex flex-wrap gap-4 items-end grow max-w-4xl">
                        <div className="flex-1 min-w-[120px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">유형</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            >
                                <option value="source">도메인/URL</option>
                                <option value="user">인스타 계정</option>
                            </select>
                        </div>
                        <div className="flex-[1.5] min-w-[180px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">이름/기관명</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="예: 경남문화예술진흥원"
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                        </div>
                        <div className="flex-[2] min-w-[200px]">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">ID / URL</label>
                            <input
                                type="text"
                                value={newVal}
                                onChange={(e) => setNewVal(e.target.value)}
                                placeholder="예: gcf.or.kr 또는 @official_account"
                                className="w-full h-12 px-4 rounded-xl bg-neutral-50 border border-neutral-100 font-bold text-neutral-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 h-12 bg-neutral-50 px-4 rounded-xl border border-neutral-100">
                            <input
                                type="checkbox"
                                id="autoPub"
                                checked={autoPublish}
                                onChange={(e) => setAutoPublish(e.target.checked)}
                                className="w-5 h-5 accent-green-600 rounded"
                            />
                            <label htmlFor="autoPub" className="text-xs font-black text-neutral-600 cursor-pointer">자동 승인</label>
                        </div>
                        <button className="h-12 px-8 bg-green-600 text-white rounded-xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-2">
                            <Plus className="w-5 h-5" /> 등록
                        </button>
                    </form>
                </div>

                {/* List Table */}
                <div className="bg-white rounded-[2.5rem] shadow-sm ring-1 ring-neutral-200 overflow-hidden">
                    <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                        <div className="flex items-center gap-3 text-neutral-400">
                            <Search className="w-5 h-5" />
                            <input
                                type="text"
                                placeholder="목록 내 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-neutral-700 w-64 placeholder:text-neutral-300"
                            />
                        </div>
                        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Trusted Sources List</p>
                    </div>

                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-50">
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">상태</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">기관/이름</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">식별 정보</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">일시</th>
                                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-20 text-center text-neutral-300 font-bold animate-pulse">화이트리스트 데이터 로드 중...</td></tr>
                            ) : filteredList.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-32 text-center text-neutral-300 font-bold">등록된 화이트리스트가 없습니다.</td></tr>
                            ) : (
                                filteredList.map((item) => (
                                    <tr key={item.id} className="hover:bg-green-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                {item.auto_publish ? (
                                                    <div className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black flex items-center gap-1">
                                                        <Zap className="w-3 h-3 fill-current" /> AUTO
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-1 bg-neutral-50 text-neutral-400 rounded-full text-[10px] font-black">
                                                        MANUAL
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'source' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                    }`}>
                                                    {item.type === 'source' ? <Globe className="w-4 h-4" /> : <Instagram className="w-4 h-4" />}
                                                </div>
                                                <span className="font-extrabold text-neutral-800">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <code className="text-xs bg-neutral-100 px-2 py-1 rounded text-neutral-600 font-mono">{item.value}</code>
                                        </td>
                                        <td className="px-8 py-5 text-neutral-400 text-sm font-medium">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                className="p-2 text-neutral-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
            </div>
        </main>
    );
}
