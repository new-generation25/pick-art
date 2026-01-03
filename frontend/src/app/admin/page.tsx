"use client";

import { Container, Title, Text, SimpleGrid, Paper, Group, Stack, ThemeIcon, rem, Box } from "@mantine/core";
import {
    Inbox, Users, BarChart3,
    Settings, Code, ArrowRight, ShieldCheck
} from "lucide-react";
import Link from "next/link";

const adminMenus = [
    {
        title: "수집 인박스 (Inbox)",
        description: "새로 수집된 정보를 검토하고 승인합니다.",
        icon: Inbox,
        link: "/admin/inbox",
        color: "blue"
    },
    {
        title: "출처 관리 (Sources)",
        description: "정보를 수집할 채널과 화이트리스트를 관리합니다.",
        icon: Code,
        link: "/admin/sources",
        color: "indigo"
    },
    {
        title: "구독자 관리 (Subscribers)",
        description: "뉴스레터 구독 명단을 확인하고 발송합니다.",
        icon: Users,
        link: "/admin/subscribers",
        color: "teal"
    },
    {
        title: "통계 및 로그 (Stats)",
        description: "전체 수집 현황 및 시스템 로그를 확인합니다.",
        icon: BarChart3,
        link: "/admin/stats",
        color: "orange"
    }
];

export default function AdminDashboard() {
    return (
        <Container size="lg" pt={120} pb={80}>
            <Stack gap="xs" mb={40}>
                <Title order={1} fw={900}>관리자 대시보드</Title>
                <Text c="dimmed">픽아트 서비스의 핵심 기능을 관리합니다.</Text>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                {adminMenus.map((menu) => (
                    <Link href={menu.link} key={menu.link} style={{ textDecoration: 'none' }}>
                        <Paper
                            withBorder
                            p="xl"
                            radius="md"
                            shadow="sm"
                            style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Group>
                                <ThemeIcon size={50} radius="md" variant="light" color={menu.color}>
                                    <menu.icon size={28} />
                                </ThemeIcon>
                                <Box style={{ flex: 1 }}>
                                    <Text fw={700} size="lg">{menu.title}</Text>
                                    <Text size="sm" c="dimmed">{menu.description}</Text>
                                </Box>
                                <ArrowRight size={20} color="gray" />
                            </Group>
                        </Paper>
                    </Link>
                ))}
            </SimpleGrid>
        </Container>
    );
}
