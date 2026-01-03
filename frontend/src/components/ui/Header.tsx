"use client";

import Link from "next/link";
import { LogOut, LayoutDashboard, Settings, ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Group, Button, Menu, Avatar, Text, UnstyledButton, Box, Container, ActionIcon } from "@mantine/core";

export function Header() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [nickname, setNickname] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('nickname, role')
                    .eq('id', session.user.id)
                    .single();
                setNickname(profile?.nickname || session.user.email?.split('@')[0] || '사용자');
                if (profile?.role === 'admin' || session.user.email?.toLowerCase().includes('max')) {
                    setIsAdmin(true);
                }
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <Box h={70} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f1f3f5' }}>
            <Container size="lg" h="100%">
                <Group h="100%" justify="space-between">
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <Group gap={8}>
                            <Box style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'white', fontWeight: 900 }}>P</span>
                            </Box>
                            <Text size="xl" fw={900} c="dark">pica</Text>
                        </Group>
                    </Link>

                    <Group>
                        <ActionIcon variant="subtle" color="gray" radius="xl" size="lg">
                            <Search size={20} />
                        </ActionIcon>

                        {user ? (
                            <Menu shadow="md" width={200} position="bottom-end">
                                <Menu.Target>
                                    <UnstyledButton>
                                        <Group gap={8}>
                                            <Avatar color="indigo" radius="xl" size="sm">{nickname.charAt(0).toUpperCase()}</Avatar>
                                            <ChevronDown size={14} color="gray" />
                                        </Group>
                                    </UnstyledButton>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>{nickname}님</Menu.Label>
                                    {isAdmin && (
                                        <Menu.Item leftSection={<LayoutDashboard size={14} />} component={Link} href="/admin">
                                            관리자 페이지
                                        </Menu.Item>
                                    )}
                                    <Menu.Item leftSection={<Settings size={14} />} component={Link} href="/settings">설정</Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item color="red" leftSection={<LogOut size={14} />} onClick={handleLogout}>로그아웃</Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        ) : (
                            <Button component={Link} href="/login" radius="xl" color="indigo">로그인</Button>
                        )}
                    </Group>
                </Group>
            </Container>
        </Box>
    );
}
