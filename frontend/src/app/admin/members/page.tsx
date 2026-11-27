"use client";

// 현황 › 회원 (specs/019 FR-033, 2026-11-27 운영자 요청). 가입한 회원을 목록으로 본다.
// 보이는 것: 별명, 역할, 가입일, 내 지역, 관심 분야, 휴대폰 알림 설정. 읽기만 한다(고치는 버튼 없음).
// 보이지 않는 것: 이메일(로그인 계정 쪽에 있어 이 화면이 읽지 않는다), 전화번호, 찜한 행사·장소(본인만 읽는 표).
// profiles 는 관리자만 전체를 읽는다(supabase/migrations/20261101030000_security_rls.sql «Admin read profiles»).

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Member = {
    id: string; nickname: string | null; role: string | null; region: string | null; auto_region: boolean | null;
    interests: string[] | null; created_at: string;
    push_favorites: boolean | null; push_venues: boolean | null; push_weekend: boolean | null;
};
const COLS = "id,nickname,role,region,auto_region,interests,created_at,push_favorites,push_venues,push_weekend";
const PAGE = 50;
type Role = "" | "admin" | "user";

const day = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
};

export default function AdminMembersPage() {
    const [typed, setTyped] = useState("");
    const [q, setQ] = useState("");
    const [role, setRole] = useState<Role>("");
    const [rows, setRows] = useState<Member[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    // 활동 포인트 (specs/021): 회원 id → 합계. 포인트가 있는 회원만 들어 있다
    const [points, setPoints] = useState<Record<string, number>>({});

    useEffect(() => {
        supabase.rpc("admin_member_points").then(({ data }) => {
            const map: Record<string, number> = {};
            for (const r of (data || []) as { user_id: string; points: number }[]) map[r.user_id] = Number(r.points);
            setPoints(map);
        });
    }, []);

    const fetchRows = useCallback(async (from: number) => {
        let qy = supabase.from("profiles").select(COLS, { count: "exact" });
        const text = q.replace(/[,()%*\\]/g, " ").trim();
        if (text) qy = qy.ilike("nickname", `%${text}%`);
        if (role) qy = qy.eq("role", role);
        return qy.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    }, [q, role]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, count, error: err } = await fetchRows(0);
            if (cancelled) return;
            setError(err ? `읽지 못했습니다: ${err.message}` : "");
            setRows((data || []) as Member[]); setTotal(count || 0); setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchRows]);

    const more = async () => {
        setBusy(true);
        const { data } = await fetchRows(rows.length);
        setBusy(false);
        setRows(prev => [...prev, ...((data || []) as Member[])]);
    };

    const sel = "h-9 max-w-full rounded-full border-0 bg-card px-3 text-[13.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]";
    return (
        <div className="mx-auto max-w-5xl px-4 pt-4">
            <h1 className="pica-display text-[25px] leading-tight text-ink">회원</h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">가입한 회원입니다. 최근 가입한 순서로 보입니다. 이메일·전화번호와 찜한 행사·장소는 이 화면에 나오지 않습니다. 별명 옆 숫자는 활동 포인트(제보가 실리면 100P)입니다.</p>

            <form className="mt-3 flex flex-wrap items-center gap-1.5" onSubmit={e => { e.preventDefault(); setLoading(true); setQ(typed); }}>
                <label className="flex h-9 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-full bg-card px-3 shadow-[0_1px_4px_rgba(30,26,21,.1)]">
                    <Search size={15} className="shrink-0 text-ink-soft" aria-hidden />
                    <input className="min-w-0 flex-1 bg-transparent text-[14px] text-ink !outline-none" placeholder="별명으로 찾기" value={typed} onChange={e => setTyped(e.currentTarget.value)} aria-label="회원 찾기" />
                </label>
                <select className={sel} value={role} onChange={e => { setLoading(true); setRole(e.currentTarget.value as Role); }} aria-label="역할">
                    <option value="">역할 전체</option><option value="user">일반 회원</option><option value="admin">관리자</option>
                </select>
                <button type="submit" className="h-9 rounded-full bg-ink px-3.5 text-[13.5px] font-bold text-paper">찾기</button>
            </form>

            {error && <p className="mt-3 rounded-xl border-[1.5px] border-[#b5432f] bg-card px-3 py-2 text-[13.5px] text-ink" role="alert">{error}</p>}
            <p className="mt-3 px-1 text-[13px] text-ink-soft" role="status">
                {loading ? "찾는 중…" : <><b className="pica-num text-ink">{total.toLocaleString("ko-KR")}</b>명{rows.length < total ? ` 중 ${rows.length}명 보는 중` : ""}</>}
            </p>
            {!loading && rows.length === 0 && <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">조건에 맞는 회원이 없습니다.</p>}

            <div className="mt-2 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                {rows.map((m, i) => {
                    const push = [m.push_favorites && "찜한 행사 전날", m.push_venues && "찜한 장소 새 행사", m.push_weekend && "주말 요약"].filter(Boolean) as string[];
                    return (
                        <div key={m.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
                            <span className="min-w-0 flex-1 basis-[200px]">
                                <span className="text-[15px] font-semibold text-ink" style={{ wordBreak: "break-word" }}>{m.nickname?.trim() || "별명 없음"}</span>
                                {m.role === "admin" && <span className="ml-2 rounded-md bg-[var(--pk-accent-soft)] px-1.5 py-0.5 text-[11.5px] font-bold text-accent">관리자</span>}
                                {points[m.id] ? <span className="pica-num ml-2 text-[13px] font-bold text-accent">{points[m.id].toLocaleString("ko-KR")}P</span> : null}
                                <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                                    가입 {day(m.created_at)} · 내 지역 {m.region || "정하지 않음"}{m.region && m.auto_region ? " (먼저 보기 켬)" : ""}
                                </span>
                            </span>
                            <span className="min-w-0 basis-[260px] text-[12.5px] text-ink-soft">
                                <span className="block">관심 분야: <span className="text-ink">{m.interests?.length ? m.interests.join(" · ") : "고르지 않음"}</span></span>
                                <span className="block">휴대폰 알림 설정: <span className="text-ink">{push.length ? push.join(" · ") : "모두 끔"}</span></span>
                            </span>
                        </div>
                    );
                })}
            </div>
            {rows.length < total && !loading && (
                <div className="mt-3 text-center">
                    <button type="button" disabled={busy} onClick={more} className="h-9 rounded-full border border-line bg-card px-4 text-[13.5px] font-semibold text-ink disabled:opacity-50">더 보기 ({rows.length}/{total})</button>
                </div>
            )}
            <p className="mt-4 px-1 text-[12.5px] text-ink-soft">알림 설정은 회원이 고른 값입니다. 실제로 알림을 받는 기기 수는 «운영 현황»의 «휴대폰 알림»에 있습니다.</p>
        </div>
    );
}
