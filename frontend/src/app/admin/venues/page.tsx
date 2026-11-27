"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * 장소 좌표 확인 (specs/002-nearby-events FR-011, contracts/venue-geocode.md)
 * - 확인 대기(pending) 먼저. 후보 고르기 · 좌표 붙여넣기 · 찾을 수 없음 · 다른 장소로 합치기
 * - 모든 변경에 확인한 관리자 이메일·시각을 남긴다. venues 쓰기는 RLS 로 관리자만 된다.
 */

type Candidate = { name: string; address: string; lat: number | null; lng: number | null };
type Venue = {
    id: string;
    name: string;
    aliases: string[];
    region: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    geo_status: "pending" | "confirmed" | "failed";
    geo_source: string | null;
    candidates: Candidate[] | null;
    checked_by: string | null;
    checked_at: string | null;
    closed_days: string | null;
    capacity: number | null;
    district: string | null;
};

const STATUS_KO = { pending: "확인 대기", confirmed: "확정", failed: "찾을 수 없음" } as const;
const ORDER = { pending: 0, failed: 1, confirmed: 2 } as const;

/** 공간 정보(휴관일·객석·구·군). 공개 화면의 «공간 정보»에 나온다. 공식 안내에서 확인한 것만 적는다 */
function VenueInfo({ v, onSaved }: { v: Venue; onSaved: (patch: Partial<Venue>) => void }) {
    const [closed, setClosed] = useState(v.closed_days || "");
    const [cap, setCap] = useState(v.capacity != null ? String(v.capacity) : "");
    const [district, setDistrict] = useState(v.district || "");
    const [msg, setMsg] = useState("");
    const dirty = closed !== (v.closed_days || "") || cap !== (v.capacity != null ? String(v.capacity) : "") || district !== (v.district || "");
    const save = async () => {
        const n = cap.trim() ? Number(cap) : null;
        if (n !== null && (!Number.isInteger(n) || n <= 0 || n > 100000)) { setMsg("객석 수는 숫자로 넣어 주세요."); return; }
        const patch = { closed_days: closed.trim() || null, capacity: n, district: district.trim() || null };
        const { data, error } = await supabase.from("venues").update(patch).eq("id", v.id).select("id");
        if (error || !data?.length) { setMsg(`저장하지 못했습니다: ${error?.message || "권한 확인"}`); return; }
        setMsg("저장했습니다."); onSaved(patch);
    };
    const input = "h-9 rounded-lg bg-neutral-50 px-2 text-sm ring-1 ring-neutral-200";
    return (
        <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">휴관일<br /><input className={`${input} w-40 max-w-full`} value={closed} onChange={e => setClosed(e.target.value)} placeholder="예: 매주 월요일" maxLength={60} /></label>
            <label className="text-xs text-neutral-500">객석<br /><input className={`${input} w-20`} value={cap} onChange={e => setCap(e.target.value)} inputMode="numeric" placeholder="석" /></label>
            <label className="text-xs text-neutral-500">구·군<br /><input className={`${input} w-28`} value={district} onChange={e => setDistrict(e.target.value)} placeholder="예: 해운대구" maxLength={20} /></label>
            {dirty && <button type="button" className="h-9 rounded-lg bg-neutral-900 px-3 text-xs font-bold text-white" onClick={save}>공간 정보 저장</button>}
            {msg && <span className="pb-2 text-xs text-neutral-500" role="status">{msg}</span>}
        </div>
    );
}

function naverSearch(v: Venue) {
    return `https://map.naver.com/p/search/${encodeURIComponent(`${v.name} ${v.region || ""}`.trim())}`;
}

export default function AdminVenuesPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"pending" | "failed" | "confirmed" | "all">("pending");
    const [email, setEmail] = useState<string>("admin");
    const [paste, setPaste] = useState<Record<string, string>>({});
    const [mergeTo, setMergeTo] = useState<Record<string, string>>({});

    const load = async () => {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);
        const { data, error: err } = await supabase.from("venues").select("*").limit(2000);
        if (err) {
            setError(`장소 목록을 읽지 못했습니다: ${err.message} (관리자 로그인이 필요합니다)`);
            setLoading(false);
            return;
        }
        // 행사 수: 1,000건씩 끝까지 읽는다(공개 행사가 1,000건을 넘어 수가 모자라게 세어졌다, specs/019 FR-009)
        const c: Record<string, number> = {};
        for (let from = 0; ; from += 1000) {
            const { data: ev } = await supabase.from("events").select("venue_id").eq("status", "PUBLISHED").not("venue_id", "is", null).order("id").range(from, from + 999);
            for (const e of ev || []) c[e.venue_id] = (c[e.venue_id] || 0) + 1;
            if (!ev || ev.length < 1000) break;
        }
        setCounts(c);
        setVenues(((data || []) as Venue[]).sort((a, b) => ORDER[a.geo_status] - ORDER[b.geo_status] || (c[b.id] || 0) - (c[a.id] || 0)));
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, []);

    const stamp = () => ({ checked_by: email, checked_at: new Date().toISOString() });

    const update = async (id: string, patch: Partial<Venue>) => {
        const { error: err } = await supabase.from("venues").update({ ...patch, ...stamp() }).eq("id", id);
        if (err) { alert(`저장 실패: ${err.message}`); return; }
        await load();
    };

    const confirmCandidate = (v: Venue, c: Candidate) =>
        update(v.id, { geo_status: "confirmed", geo_source: "naver", lat: c.lat, lng: c.lng, address: c.address, candidates: null });

    const confirmPasted = (v: Venue) => {
        const m = (paste[v.id] || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (!m) { alert("좌표를 「위도,경도」 모양으로 넣어 주세요. 예: 35.1532,129.1186"); return; }
        const lat = Number(m[1]), lng = Number(m[2]);
        if (lat < 34.4 || lat > 35.95 || lng < 127.5 || lng > 129.4) { alert("부산·경남 범위 밖 좌표입니다."); return; }
        update(v.id, { geo_status: "confirmed", geo_source: "manual", lat, lng, candidates: null });
    };

    const merge = async (v: Venue) => {
        const target = venues.find(x => x.id === mergeTo[v.id]);
        if (!target) return;
        if (!confirm(`「${v.name}」을(를) 「${target.name}」에 합칩니다.\n연결된 행사 ${counts[v.id] || 0}건이 옮겨지고, 「${v.name}」 장소 줄은 지워집니다. 되돌릴 수 없습니다.`)) return;
        const aliases = [...new Set([...(target.aliases || []), v.name, ...(v.aliases || [])])];
        const r1 = await supabase.from("venues").update({ aliases, ...stamp() }).eq("id", target.id);
        if (r1.error) { alert(`합치기 실패: ${r1.error.message}`); return; }
        const r2 = await supabase.from("events").update({ venue_id: target.id }).eq("venue_id", v.id);
        if (r2.error) { alert(`행사 옮기기 실패: ${r2.error.message}`); return; }
        const r3 = await supabase.from("venues").delete().eq("id", v.id);
        if (r3.error) { alert(`옛 장소 지우기 실패: ${r3.error.message}`); return; }
        await load();
    };

    const shown = useMemo(() => venues.filter(v => filter === "all" || v.geo_status === filter), [venues, filter]);
    const n = (s: Venue["geo_status"]) => venues.filter(v => v.geo_status === s).length;

    return (
        <div className="pb-10">
            <div className="container mx-auto px-4 pt-8">
                <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
                    <MapPin className="w-8 h-8 text-indigo-600" /> 장소 좌표 확인
                </h1>
                <p className="text-neutral-500 mt-2">
                    「내 주변」 거리 계산에 쓰는 장소 좌표입니다. 확정된 장소만 공개 화면에 거리가 표시됩니다.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                    {(["pending", "failed", "confirmed", "all"] as const).map(f => (
                        <button key={f} type="button" onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold ${filter === f ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-neutral-200 text-neutral-700"}`}>
                            {f === "all" ? `전체 ${venues.length}` : `${STATUS_KO[f]} ${n(f)}`}
                        </button>
                    ))}
                </div>

                {error && <p className="mt-6 text-red-600 font-bold">{error}</p>}
                {loading ? <p className="mt-6 text-neutral-500">불러오는 중…</p> : (
                    <ul className="mt-6 flex flex-col gap-4">
                        {shown.map(v => (
                            <li key={v.id} className="bg-white p-5 rounded-2xl ring-1 ring-neutral-200">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-lg font-black text-neutral-900">{v.name}</span>
                                    <span className="text-sm text-neutral-500">{v.region || "-"} · 행사 {counts[v.id] || 0}건</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${v.geo_status === "confirmed" ? "bg-green-100 text-green-700" : v.geo_status === "failed" ? "bg-neutral-200 text-neutral-700" : "bg-amber-100 text-amber-800"}`}>
                                        {STATUS_KO[v.geo_status]}{v.geo_source ? ` · ${v.geo_source}` : ""}
                                    </span>
                                    <a className="text-sm text-indigo-600 underline" href={naverSearch(v)} target="_blank" rel="noopener noreferrer">네이버지도에서 찾기</a>
                                </div>
                                {v.aliases?.length > 0 && <p className="mt-1 text-xs text-neutral-500">원래 표기: {v.aliases.join(" / ")}</p>}
                                {v.geo_status === "confirmed" && (
                                    <p className="mt-1 text-sm text-neutral-700">{v.address || "-"} ({v.lat?.toFixed(5)}, {v.lng?.toFixed(5)})</p>
                                )}
                                {v.checked_by && <p className="mt-1 text-xs text-neutral-400">확인: {v.checked_by} · {v.checked_at?.slice(0, 16).replace("T", " ")}</p>}
                                {v.geo_status === "confirmed" && <VenueInfo v={v} onSaved={(patch) => setVenues(list => list.map(x => x.id === v.id ? { ...x, ...patch } : x))} />}

                                {v.candidates && v.candidates.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-1">
                                        <span className="text-xs font-bold text-neutral-500">검색 후보</span>
                                        {v.candidates.map((c, i) => (
                                            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                                                <span className="font-bold">{c.name}</span>
                                                <span className="text-neutral-500">{c.address}</span>
                                                {c.lat !== null && (
                                                    <button type="button" className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs" onClick={() => confirmCandidate(v, c)}>
                                                        이 위치로 확정
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <input
                                        className="h-9 px-3 rounded-lg bg-neutral-50 ring-1 ring-neutral-200 text-sm w-56"
                                        placeholder="위도,경도 (예: 35.1532,129.1186)"
                                        value={paste[v.id] || ""}
                                        onChange={e => setPaste({ ...paste, [v.id]: e.target.value })}
                                    />
                                    <button type="button" className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold" onClick={() => confirmPasted(v)}>좌표로 확정</button>
                                    {v.geo_status !== "failed" && (
                                        <button type="button" className="px-3 h-9 rounded-lg bg-neutral-200 text-neutral-800 text-xs font-bold" onClick={() => update(v.id, { geo_status: "failed" })}>찾을 수 없음</button>
                                    )}
                                    {v.geo_status === "confirmed" && (
                                        <button type="button" className="px-3 h-9 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold" onClick={() => update(v.id, { geo_status: "pending" })}>다시 확인</button>
                                    )}
                                    <select
                                        className="h-9 max-w-full px-2 rounded-lg bg-neutral-50 ring-1 ring-neutral-200 text-sm"
                                        value={mergeTo[v.id] || ""}
                                        onChange={e => setMergeTo({ ...mergeTo, [v.id]: e.target.value })}
                                        aria-label="합칠 장소"
                                    >
                                        <option value="">같은 장소로 합치기…</option>
                                        {venues.filter(x => x.id !== v.id && x.region === v.region && x.geo_status === "confirmed").map(x => (
                                            <option key={x.id} value={x.id}>{x.name}</option>
                                        ))}
                                    </select>
                                    {mergeTo[v.id] && (
                                        <button type="button" className="px-3 h-9 rounded-lg bg-red-50 text-red-700 text-xs font-bold" onClick={() => merge(v)}>합치기</button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
