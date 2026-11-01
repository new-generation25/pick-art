"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { HardDrive, Database, Image as ImageIcon, AlertTriangle, RefreshCw, CalendarX, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Box, Container, Title, Text, SimpleGrid, Paper, ThemeIcon, Progress, Group, Stack, Badge, Anchor, Table, Button, Alert, Modal, ScrollArea, rem } from "@mantine/core";

// Supabase 무료 플랜 한도 (supabase.com/pricing, 2026-11-01 확인). 플랜을 바꾸면 여기만 고친다.
const STORAGE_LIMIT = 1024 ** 3;       // 파일 저장 1 GB
const DB_LIMIT = 500 * 1024 ** 2;      // 데이터베이스 500 MB

interface Usage {
    buckets: { bucket: string; files: number; bytes: number; unused_files: number; unused_bytes: number }[];
    storage_bytes: number;
    db_bytes: number;
    tables: { name: string; bytes: number; rows_estimate: number }[];
    largest: { bucket: string; name: string; bytes: number; used: boolean; created_at: string }[];
    by_month: { month: string; files: number; bytes: number }[];
}

interface EndedReport {
    today: string; cut_1m: string; cut_3m: string;
    ongoing: number; ended_recent: number; ended_hidden: number;
    purge_events: number; purge_raw_posts: number; purge_files: number; purge_bytes: number;
    items: { kind: "event" | "raw_post"; id: string; title: string | null; date_end: string | null }[];
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function usageColor(pct: number) {
    return pct >= 90 ? "red" : pct >= 70 ? "orange" : "teal";
}

const publicUrl = (bucket: string, name: string) =>
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}`;

export default function AdminStoragePage() {
    const [usage, setUsage] = useState<Usage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [ended, setEnded] = useState<EndedReport | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [purging, setPurging] = useState(false);
    const [purgeResult, setPurgeResult] = useState<string | null>(null);

    const fetchUsage = async () => {
        setLoading(true);
        setError(null);
        // supabase/migrations/20261101000000_storage_usage.sql, 20261101010000_ended_events_purge.sql 의 함수
        const [u, e] = await Promise.all([supabase.rpc("storage_usage"), supabase.rpc("ended_events_report")]);
        if (u.error || e.error) setError((u.error || e.error)!.message);
        if (u.data) setUsage(u.data as Usage);
        if (e.data) setEnded(e.data as EndedReport);
        setLoading(false);
    };

    // 관리자 확인 후 실행. DB 함수가 관리자 여부를 다시 검사하고, 지울 이미지 목록을 돌려준다.
    const purge = async () => {
        setPurging(true);
        setPurgeResult(null);
        const { data, error } = await supabase.rpc("purge_ended_events");
        if (error) {
            setError(`삭제하지 못했습니다: ${error.message}`);
            setPurging(false);
            setConfirmOpen(false);
            return;
        }
        const files: { bucket: string; name: string; bytes: number }[] = data.files || [];
        const byBucket = new Map<string, string[]>();
        files.forEach(f => byBucket.set(f.bucket, [...(byBucket.get(f.bucket) || []), f.name]));
        let removed = 0;
        const failures: string[] = [];
        for (const [bucket, names] of byBucket) {
            const { data: gone, error: rmError } = await supabase.storage.from(bucket).remove(names);
            if (rmError) failures.push(`${bucket}: ${rmError.message}`);
            removed += gone?.length ?? 0;
        }
        const freed = files.reduce((s, f) => s + f.bytes, 0);
        setPurgeResult(
            `행사 ${data.events}건 삭제, 원본 ${data.raw_posts}건 정리, 이미지 ${removed}/${files.length}개 삭제 (${formatBytes(freed)})` +
            (failures.length ? ` · 이미지 삭제 실패: ${failures.join(", ")}` : "")
        );
        setPurging(false);
        setConfirmOpen(false);
        fetchUsage();
    };

    useEffect(() => {
        fetchUsage();
    }, []);

    const storagePct = usage ? (usage.storage_bytes / STORAGE_LIMIT) * 100 : 0;
    const dbPct = usage ? (usage.db_bytes / DB_LIMIT) * 100 : 0;
    const totalFiles = usage?.buckets.reduce((s, b) => s + b.files, 0) ?? 0;
    const unusedFiles = usage?.buckets.reduce((s, b) => s + b.unused_files, 0) ?? 0;
    const unusedBytes = usage?.buckets.reduce((s, b) => s + b.unused_bytes, 0) ?? 0;

    const meters = [
        { title: "이미지 저장공간", used: usage?.storage_bytes ?? 0, limit: STORAGE_LIMIT, pct: storagePct, icon: HardDrive },
        { title: "데이터베이스", used: usage?.db_bytes ?? 0, limit: DB_LIMIT, pct: dbPct, icon: Database },
    ];

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
                            <HardDrive size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>저장공간</Title>
                            <Text c="dimmed" fw={500}>수집한 포스터 이미지와 데이터베이스가 차지하는 용량을 무료 플랜 한도와 비교합니다.</Text>
                        </Box>
                    </Group>
                    <Button variant="light" color="indigo" leftSection={<RefreshCw size={14} />} onClick={fetchUsage} loading={loading}>
                        새로고침
                    </Button>
                </Group>

                {error && (
                    <Alert color="red" icon={<AlertTriangle size={16} />} mb="xl" title="용량을 불러오지 못했습니다">
                        {error}
                    </Alert>
                )}

                {loading && !usage ? (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                        {[1, 2].map(i => <Paper key={i} h={160} radius="xl" withBorder className="animate-pulse" />)}
                    </SimpleGrid>
                ) : usage && (
                    <Stack gap={40}>
                        {/* 한도 대비 사용량 */}
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                            {meters.map(m => (
                                <Paper key={m.title} p="xl" radius="xl" withBorder shadow="sm">
                                    <Group justify="space-between" mb="lg">
                                        <Group gap="sm">
                                            <ThemeIcon size={40} radius="xl" color={usageColor(m.pct)} variant="light">
                                                <m.icon size={20} />
                                            </ThemeIcon>
                                            <Text fw={900}>{m.title}</Text>
                                        </Group>
                                        <Text fw={900} c={usageColor(m.pct)}>{m.pct.toFixed(1)}%</Text>
                                    </Group>
                                    <Progress value={Math.max(m.pct, 0.5)} color={usageColor(m.pct)} size="lg" radius="xl" mb="sm" />
                                    <Text size="sm" c="dimmed" fw={600}>{formatBytes(m.used)} / {formatBytes(m.limit)}</Text>
                                </Paper>
                            ))}
                        </SimpleGrid>

                        {/* 끝난 행사 정리 */}
                        {ended && (
                            <Paper p="xl" radius="xl" withBorder shadow="sm">
                                <Group mb="lg" justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="indigo" radius="md"><CalendarX size={18} /></ThemeIcon>
                                        <Title order={3} size="h3" fw={900}>끝난 행사 정리</Title>
                                    </Group>
                                    <Text size="sm" c="dimmed" fw={600}>기준일 {ended.today}</Text>
                                </Group>
                                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="lg">
                                    {[
                                        { label: "진행 중·예정", value: ended.ongoing, note: "공개 피드에 표시", color: "teal" },
                                        { label: "종료 1개월 이내", value: ended.ended_recent, note: "'종료' 표시, 사용자가 켜면 보임", color: "gray" },
                                        { label: "종료 1~3개월", value: ended.ended_hidden, note: "공개 피드에서 숨김", color: "gray" },
                                        { label: "종료 3개월 초과", value: ended.purge_events + ended.purge_raw_posts, note: `삭제 후보 (행사 ${ended.purge_events} · 원본 ${ended.purge_raw_posts})`, color: "orange" },
                                    ].map(c => (
                                        <Paper key={c.label} p="md" radius="lg" bg="gray.0">
                                            <Text size="xs" fw={700} c="dimmed">{c.label}</Text>
                                            <Text size={rem(28)} fw={900} c={c.color}>{c.value.toLocaleString()}</Text>
                                            <Text size="xs" c="dimmed">{c.note}</Text>
                                        </Paper>
                                    ))}
                                </SimpleGrid>

                                {purgeResult && <Alert color="teal" mb="md">{purgeResult}</Alert>}

                                {ended.items.length === 0 ? (
                                    <Text size="sm" c="dimmed">종료 3개월이 지난 행사가 없습니다. 지울 것이 없습니다.</Text>
                                ) : (
                                    <>
                                        <Group justify="space-between" mb="sm">
                                            <Text fw={700}>
                                                {ended.cut_3m} 이전에 끝난 것 {ended.items.length}건 · 이미지 {ended.purge_files}개 · {formatBytes(ended.purge_bytes)}
                                            </Text>
                                            <Button color="red" leftSection={<Trash2 size={14} />} onClick={() => setConfirmOpen(true)}>
                                                완전 삭제
                                            </Button>
                                        </Group>
                                        <ScrollArea.Autosize mah={260}>
                                            <Table verticalSpacing={4}>
                                                <Table.Tbody>
                                                    {ended.items.map(i => (
                                                        <Table.Tr key={i.kind + i.id}>
                                                            <Table.Td><Badge size="xs" variant="light" color={i.kind === "event" ? "indigo" : "gray"}>{i.kind === "event" ? "공개 행사" : "수집 원본"}</Badge></Table.Td>
                                                            <Table.Td><Text size="sm" lineClamp={1}>{i.title || "(제목 없음)"}</Text></Table.Td>
                                                            <Table.Td ta="right"><Text size="sm" c="dimmed">{i.date_end} 종료</Text></Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                </Table.Tbody>
                                            </Table>
                                        </ScrollArea.Autosize>
                                    </>
                                )}
                            </Paper>
                        )}

                        {/* 버킷별 */}
                        <Paper p="xl" radius="xl" withBorder shadow="sm">
                            <Group mb="lg" justify="space-between">
                                <Group gap="sm">
                                    <ThemeIcon variant="light" color="indigo" radius="md"><ImageIcon size={18} /></ThemeIcon>
                                    <Title order={3} size="h3" fw={900}>버킷별 이미지</Title>
                                </Group>
                                <Text size="sm" c="dimmed" fw={600}>
                                    파일 {totalFiles.toLocaleString()}개 · 평균 {formatBytes(totalFiles ? Math.round(usage.storage_bytes / totalFiles) : 0)}
                                </Text>
                            </Group>
                            <Table verticalSpacing="sm">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>버킷</Table.Th>
                                        <Table.Th ta="right">파일 수</Table.Th>
                                        <Table.Th ta="right">용량</Table.Th>
                                        <Table.Th ta="right">쓰이지 않는 파일</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {usage.buckets.length === 0 && (
                                        <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" size="sm">저장된 파일이 없습니다.</Text></Table.Td></Table.Tr>
                                    )}
                                    {usage.buckets.map(b => (
                                        <Table.Tr key={b.bucket}>
                                            <Table.Td fw={700}>{b.bucket}</Table.Td>
                                            <Table.Td ta="right">{b.files.toLocaleString()}</Table.Td>
                                            <Table.Td ta="right">{formatBytes(b.bytes)}</Table.Td>
                                            <Table.Td ta="right">
                                                {b.unused_files > 0
                                                    ? <Badge color="orange" variant="light">{b.unused_files}개 · {formatBytes(b.unused_bytes)}</Badge>
                                                    : <Text size="sm" c="dimmed">0</Text>}
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                            <Text size="xs" c="dimmed" mt="md">
                                쓰이지 않는 파일: 공개 행사(events)의 포스터에도, 수집 원본(raw_posts)의 이미지 목록에도 없는 파일입니다.
                                {unusedFiles > 0 && ` 지금 ${unusedFiles}개, ${formatBytes(unusedBytes)}를 정리할 수 있습니다.`}
                            </Text>
                        </Paper>

                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                            {/* 월별 증가 */}
                            <Paper p="xl" radius="xl" withBorder shadow="sm">
                                <Title order={3} size="h4" fw={900} mb="lg">월별 이미지 증가</Title>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr><Table.Th>월</Table.Th><Table.Th ta="right">파일</Table.Th><Table.Th ta="right">용량</Table.Th></Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {usage.by_month.map(m => (
                                            <Table.Tr key={m.month}>
                                                <Table.Td>{m.month}</Table.Td>
                                                <Table.Td ta="right">{m.files.toLocaleString()}</Table.Td>
                                                <Table.Td ta="right">{formatBytes(m.bytes)}</Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Paper>

                            {/* 테이블별 */}
                            <Paper p="xl" radius="xl" withBorder shadow="sm">
                                <Title order={3} size="h4" fw={900} mb="lg">테이블별 DB 용량</Title>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr><Table.Th>테이블</Table.Th><Table.Th ta="right">행(추정)</Table.Th><Table.Th ta="right">용량</Table.Th></Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {usage.tables.slice(0, 8).map(t => (
                                            <Table.Tr key={t.name}>
                                                <Table.Td>{t.name}</Table.Td>
                                                <Table.Td ta="right">{t.rows_estimate < 0 ? "-" : t.rows_estimate.toLocaleString()}</Table.Td>
                                                <Table.Td ta="right">{formatBytes(t.bytes)}</Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Paper>
                        </SimpleGrid>

                        {/* 큰 파일 */}
                        <Paper p="xl" radius="xl" withBorder shadow="sm">
                            <Title order={3} size="h4" fw={900} mb="lg">가장 큰 파일 10개</Title>
                            <Table verticalSpacing="xs">
                                <Table.Thead>
                                    <Table.Tr><Table.Th>파일</Table.Th><Table.Th ta="right">용량</Table.Th><Table.Th ta="right">상태</Table.Th></Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {usage.largest.map(f => (
                                        <Table.Tr key={f.bucket + f.name}>
                                            <Table.Td>
                                                <Anchor href={publicUrl(f.bucket, f.name)} target="_blank" size="sm">{f.name}</Anchor>
                                            </Table.Td>
                                            <Table.Td ta="right">{formatBytes(f.bytes)}</Table.Td>
                                            <Table.Td ta="right">
                                                <Badge variant="light" color={f.used ? "teal" : "orange"}>{f.used ? "사용 중" : "안 쓰임"}</Badge>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Paper>
                    </Stack>
                )}
            </Container>

            <Modal opened={confirmOpen} onClose={() => !purging && setConfirmOpen(false)} title={<Text fw={900}>끝난 행사를 완전히 삭제할까요?</Text>} centered>
                {ended && (
                    <Stack gap="sm">
                        <Text size="sm">{ended.cut_3m} 이전에 끝난 행사를 정리합니다. 되돌릴 수 없습니다.</Text>
                        <Text size="sm">· 공개 행사 {ended.purge_events}건을 삭제합니다.</Text>
                        <Text size="sm">· 수집 원본 {ended.purge_raw_posts}건은 제목과 종료일만 남기고 비웁니다. 같은 글을 다시 수집하지 않게 하기 위해서입니다.</Text>
                        <Text size="sm">· 이미지 {ended.purge_files}개를 Storage에서 지워 {formatBytes(ended.purge_bytes)}를 확보합니다.</Text>
                        <Group justify="flex-end" mt="md">
                            <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={purging}>취소</Button>
                            <Button color="red" onClick={purge} loading={purging}>완전 삭제</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Box>
    );
}
