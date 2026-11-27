import { supabase } from "@/lib/supabase";
import { checkMissedRun, latestRunRows, splitCollectorAlerts, type CollectorAlert, type CollectorRun, type MissedRun } from "@/lib/opsStats";
import { todayKST } from "@/lib/utils";

/**
 * 관리자 «오늘 할 일»과 메뉴 숫자에 쓰는 대기 건수 (specs/019 A1·A2).
 * 사람 몫만 센다: 자동화(정기 실행)가 판단하지 못해 넘긴 것과 사람이 보낸 것.
 * 건수는 count 질의로 세므로 1,000줄 한계에 걸리지 않는다. 한 종류가 실패해도 나머지는 보여 준다(errors).
 */
export type QueueGroup = "publish" | "received" | "refine";
export type QueueItem = {
    key: string;
    group: QueueGroup;
    label: string;
    hint: string;            // 무엇인지 한 줄
    count: number;
    oldest: string | null;   // 가장 오래 기다린 것의 날짜(ISO). 모르면 null
    href: string;
};
export type RoutineLine = {
    missed: MissedRun;            // 마지막 정기 실행이 언제였는지
    openAlerts: CollectorAlert[]; // 켜진 경고
    lastRunFailed: number;        // 마지막 회차에서 실패한 출처 수
    lastRunSources: number;       // 마지막 회차에서 본 출처 수
};
export type AdminCounts = { loadedAt: string; items: QueueItem[]; routine: RoutineLine; errors: string[] };

export const GROUP_LABEL: Record<QueueGroup, string> = { publish: "공개 판단", received: "받은 것", refine: "정보 다듬기" };

type Counted = { count: number; oldest: string | null };

async function reviewBucket(bucket: string): Promise<Counted> {
    const base = () => supabase.from("raw_posts").select("collected_at", { count: "exact" }).eq("status", "REVIEW").eq("content->>review_bucket", bucket);
    const { data, count, error } = await base().order("collected_at", { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    return { count: count || 0, oldest: (data?.[0]?.collected_at as string) || null };
}

async function collectedWaiting(): Promise<Counted> {
    const { data, count, error } = await supabase.from("raw_posts").select("collected_at", { count: "exact" })
        .in("status", ["COLLECTED", "PENDING"]).order("collected_at", { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    return { count: count || 0, oldest: (data?.[0]?.collected_at as string) || null };
}

async function byCreated(table: string, apply: (q: any) => any): Promise<Counted> {   // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, count, error } = await apply(supabase.from(table).select("created_at", { count: "exact" }))
        .order("created_at", { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    return { count: count || 0, oldest: (data?.[0]?.created_at as string) || null };
}

async function countOnly(table: string, apply: (q: any) => any): Promise<number> {   // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count, error } = await apply(supabase.from(table).select("id", { count: "exact", head: true }));
    if (error) throw new Error(error.message);
    return count || 0;
}

export async function fetchAdminCounts(): Promise<AdminCounts> {
    const errors: string[] = [];
    const safe = async <T,>(name: string, p: Promise<T>, fallback: T): Promise<T> => {
        try { return await p; } catch (e) { errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); return fallback; }
    };
    const zero: Counted = { count: 0, oldest: null };
    const today = todayKST();

    const [candidate, human, consent, collected, leaflets, reports, partners, genre, venuesPending, venuesFailed, placeholders, snaps] = await Promise.all([
        safe("공개 후보", reviewBucket("candidate"), zero),
        safe("사람 판단", reviewBucket("human"), zero),
        safe("동의 필요", reviewBucket("consent"), zero),
        safe("자동 공개 대기", collectedWaiting(), zero),
        safe("리플렛", byCreated("leaflet_submissions", q => q.in("status", ["uploaded", "read"])), zero),
        safe("신고·제보", byCreated("reports", q => q.eq("status", "new")), zero),
        safe("협약 신청", byCreated("partner_agreements", q => q.or("status.eq.new,and(withdraw_requested_at.not.is.null,status.neq.withdrawn)")), zero),
        safe("세부 갈래", countOnly("events", q => q.eq("status", "PUBLISHED").eq("subcategory_pending", true).gte("event_date_end", today)), 0),
        safe("장소 확인", countOnly("venues", q => q.eq("geo_status", "pending")), 0),
        safe("장소 찾지 못함", countOnly("venues", q => q.eq("geo_status", "failed")), 0),
        safe("안내 그림 후보", (async () => {
            const { data, error } = await supabase.rpc("poster_dup_candidates", { p_min: 4 });
            if (error) throw new Error(error.message);
            return ((data || []) as { marked: boolean }[]).filter(r => !r.marked).length;
        })(), 0),
        safe("실행 기록", (async () => {
            const { data, error } = await supabase.from("ops_snapshots").select("name,data").in("name", ["collector_runs", "collector_alerts"]);
            if (error) throw new Error(error.message);
            return Object.fromEntries((data || []).map(r => [r.name as string, (r.data as { rows?: unknown[] } | null)?.rows || []]));
        })(), {} as Record<string, unknown[]>),
    ]);

    const runs = (snaps["collector_runs"] || []) as CollectorRun[];
    const alerts = (snaps["collector_alerts"] || []) as CollectorAlert[];
    const last = latestRunRows(runs).filter(r => r.kind !== "publish");
    const routine: RoutineLine = {
        missed: checkMissedRun(runs, Date.now()),
        openAlerts: splitCollectorAlerts(alerts, Date.now(), 7).open,
        lastRunFailed: last.filter(r => (r.status || "").toUpperCase().includes("FAIL")).length,
        lastRunSources: last.length,
    };

    const items: QueueItem[] = [
        { key: "candidate", group: "publish", label: "공개 후보", hint: "인스타 · 기관 계정이고 날짜·장소가 있는 것", ...candidate, href: "/admin/inbox?tab=candidate" },
        { key: "human", group: "publish", label: "사람 판단", hint: "날짜가 없거나 정보 계정이 올린 것", ...human, href: "/admin/inbox?tab=human" },
        { key: "consent", group: "publish", label: "동의 필요", hint: "소규모 단체·예술인 게시물 — 허락을 받아야 실림", ...consent, href: "/admin/inbox?tab=consent" },
        { key: "collected", group: "publish", label: "자동 공개 대기", hint: "날짜가 없거나 60일 밖이라 자동 공개에서 빠진 것", ...collected, href: "/admin/inbox?tab=pending" },
        { key: "leaflets", group: "received", label: "리플렛", hint: "사이트·카카오톡으로 받은 리플렛", ...leaflets, href: "/admin/leaflets" },
        { key: "reports", group: "received", label: "신고·제보", hint: "오류 신고와 행사 제보", ...reports, href: "/admin/reports" },
        { key: "partners", group: "received", label: "협약 신청", hint: "단체 동의 양식과 철회 요청", ...partners, href: "/admin/partners" },
        { key: "genre", group: "refine", label: "세부 갈래", hint: "규칙으로 정하지 못한 진행 중 행사", count: genre, oldest: null, href: "/admin/refine#genre-pending" },
        { key: "venues", group: "refine", label: "장소 확인", hint: `후보에서 고르기${venuesFailed ? ` · 찾지 못함 ${venuesFailed}곳은 따로` : ""}`, count: venuesPending, oldest: null, href: "/admin/venues" },
        { key: "placeholders", group: "refine", label: "안내 그림 후보", hint: "여러 행사에 같은 그림 — 포스터가 아닐 수 있음", count: placeholders, oldest: null, href: "/admin/refine#placeholder-images" },
    ];
    return { loadedAt: new Date().toISOString(), items, routine, errors };
}

/** 메뉴 숫자: «할 일»에는 사람이 보내고 기다리는 것(받은 것)만, 현황에는 켜진 경고 수 */
export function menuBadges(c: AdminCounts | null): { queue: number; status: number } {
    if (!c) return { queue: 0, status: 0 };
    return {
        queue: c.items.filter(i => i.group === "received").reduce((n, i) => n + i.count, 0),
        status: c.routine.openAlerts.length + (c.routine.missed.state === "missed" ? 1 : 0),
    };
}
