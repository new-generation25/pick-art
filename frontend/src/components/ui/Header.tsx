"use client";

import Link from "next/link";
import { LogOut, LayoutDashboard, Settings, Search, Heart, UserRound, X, CalendarPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Menu } from "@mantine/core";
import { INSTAGRAM_URL, InstagramIcon } from "./InstagramLink";

/**
 * 맨 위 한 줄 (specs/014 시안 f01): 왼쪽 글자 로고 pica(끝 점만 초록), 오른쪽 찾기 · 내 정보.
 * 내 정보 메뉴 안에 찜·설정·캘린더·인스타그램·관리자·로그아웃을 둔다. 로그인 전이면 내 정보 → 로그인.
 */
export function Header() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [nickname, setNickname] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [searching, setSearching] = useState(false);
    const input = useRef<HTMLInputElement>(null);

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

    useEffect(() => { if (searching) input.current?.focus(); }, [searching]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const iconBtn = "grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-soft";

    return (
        <div className="fixed inset-x-0 top-0 z-[1000] h-[60px] border-b border-line bg-paper/95 backdrop-blur">
            <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 pl-[18px] pr-[10px] sm:px-6">
                {searching ? (
                    <form action="/" method="GET" role="search" className="flex h-11 flex-1 items-center gap-2 rounded-full bg-card px-4 shadow-[0_1px_5px_rgba(30,26,21,.13)]">
                        <Search size={18} className="shrink-0 text-ink-soft" aria-hidden />
                        <input ref={input} name="q" placeholder="행사 이름으로 찾기" aria-label="행사 이름으로 찾기"
                            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft" />
                        <button type="button" onClick={() => setSearching(false)} aria-label="찾기 닫기" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:text-ink">
                            <X size={18} />
                        </button>
                    </form>
                ) : (
                    <Link href="/" aria-label="pica 홈" className="flex items-baseline gap-2.5 no-underline">
                        <span className="pica-num text-[26px] font-bold leading-none tracking-[-0.6px] text-ink">pica<span className="text-accent">.</span></span>
                        <span className="hidden text-[13px] font-semibold text-ink-soft sm:inline">가까운 공연·전시·축제</span>
                    </Link>
                )}

                <div className="flex items-center gap-1">
                    {!searching && (
                        <button type="button" className={iconBtn} aria-label="찾기" onClick={() => setSearching(true)}>
                            <Search size={20} />
                        </button>
                    )}
                    {user ? (
                        <Menu shadow="md" width={210} position="bottom-end">
                            <Menu.Target>
                                <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white" aria-label="내 정보">
                                    <UserRound size={20} />
                                </button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>{nickname}님</Menu.Label>
                                <Menu.Item leftSection={<UserRound size={14} />} component={Link} href="/me">내 정보</Menu.Item>
                                <Menu.Item leftSection={<Heart size={14} />} component={Link} href="/me#saved">찜한 행사</Menu.Item>
                                <Menu.Item leftSection={<Settings size={14} />} component={Link} href="/me#settings">내 지역·관심 분야·알림</Menu.Item>
                                <Menu.Item leftSection={<CalendarPlus size={14} />} component={Link} href="/calendar">캘린더로 받기</Menu.Item>
                                <Menu.Item leftSection={<InstagramIcon size={14} />} component="a" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">인스타그램 @picka.news</Menu.Item>
                                {isAdmin && (
                                    <Menu.Item leftSection={<LayoutDashboard size={14} />} component={Link} href="/admin">관리자 페이지</Menu.Item>
                                )}
                                <Menu.Divider />
                                <Menu.Item leftSection={<LogOut size={14} />} onClick={handleLogout}>로그아웃</Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    ) : (
                        <Link href="/login" className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white" aria-label="내 정보 (로그인)">
                            <UserRound size={20} />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
