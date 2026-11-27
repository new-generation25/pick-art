"use client";

import { useEffect, useState } from "react";
import { Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { supabase } from "@/lib/supabase";

// «현황»에 더한 것 (specs/019 A6): 회차 요약(자동화가 한 일), 휴대폰 알림·회원 숫자.
// 회차 요약은 수집기가 정기 실행 끝에 남긴다(ops_snapshots.routine_steps, collector/ops_log.py record_steps).
// 알림·회원은 관리자만 부를 수 있는 집계 함수가 숫자만 돌려준다(누구인지는 돌려주지 않는다).

type Step = { name: string; text: string };
type Run = { run_at: string; head?: string; steps: Step[] };

const runLabel = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
};
// 수집기 요약 줄 앞의 표시(✅ ⚠️ ❌)는 겹쳐 붙어 있어 하나만 남긴다
const clean = (t: string) => t.replace(/^((✅|⚠️|❌)\s*)+/u, m => m.trim().split(/\s+/)[0] + " ").trim();

export function RoutineSteps() {
    const [runs, setRuns] = useState<Run[] | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error: err } = await supabase.from("ops_snapshots").select("data").eq("name", "routine_steps").maybeSingle();
            if (cancelled) return;
            if (err) { setError(err.message); setRuns([]); return; }
            const rows = (data?.data as { rows?: Run[] } | undefined)?.rows;
            setRuns(Array.isArray(rows) ? rows : []);
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <Paper withBorder radius="md" p="md" id="routine-steps">
            <Title order={4}>회차 요약 — 자동화가 한 일</Title>
            <Text size="xs" c="dimmed" mb="sm">정기 실행(매일 08:20·15:00)이 끝날 때 단계마다 한 줄씩 남깁니다. 최근 14회.</Text>
            {error && <Text size="sm" className="pica-err">읽지 못했습니다: {error}</Text>}
            {runs && runs.length === 0 && !error && <Text size="sm" c="dimmed">아직 남긴 회차가 없습니다. 다음 정기 실행부터 쌓입니다.</Text>}
            {(runs || []).map((r, i) => (
                <details key={r.run_at} open={i === 0} style={{ borderTop: i ? "1px solid var(--mantine-color-gray-2)" : undefined, padding: "8px 0" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                        {runLabel(r.run_at)} 회차
                        {r.head && <span style={{ fontWeight: 500, color: "var(--mantine-color-dimmed)", marginLeft: 8, fontSize: 13 }}>{clean(r.head).replace(/^(✅|⚠️|❌)\s*/u, "")}</span>}
                    </summary>
                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                        {r.steps.map((s, k) => (
                            <div key={k} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.5, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, flex: "0 0 132px" }}>{s.name || "기타"}</span>
                                <span style={{ flex: "1 1 240px", minWidth: 0, wordBreak: "break-word" }}>{clean(s.text)}</span>
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </Paper>
    );
}

type PushStats = { devices: number; users: number; failing: number; sent: { day: string; kind: string; n: number }[] };
type MemberStats = { members: number; admins: number; new_7d: number; new_30d: number; with_region: number; favorites: number; favorite_users: number; venue_follows: number; venue_follow_users: number };
const KIND_LABEL: Record<string, string> = { favorite_eve: "찜한 행사 전날", weekend: "주말 행사 요약", venue_new: "찜한 장소 새 행사" };

function Num({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
    return (
        <div>
            <Text size="xs" c="dimmed">{label}</Text>
            <Text fw={800} size="xl" style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{typeof value === "number" ? value.toLocaleString("ko-KR") : value}</Text>
            {sub && <Text size="xs" c="dimmed">{sub}</Text>}
        </div>
    );
}

export function PushMemberStats() {
    const [push, setPush] = useState<PushStats | null>(null);
    const [members, setMembers] = useState<MemberStats | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [p, m] = await Promise.all([supabase.rpc("admin_push_stats"), supabase.rpc("admin_member_stats")]);
            if (cancelled) return;
            if (p.error || m.error) setError((p.error || m.error)!.message);
            setPush((p.data as PushStats) || null); setMembers((m.data as MemberStats) || null);
        })();
        return () => { cancelled = true; };
    }, []);

    const [nowMs] = useState(() => Date.now());   // 그리는 동안 시각이 바뀌지 않게 한 번만 읽는다
    const since = (days: number) => new Date(nowMs + 9 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);
    const sentIn = (kind: string, days: number) => (push?.sent || []).filter(s => s.kind === kind && s.day >= since(days)).reduce((n, s) => n + s.n, 0);

    return (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md" id="push-stats">
                <Title order={4}>휴대폰 알림</Title>
                <Text size="xs" c="dimmed" mb="sm">켠 기기 수와 최근 보낸 알림 수입니다. 누구에게 보냈는지는 여기 나오지 않습니다.</Text>
                {error && <Text size="sm" className="pica-err">읽지 못했습니다: {error}</Text>}
                {push && (
                    <>
                        <SimpleGrid cols={3} spacing="sm">
                            <Num label="알림 켠 기기" value={push.devices} />
                            <Num label="알림 켠 회원" value={push.users} />
                            <Num label="보내기 실패 중인 기기" value={push.failing} sub="10번 실패하면 구독을 지움" />
                        </SimpleGrid>
                        <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
                            {Object.keys(KIND_LABEL).map(k => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5 }}>
                                    <span>{KIND_LABEL[k]}</span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>최근 7일 <b>{sentIn(k, 7)}</b>통 · 30일 <b>{sentIn(k, 30)}</b>통</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Paper>
            <Paper withBorder radius="md" p="md" id="member-stats">
                <Title order={4}>회원</Title>
                <Text size="xs" c="dimmed" mb="sm">숫자만 봅니다. 한 명씩 보려면 <a href="/admin/members" style={{ color: "inherit", textDecoration: "underline" }}>회원 목록</a>으로 가세요.</Text>
                {members && (
                    <SimpleGrid cols={3} spacing="sm">
                        <Num label="가입 회원" value={members.members} sub={`관리자 ${members.admins}명 포함`} />
                        <Num label="최근 7일 가입" value={members.new_7d} sub={`30일 ${members.new_30d}명`} />
                        <Num label="내 지역 정함" value={members.with_region} />
                        <Num label="찜한 행사" value={members.favorites} sub={`회원 ${members.favorite_users}명`} />
                        <Num label="찜한 장소" value={members.venue_follows} sub={`회원 ${members.venue_follow_users}명`} />
                    </SimpleGrid>
                )}
            </Paper>
        </SimpleGrid>
    );
}
