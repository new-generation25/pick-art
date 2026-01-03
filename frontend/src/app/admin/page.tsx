"use client";

import { useState, useEffect } from "react";
import {
    Container, Title, Text, SimpleGrid, Paper,
    Group, Stack, ThemeIcon, rem, Box, Grid, Loader
} from "@mantine/core";
import {
    Inbox, Users, BarChart3, Settings,
    Code, ArrowRight, ShieldCheck, Database,
    FileText, Zap, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalEvents: 0,
        todayCrawl: 0,
        pendingInbox: 0,
        totalSubscribers: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            // 1. 전체 이벤트 수
            const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

            // 2. 오늘 수집된 로그 수 (간이 계산)
            const today = new Date().toISOString().split('T')[0];
            const { count: crawlCount } = await supabase
                .from('crawl_logs')
                .select('*', { count: 'exact', head: true })
                .gte('started_at', today);

            // 3. 인박스 대기 건수
            const { count: inboxCount } = await supabase.from('inbox').select('*', { count: 'exact', head: true });

            // 4. 구독자 수
            const { count: subCount } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });

            setStats({
                totalEvents: eventCount || 0,
                todayCrawl: crawlCount || 0,
                pendingInbox: inboxCount || 0,
                totalSubscribers: subCount || 0
            });
        } catch (error) {
            console.error("Stats fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const statCards = [
        { title: "전체 이벤트", value: stats.totalEvents, icon: Database, color: "blue", unit: "건" },
        { title: "오늘의 수집", value: stats.todayCrawl, icon: Zap, color: "orange", unit: "회" },
        { title: "인박스 대기", value: stats.pendingInbox, icon: Inbox, color: "red", unit: "건" },
        { title: "누적 구독자", value: stats.totalSubscribers, icon: Users, color: "teal", unit: "명" },
    ];

    const adminMenus = [
        { title: "수집 인박스", desc: "추출된 정보 승인이 필요합니다.", link: "/admin/inbox", icon: Inbox, color: "blue" },
        { title: "직접 이벤트 등록", desc: "공고문을 직접 입력하여 게시합니다.", link: "/admin/manual", icon: FileText, color: "violet" },
        { title: "수집 출처 관리", desc: "화이트리스트 및 차단 소스 관리", link: "/admin/sources", icon: Code, color: "indigo" },
        { title: "뉴스레터 구독자", desc: "구독 유저 및 발송 관리", link: "/admin/subscribers", icon: Users, color: "teal" },
    ];

    return (
        <Container size="lg" pt={40} pb={80}>
            <Stack gap="xl">
                <div>
                    <Title order={1} fw={900}>Admin Overview</Title>
                    <Text c="dimmed">실시간 시스템 현황 및 데이터 통계입니다.</Text>
                </div>

                {/* Stats Section (The Numbers) */}
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
                    {statCards.map((stat) => (
                        <Paper key={stat.title} withBorder p="xl" radius="md" shadow="sm">
                            <Group justify="space-between">
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">{stat.title}</Text>
                                    <Group align="flex-end" gap={4} mt={4}>
                                        <Text size="xl" fw={900}>
                                            {isLoading ? <Loader size="xs" /> : stat.value.toLocaleString()}
                                        </Text>
                                        <Text size="sm" c="dimmed" pb={3}>{stat.unit}</Text>
                                    </Group>
                                </div>
                                <ThemeIcon color={stat.color} variant="light" size={48} radius="md">
                                    <stat.icon size={24} />
                                </ThemeIcon>
                            </Group>
                        </Paper>
                    ))}
                </SimpleGrid>

                {/* Main Menus */}
                <div>
                    <Text fw={700} mb="md" size="lg">핵심 관리 기능</Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                        {adminMenus.map((menu) => (
                            <Paper
                                key={menu.link}
                                component={Link}
                                href={menu.link}
                                withBorder p="lg" radius="md"
                                style={{
                                    textDecoration: 'none',
                                    transition: 'all 0.2s ease',
                                    color: 'inherit'
                                }}
                                styles={{ root: { '&:hover': { transform: 'translateY(-3px)', boxShadow: 'var(--mantine-shadow-md)' } } }}
                            >
                                <Group>
                                    <ThemeIcon size={44} radius="md" color={menu.color} variant="light">
                                        <menu.icon size={24} />
                                    </ThemeIcon>
                                    <div style={{ flex: 1 }}>
                                        <Text fw={700}>{menu.title}</Text>
                                        <Text size="xs" c="dimmed">{menu.desc}</Text>
                                    </div>
                                    <ArrowRight size={18} color="#adb5bd" />
                                </Group>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </div>
            </Stack>
        </Container>
    );
}
