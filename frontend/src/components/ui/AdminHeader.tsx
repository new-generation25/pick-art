"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3, Inbox, Settings, Users, Globe,
    PlusCircle, LogOut, Search
} from "lucide-react";
import { Box, Container, Group, ThemeIcon, Text, Button, UnstyledButton, rem } from "@mantine/core";

export function AdminHeader() {
    return (
        <Box
            component="header"
            pos="fixed"
            top={0}
            left={0}
            right={0}
            h={80}
            bg="rgba(255, 255, 255, 0.95)"
            style={{
                zIndex: 50,
                borderBottom: '1px solid var(--mantine-color-gray-2)',
                backdropFilter: 'blur(8px)'
            }}
        >
            <Container size="xl" h="100%">
                <Group h="100%" justify="space-between">
                    {/* Logo */}
                    <Link href="/admin/stats" style={{ textDecoration: 'none' }}>
                        <Group gap="xs">
                            <ThemeIcon size={40} radius="md" variant="filled" color="indigo" style={{ boxShadow: 'var(--mantine-shadow-md)' }}>
                                <Text fw={900} size="xl" c="white">A</Text>
                            </ThemeIcon>
                            <Box>
                                <Text fw={900} size="lg" lh={1} c="dark">
                                    Admin<Text span c="indigo" inherit>Navi</Text>
                                </Text>
                                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mt={2}>
                                    Control Panel
                                </Text>
                            </Box>
                        </Group>
                    </Link>

                    {/* Admin Navigation */}
                    <Group gap={4} visibleFrom="md">
                        <AdminNavLink href="/admin/stats" icon={<BarChart3 size={16} />} label="대시보드" />
                        <AdminNavLink href="/admin/inbox" icon={<Inbox size={16} />} label="인박스" />
                        <AdminNavLink href="/admin/manual" icon={<PlusCircle size={16} />} label="수동등록" />
                        <AdminNavLink href="/admin/subscribers" icon={<Users size={16} />} label="구독자" />
                        <AdminNavLink href="/admin/sources" icon={<Globe size={16} />} label="출처관리" />
                        <AdminNavLink href="/admin/configs" icon={<Settings size={16} />} label="설정" />
                    </Group>

                    {/* Actions */}
                    <Group gap="md">
                        <Button
                            component={Link}
                            href="/"
                            target="_blank"
                            variant="subtle"
                            color="gray"
                            size="xs"
                            leftSection={<Search size={14} />}
                            visibleFrom="sm"
                        >
                            사이트 보기
                        </Button>
                        <Box w={1} h={24} bg="gray.3" visibleFrom="sm" />
                        <Button
                            variant="subtle"
                            color="red"
                            size="xs"
                            rightSection={<LogOut size={14} />}
                        >
                            로그아웃
                        </Button>
                    </Group>
                </Group>
            </Container>
        </Box>
    );
}

function AdminNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <UnstyledButton
            component={Link}
            href={href}
            px="md"
            py="xs"
            style={{
                borderRadius: '8px',
                backgroundColor: isActive ? 'var(--mantine-color-indigo-0)' : 'transparent',
                color: isActive ? 'var(--mantine-color-indigo-7)' : 'var(--mantine-color-gray-6)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}
        >
            <Box component="span" style={{ display: 'flex' }}>{icon}</Box>
            {label}
        </UnstyledButton>
    );
}
