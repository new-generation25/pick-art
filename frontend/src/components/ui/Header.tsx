"use client";

import Link from "next/link";
import { LogOut, LayoutDashboard, Settings, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Group, Button, Menu, Avatar, Text, ThemeIcon, UnstyledButton, rem } from "@mantine/core";

export function Header() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [nickname, setNickname] = useState("");

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);

                // 닉네임과 역할 가져오기 (profiles 테이블에서)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('nickname, role')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.nickname) {
                    setNickname(profile.nickname);
                } else {
                    // 프로필이 없으면 이메일 앞부분 사용
                    setNickname(session.user.email?.split('@')[0] || '사용자');
                }

                // 관리자 체크 (role 또는 이메일 기준)
                if (profile?.role === 'admin' || session.user.email === 'MAX@artnav.kr' || session.user.email === 'max@artnav.kr') {
                    setIsAdmin(true);
                }
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
                if (session.user.email === 'MAX@artnav.kr' || session.user.email === 'max@artnav.kr') {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } else {
                setUser(null);
                setIsAdmin(false);
                setNickname("");
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <Group h="100%" px="md" justify="space-between" style={{ backgroundColor: 'white' }}>
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none' }}>
                <Group gap="xs">
                    <ThemeIcon size="lg" radius="md" variant="filled" color="indigo">
                        <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>G</span>
                    </ThemeIcon>
                    <Text size="xl" fw={700} c="dark">
                        Art<Text span c="indigo" inherit>Navi</Text>
                    </Text>
                </Group>
            </Link>

            {/* Actions */}
            <Group>
                {user ? (
                    <Menu shadow="md" width={200} transitionProps={{ transition: 'pop-top-right' }}>
                        <Menu.Target>
                            <UnstyledButton>
                                <Group gap="xs">
                                    <Avatar color="indigo" radius="xl">
                                        {nickname.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <div style={{ flex: 1 }}>
                                        <Text size="sm" fw={700}>
                                            {nickname}님
                                        </Text>
                                    </div>
                                    <ChevronDown style={{ width: rem(12), height: rem(12) }} />
                                </Group>
                            </UnstyledButton>
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>계정 설정</Menu.Label>
                            {isAdmin && (
                                <Menu.Item
                                    leftSection={<LayoutDashboard style={{ width: rem(14), height: rem(14) }} />}
                                    component={Link}
                                    href="/admin/stats"
                                >
                                    관리자 대시보드
                                </Menu.Item>
                            )}
                            <Menu.Item
                                leftSection={<Settings style={{ width: rem(14), height: rem(14) }} />}
                                component={Link}
                                href="/settings"
                            >
                                설정
                            </Menu.Item>

                            <Menu.Divider />

                            <Menu.Item
                                color="red"
                                leftSection={<LogOut style={{ width: rem(14), height: rem(14) }} />}
                                onClick={handleLogout}
                            >
                                로그아웃
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                ) : (
                    <Button component={Link} href="/login" variant="filled" color="indigo">
                        로그인
                    </Button>
                )}
            </Group>
        </Group>
    );
}
