"use client";

import Link from "next/link";
import {
    LogOut, LayoutDashboard, Settings, ChevronDown,
    Inbox, PlusCircle, Database, Users, Sparkles, Home, BarChart3
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import {
    Group, Button, Menu, Avatar, Text,
    UnstyledButton, Box, Container, Tooltip, ActionIcon, rem
} from "@mantine/core";

export function AdminHeader() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [nickname, setNickname] = useState("");

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('nickname')
                    .eq('id', session.user.id)
                    .single();
                setNickname(profile?.nickname || session.user.email?.split('@')[0] || '관리자');
            } else {
                router.push('/login'); // 관리자 페이지인데 로그인 안되어있으면 쫓아냄
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const isActive = (path: string) => pathname?.includes(path);

    return (
        <Box h={65} style={{
            borderBottom: '1px solid #e9ecef',
            backgroundColor: '#fff',
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000
        }}>
            <Container size="xl" h="100%">
                <Group h="100%" justify="space-between">
                    <Group gap={30}>
                        <Link href="/" style={{ textDecoration: 'none' }}>
                            <Group gap={8}>
                                <Box style={{
                                    width: 32, height: 32,
                                    background: '#1a1b1e',
                                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <span style={{ color: 'white', fontWeight: 900, fontSize: '1rem' }}>A</span>
                                </Box>
                                <Text fw={900} size="lg" c="dark">pica Admin</Text>
                            </Group>
                        </Link>

                        {/* Admin Navigation Menu */}
                        <Group gap="md">
                            <Button
                                component={Link} href="/admin/inbox"
                                variant={isActive('/inbox') ? "filled" : "subtle"}
                                color="indigo" size="xs" leftSection={<Inbox size={14} />}
                            >
                                인박스
                            </Button>
                            <Button
                                component={Link} href="/admin/manual"
                                variant={isActive('/manual') ? "filled" : "subtle"}
                                color="indigo" size="xs" leftSection={<PlusCircle size={14} />}
                            >
                                직접등록
                            </Button>
                            <Button
                                component={Link} href="/admin/sources"
                                variant={isActive('/sources') ? "filled" : "subtle"}
                                color="indigo" size="xs" leftSection={<Database size={14} />}
                            >
                                출처관리
                            </Button>
                            <Button
                                component={Link} href="/admin/subscribers"
                                variant={isActive('/subscribers') ? "filled" : "subtle"}
                                color="indigo" size="xs" leftSection={<Users size={14} />}
                            >
                                구독자
                            </Button>
                            <Button
                                component={Link} href="/admin/ai-prompt"
                                variant={isActive('/ai-prompt') ? "filled" : "subtle"}
                                color="indigo" size="xs" leftSection={<Sparkles size={14} />}
                            >
                                AI프롬프트
                            </Button>
                        </Group>
                    </Group>

                    <Group gap="sm">
                        <Tooltip label="사용자 페이지로 이동">
                            <ActionIcon component={Link} href="/" variant="light" color="blue" size="lg" radius="md">
                                <Home size={20} />
                            </ActionIcon>
                        </Tooltip>

                        <Menu shadow="md" width={200} position="bottom-end">
                            <Menu.Target>
                                <UnstyledButton>
                                    <Avatar color="indigo" radius="md" size="sm">
                                        {nickname.charAt(0).toUpperCase()}
                                    </Avatar>
                                </UnstyledButton>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>관리자님 환영합니다</Menu.Label>
                                <Menu.Item leftSection={<BarChart3 size={14} />} component={Link} href="/admin">관리자 홈</Menu.Item>
                                <Menu.Item leftSection={<Settings size={14} />} component={Link} href="/admin/configs">시스템 설정</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item color="red" leftSection={<LogOut size={14} />} onClick={handleLogout}>로그아웃</Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Group>
            </Container>
        </Box>
    );
}
