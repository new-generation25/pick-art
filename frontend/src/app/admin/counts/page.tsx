"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Group, Select, Button, Table, Loader, Anchor, Paper } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { monthRange, totalsByEvent, toCsv, type CountRow, type EventTotal } from "@/lib/eventCounts";

// 행사별 노출·클릭 (specs/011·012). event_counts_daily 는 관리자만 읽는다(RLS).
// 표기는 «노출(상세 조회)·클릭(원본 열기·캘린더·공유)». 관객 수·예매가 아니다. 누구나 부를 수 있는 집계라 근사치다
const VERCEL_ANALYTICS = "https://vercel.com/new-generation25s-projects/pick-art/analytics";

type EventInfo = { id: string; title: string; venue: string | null; event_date_start: string | null; event_date_end: string | null };
type Org = { id: string; name: string; kind: string };

function thisMonth() {
    const d = new Date(Date.now() + 9 * 3600 * 1000); // 한국 날짜
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function recentMonths(n: number) {
    const [y, m] = thisMonth().split("-").map(Number);
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(y, m - 1 - i, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    });
}

export default function AdminCountsPage() {
    const [month, setMonth] = useState(thisMonth());
    const [orgId, setOrgId] = useState<string | null>(null);
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [orgEvents, setOrgEvents] = useState<Set<string> | null>(null);
    const [totals, setTotals] = useState<EventTotal[] | null>(null);
    const [info, setInfo] = useState<Map<string, EventInfo>>(new Map());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        supabase.from("orgs").select("id, name, kind").order("name").limit(2000)
            .then(({ data }) => setOrgs((data || []) as Org[]));
    }, []);

    useEffect(() => {
        if (!orgId) { setOrgEvents(null); return; }
        supabase.from("event_orgs").select("event_id").eq("org_id", orgId).limit(5000)
            .then(({ data }) => setOrgEvents(new Set((data || []).map(r => r.event_id as string))));
    }, [orgId]);

    const load = useCallback(async () => {
        setTotals(null); setError(null);
        const { from, to } = monthRange(month);
        const rows: CountRow[] = [];
        for (let page = 0; ; page++) {
            const { data, error } = await supabase.from("event_counts_daily").select("event_id, day, kind, n")
                .gte("day", from).lte("day", to).range(page * 1000, page * 1000 + 999);
            if (error) { setError(error.message); break; }
            rows.push(...((data || []) as CountRow[]));
            if (!data || data.length < 1000) break;
        }
        const t = totalsByEvent(rows);
        setTotals(t);
        const ids = t.map(x => x.event_id);
        const map = new Map<string, EventInfo>();
        for (let i = 0; i < ids.length; i += 200) {
            const { data } = await supabase.from("events").select("id, title, venue, event_date_start, event_date_end").in("id", ids.slice(i, i + 200));
            for (const e of (data || []) as EventInfo[]) map.set(e.id, e);
        }
        setInfo(map);
    }, [month]);

    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => (totals || []).filter(t => !orgEvents || orgEvents.has(t.event_id)), [totals, orgEvents]);
    const sum = useMemo(() => shown.reduce((a, t) => ({ view: a.view + t.view, clicks: a.clicks + t.clicks }), { view: 0, clicks: 0 }), [shown]);
    const orgName = orgs.find(o => o.id === orgId)?.name;

    const download = () => {
        const header = ["행사", "장소", "기간", "노출(상세 조회)", "원본 안내 열기", "캘린더 추가", "공유", "클릭 합계", "피카 상세 주소"];
        const rows = shown.map(t => {
            const e = info.get(t.event_id);
            return [e?.title ?? t.event_id, e?.venue ?? "", [e?.event_date_start, e?.event_date_end].filter(Boolean).join("~"),
                t.view, t.outbound, t.calendar, t.share, t.clicks, `https://picka.news/events/${t.event_id}`];
        });
        const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `pica_노출클릭_${month}${orgName ? `_${orgName}` : ""}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <Container fluid px={0} pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
                <div>
                    <Title order={1} fw={900}>노출·클릭</Title>
                    <Text c="dimmed" size="sm">
                        행사별 «노출(상세 조회)»과 «클릭(원본 안내 열기·캘린더 추가·공유)». 날짜별 숫자만 세고 사람은 구분하지 않습니다(근사치, 관리자 접속 제외).
                        사이트 전체 방문자는 <Anchor href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer">Vercel Analytics</Anchor>에서 봅니다.
                    </Text>
                </div>
                <Group gap="xs" align="flex-end">
                    <Select label="달" value={month} onChange={v => v && setMonth(v)} data={recentMonths(12)} w={120} allowDeselect={false} />
                    <Select label="단체" placeholder="전체" searchable clearable value={orgId} onChange={setOrgId}
                        data={orgs.map(o => ({ value: o.id, label: `${o.name} (${o.kind})` }))} w={260} nothingFoundMessage="없음" />
                    <Button variant="light" onClick={download} disabled={!shown.length}>CSV 내려받기</Button>
                </Group>
            </Group>
            {error && <Text className="pica-err" mb="md">{error}</Text>}
            {totals === null ? <Loader size="sm" /> : (
                <>
                    <Paper withBorder p="sm" mb="md">
                        <Text size="sm">{month}{orgName ? ` · ${orgName}` : ""} — 행사 {shown.length}건 · 노출 {sum.view.toLocaleString()} · 클릭 {sum.clicks.toLocaleString()}</Text>
                    </Paper>
                    {shown.length === 0 ? <Text c="dimmed">이 달에 센 숫자가 없습니다.</Text> : (
                        <Table.ScrollContainer minWidth={720}>
                            <Table striped highlightOnHover verticalSpacing="xs">
                                <Table.Thead>
                                    <Table.Tr><Table.Th>행사</Table.Th><Table.Th ta="right">노출</Table.Th><Table.Th ta="right">원본 열기</Table.Th><Table.Th ta="right">캘린더</Table.Th><Table.Th ta="right">공유</Table.Th><Table.Th ta="right">클릭 합계</Table.Th></Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {shown.map(t => {
                                        const e = info.get(t.event_id);
                                        return (
                                            <Table.Tr key={t.event_id}>
                                                <Table.Td><Anchor component={Link} href={`/events/${t.event_id}`} size="sm">{e?.title ?? t.event_id}</Anchor><Text size="xs" c="dimmed">{e?.venue}</Text></Table.Td>
                                                <Table.Td ta="right">{t.view}</Table.Td><Table.Td ta="right">{t.outbound}</Table.Td><Table.Td ta="right">{t.calendar}</Table.Td><Table.Td ta="right">{t.share}</Table.Td><Table.Td ta="right" fw={700}>{t.clicks}</Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </>
            )}
        </Container>
    );
}
