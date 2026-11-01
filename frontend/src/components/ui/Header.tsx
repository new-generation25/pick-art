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
        <Box h={60} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'var(--pk-paper)', borderBottom: '2px solid var(--pk-line)' }}>
            <Container size="xl" h="100%">
                <Group h="100%" justify="space-between">
                    <Link href="/" style={{ textDecoration: 'none' }} aria-label="pica 홈">
                        <Group gap={10} align="center">
                            <Text className="pica-display" fz={26} c="var(--pk-accent)" style={{ lineHeight: 1 }}>pica</Text>
                            <Text fz={13} fw={600} c="var(--pk-ink-soft)" visibleFrom="xs" style={{ lineHeight: 1 }}>경남 문화예술 안내</Text>
                        </Group>
                    </Link>

                    <Group>
                        <ActionIcon variant="subtle" color="gray" radius="xl" size="lg" aria-label="검색">
                            <Search size={20} />
                        </ActionIcon>

                        {user ? (
                            <Menu shadow="md" width={200} position="bottom-end">
                                <Menu.Target>
                                    <UnstyledButton>
                                        <Group gap={8}>
                                            <Avatar color="pink" radius={0} size="sm">{nickname.charAt(0).toUpperCase()}</Avatar>
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
                            <Button component={Link} href="/login" radius={0} color="dark" variant="outline" size="sm" styles={{ root: { borderWidth: 1.5 } }}>로그인</Button>
                        )}
                    </Group>
                </Group>
            </Container>
        </Box>
    );
}
