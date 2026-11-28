import { supabase } from "@/lib/supabase";
import type { CollectorAlert, MissedRun } from "@/lib/opsStats";

/**
 * 수집기 경고 «확인» (운영자 2026-11-28 «확인 하면 없어지는 걸로»).
 * 확인한 경고의 열쇠를 ops_alert_acks 에 남기고, 메뉴 숫자와 운영 현황 «살펴볼 것»에서 뺀다.
 * 열쇠 = 규칙|대상|켜진 시각 → 같은 문제가 나중에 다시 켜지면(켜진 시각이 바뀌면) 다시 보인다.
 */
export const collectorAlertKey = (c: CollectorAlert) => `${c.rule}|${c.target || ""}|${c.since || ""}`;
export const missedRunKey = (m: MissedRun) => (m.state === "missed" ? `missed_run||${m.lastRunAt}` : "");

/** 확인한 경고 열쇠들. 표가 아직 없거나 읽지 못하면 빈 집합(경고는 그대로 보인다) */
export async function fetchAlertAcks(): Promise<Set<string>> {
    const { data, error } = await supabase.from("ops_alert_acks").select("key").limit(1000);
    if (error) return new Set();
    return new Set((data || []).map(r => r.key as string));
}

export async function ackAlert(key: string, text: string): Promise<string | null> {
    const { error } = await supabase.from("ops_alert_acks").upsert({ key, text: text.slice(0, 500) }, { onConflict: "key", ignoreDuplicates: true });
    return error ? error.message : null;
}

export async function unackAlert(key: string): Promise<string | null> {
    const { error } = await supabase.from("ops_alert_acks").delete().eq("key", key);
    return error ? error.message : null;
}
