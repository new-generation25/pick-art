"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { BarChart3, TrendingUp, Users, Inbox, CheckCircle, Database } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Box, Container, Title, Text, SimpleGrid, Paper, ThemeIcon, Progress, Group, Stack, Badge, Anchor, ActionIcon, rem, Button } from "@mantine/core";
import Link from "next/link";

export default function AdminStatsPage() {
    const [stats, setStats] = useState({
        totalRaw: 0,
        pendingRaw: 0,
        totalEvents: 0,
        totalSubscribers: 0,
        todayCollected: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            { count: totalRaw },
            { count: pendingRaw },
            { count: totalEvents },
            { count: totalSubscribers },
            { count: todayCollected }
        ] = await Promise.all([
            supabase.from("raw_posts").select("*", { count: "exact", head: true }),
            supabase.from("raw_posts").select("*", { count: "exact", head: true }).or("status.eq.COLLECTED,status.eq.PENDING"),
            supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "PUBLISHED"),
            supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("is_active", true),
            supabase.from("raw_posts").select("*", { count: "exact", head: true }).gte("collected_at", today.toISOString())
        ]);

        setStats({
            totalRaw: totalRaw || 0,
            pendingRaw: pendingRaw || 0,
            totalEvents: totalEvents || 0,
            totalSubscribers: totalSubscribers || 0,
            todayCollected: todayCollected || 0
        });
        setLoading(false);
    };

    const statCards = [
        { title: "오늘 수집", value: stats.todayCollected, icon: TrendingUp, color: "orange", desc: "최근 24시간 수집 건수" },
        { title: "검토 대기", value: stats.pendingRaw, icon: Inbox, color: "indigo", desc: "인박스에서 검토 중" },
        { title: "누적 발행", value: stats.totalEvents, icon: CheckCircle, color: "teal", desc: "서비스 노출 중인 행사" },
        { title: "총 구독자", value: stats.totalSubscribers, icon: Users, color: "pink", desc: "뉴스레터 활성 구독자" }
    ];

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
                            <BarChart3 size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>픽아트 시스템 통계</Title>
                            <Text c="dimmed" fw={500}>픽아트(pica)의 실시간 수집 및 발행 지표를 확인합니다.</Text>
                        </Box>
                    </Group>
                </Group>

                {loading ? (
                    <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
                        {[1, 2, 3, 4].map(i => (
                            <Paper key={i} h={160} radius="xl" withBorder className="animate-pulse" />
                        ))}
                    </SimpleGrid>
                ) : (
                    <>
                        {/* Summary Grid */}
                        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg" mb={40}>
                            {statCards.map((card, idx) => (
                                <Paper key={idx} p="xl" radius="xl" withBorder shadow="sm" className="hover:shadow-md transition-shadow">
                                    <Group justify="space-between" mb="lg">
                                        <ThemeIcon size={56} radius="xl" color={card.color} variant="light">
                                            <card.icon size={28} />
                                        </ThemeIcon>
                                        <ThemeIcon size="sm" color="gray" variant="transparent">
                                            <TrendingUp size={16} />
                                        </ThemeIcon>
                                    </Group>
                                    <Text size={rem(36)} fw={900} lh={1} mb={4}>{card.value.toLocaleString()}</Text>
                                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb={4}>{card.title}</Text>
                                    <Text size="xs" c="dimmed" fw={500}>{card.desc}</Text>
                                </Paper>
                            ))}
                        </SimpleGrid>

                        {/* Secondary Stats */}
                        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
                            <Paper p="xl" radius="xl" withBorder shadow="sm" style={{ gridColumn: 'span 2' }}>
                                <Group mb="xl">
                                    <ThemeIcon variant="light" color="indigo" radius="md">
                                        <Database size={18} />
                                    </ThemeIcon>
                                    <Title order={3} size="h3" fw={900}>데이터베이스 현황</Title>
                                </Group>

                                <Stack gap="xl">
                                    <Box>
                                        <Group justify="space-between" mb="xs">
                                            <Text size="sm" fw={700} c="dimmed">인박스 점유율 (전체 원본 대비 대기 건수)</Text>
                                            <Text fw={700} c="indigo">{Math.round((stats.pendingRaw / (stats.totalRaw || 1)) * 100)}%</Text>
                                        </Group>
                                        <Progress
                                            value={(stats.pendingRaw / (stats.totalRaw || 1)) * 100}
                                            size="lg"
                                            radius="xl"
                                            color="indigo"
                                            transitionDuration={1000}
                                        />
                                    </Box>

                                    <Group pt="lg" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                                        <Box flex={1}>
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb={4}>총 수집 레코드</Text>
                                            <Text size="xl" fw={900} c="dark">{stats.totalRaw.toLocaleString()}건</Text>
                                        </Box>
                                        <Box flex={1}>
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb={4}>상태 정보</Text>
                                            <Text fw={700} c="indigo">시스템 정상 작동 중</Text>
                                        </Box>
                                    </Group>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="xl" bg="indigo" style={{ position: 'relative', overflow: 'hidden', color: 'white' }}>
                                {/* Background Effect */}
                                <Box style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', transform: 'translate(50%, -50%)', filter: 'blur(40px)' }} />

                                <Stack pos="relative" style={{ zIndex: 1 }} h="100%" justify="space-between">
                                    <Box>
                                        <Title order={3} size="h3" fw={900} mb="lg" c="white">빠른 관리 메뉴</Title>

                                        <Stack gap="sm">
                                            <Button component={Link} href="/admin/inbox" variant="white" color="indigo" fullWidth justify="space-between" rightSection={<span>&rarr;</span>} styles={{ root: { backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }, label: { fontWeight: 700 } }}>
                                                인박스 검수하러 가기
                                            </Button>
                                            <Button component={Link} href="/admin/subscribers" variant="white" color="indigo" fullWidth justify="space-between" rightSection={<span>&rarr;</span>} styles={{ root: { backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }, label: { fontWeight: 700 } }}>
                                                구독자 목록 보기
                                            </Button>
                                            <Button component={Link} href="/admin/manual" variant="white" color="indigo" fullWidth justify="space-between" rightSection={<span>&rarr;</span>} styles={{ root: { backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }, label: { fontWeight: 700 } }}>
                                                수동 이벤트 등록
                                            </Button>
                                        </Stack>
                                    </Box>
                                </Stack>
                            </Paper>
                        </SimpleGrid>
                    </>
                )}
            </Container>
        </Box>
    );
}
