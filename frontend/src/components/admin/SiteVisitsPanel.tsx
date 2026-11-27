"use client";

import { Paper, Text, SimpleGrid, Group, Anchor, Table } from "@mantine/core";

// 사이트 방문 (specs/011 FR-001). 수집기 tools/publish_site_visits.py 가 Vercel Web Analytics 합계를 하루 두 번 올린다(쿠키 없음, 사람 단위 기록 없음)
type Count = { visitors: number; pageviews: number };
export type SiteVisits = {
    summary: { d7: Count; d30: Count; month: Count };
    daily: ({ date: string } & Count)[];
    monthly: ({ month: string } & Count)[];
    pages: ({ key: string } & Count)[];
    referrers: ({ key: string } & Count)[];
    devices: ({ key: string } & Count)[];
};
const VERCEL_ANALYTICS = "https://vercel.com/new-generation25s-projects/pick-art/analytics";
const DEVICE = { mobile: "휴대폰", desktop: "컴퓨터", tablet: "태블릿" } as Record<string, string>;
const label = (k: string) => (k === "Others" ? "기타" : k);

function TopTable({ title, rows, name }: { title: string; rows: ({ key: string } & Count)[]; name?: (k: string) => string }) {
    return (
        <div>
            <Text size="sm" fw={700} mb={4}>{title}</Text>
            {rows.length === 0 ? <Text size="xs" c="dimmed">없음</Text> : (
                <Table verticalSpacing={2} fz="xs">
                    <Table.Tbody>
                        {rows.map(r => (
                            <Table.Tr key={r.key}>
                                <Table.Td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.key}>{(name ?? label)(r.key)}</Table.Td>
                                <Table.Td ta="right">{r.visitors}명</Table.Td>
                                <Table.Td ta="right" c="dimmed">{r.pageviews}뷰</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
        </div>
    );
}

export function SiteVisitsPanel({ data, updatedAt }: { data?: SiteVisits; updatedAt?: string }) {
    if (!data) {
        return (
            <Paper withBorder radius="md" p="md" id="site-visits">
                <Text fw={700}>사이트 방문</Text>
                <Text size="sm" c="dimmed">방문 숫자가 아직 올라오지 않았습니다(수집기 publish_site_visits.py). <Anchor href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer">Vercel Analytics</Anchor>에서 직접 볼 수 있습니다.</Text>
            </Paper>
        );
    }
    const tile = (t: string, c: Count) => (
        <div>
            <Text size="xs" c="dimmed">{t}</Text>
            <Text fw={800} fz={22}>{c.visitors.toLocaleString()}명</Text>
            <Text size="xs" c="dimmed">페이지 {c.pageviews.toLocaleString()}회</Text>
        </div>
    );
    return (
        <Paper withBorder radius="md" p="md" id="site-visits">
            <Group justify="space-between" align="flex-start">
                <div>
                    <Text fw={700}>사이트 방문</Text>
                    <Text size="xs" c="dimmed">Vercel Web Analytics 합계(쿠키 없음) · 날짜는 UTC 기준{updatedAt ? ` · ${new Date(updatedAt).toLocaleString("ko-KR")} 기준` : ""}</Text>
                </div>
                <Anchor size="xs" href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer">Vercel에서 자세히</Anchor>
            </Group>
            <SimpleGrid cols={3} mt="sm">
                {tile("최근 7일", data.summary.d7)}
                {tile("최근 30일", data.summary.d30)}
                {tile("이번 달", data.summary.month)}
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md" spacing="md">
                <TopTable title="많이 본 페이지(30일)" rows={data.pages} />
                <TopTable title="들어온 곳(30일)" rows={data.referrers} />
                <TopTable title="기기(30일)" rows={data.devices} name={k => DEVICE[k] ?? label(k)} />
            </SimpleGrid>
        </Paper>
    );
}
