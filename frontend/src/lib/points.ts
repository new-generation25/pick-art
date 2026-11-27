/**
 * 활동 포인트 (specs/021). 표: public.point_ledger (supabase/migrations/20261127140000_points.sql)
 * 적립은 DB 트리거만 한다(제보가 «반영함»이 될 때 +100). 화면은 읽기만 한다.
 */
import { supabase } from "@/lib/supabase";

export type MyPoints = { points: number; rank: number | null; ranked: number };
export type LedgerRow = { id: string; amount: number; reason: string; created_at: string };

export const POINT_REASON: Record<string, string> = { tip: "행사 제보가 피카에 실림" };

/** 내 포인트 합계와 순위. 못 읽으면(로그인 전·함수 없음) null */
export async function fetchMyPoints(): Promise<MyPoints | null> {
    const { data, error } = await supabase.rpc("my_points");
    if (error || !data) return null;
    const d = data as { points?: number; rank?: number | null; ranked?: number };
    return { points: Number(d.points || 0), rank: d.rank == null ? null : Number(d.rank), ranked: Number(d.ranked || 0) };
}

/** 내 최근 적립 내역 */
export async function fetchMyLedger(userId: string, limit = 5): Promise<LedgerRow[]> {
    const { data } = await supabase.from("point_ledger").select("id,amount,reason,created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    return (data || []) as LedgerRow[];
}
