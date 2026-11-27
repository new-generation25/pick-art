"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { HeaderSearch } from "./HeaderSearch";
import { Avatar } from "./Avatar";
import { AVATAR_EVENT, providerPhoto } from "@/lib/avatar";

/**
 * 맨 위 한 줄 (specs/014 시안 f01 → 운영자 11/27 머리 줄 시안 h01-B): 왼쪽 까치 그림 + 글자 로고 pica(끝 점만 초록), 오른쪽 찾기 · 내 정보(흰 원).
 * 내 정보 원은 메뉴 없이 바로 /me 로 간다(운영자 2026-11-28 «이렇게 메뉴가 많을 필요가 있어? 내정보로 들어가면 다 있잖아»).
 * 찜·설정·캘린더·관리자 페이지·로그아웃은 /me 안에 있다. 로그인 전이면 인물 원 대신 «로그인» 글자 버튼.
 */
export function Header() {
    const [user, setUser] = useState<any>(null);
    // 프로필 원 (specs/022): 올린 사진 → 관리자(profiles.role)면 까치 → 사람 그림
    const [avatarPath, setAvatarPath] = useState<string | null>(null);
    const [adminRole, setAdminRole] = useState(false);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setAvatarPath(profile?.avatar_path || null);
                setAdminRole(profile?.role === 'admin');
            }
        };
        checkUser();
        // «내 정보»에서 사진을 바꾸거나 지우면 바로 따라 바뀐다
        const onAvatar = (e: Event) => setAvatarPath((e as CustomEvent<string | null>).detail);
        window.addEventListener(AVATAR_EVENT, onAvatar);
        // 다른 탭에서 로그아웃했거나 로그인 기한이 끝나면 이 줄도 «로그인» 버튼으로 바꾼다
        const { data: auth } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") { setUser(null); setAdminRole(false); setAvatarPath(null); }
        });
        return () => { window.removeEventListener(AVATAR_EVENT, onAvatar); auth.subscription.unsubscribe(); };
    }, []);


    const iconBtn = "grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-soft";

    return (
        <div className="fixed inset-x-0 top-0 z-[1000] h-[60px] border-b border-line bg-paper">
            <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 pl-[18px] pr-[10px] sm:px-6">
                {/* 찾는 중이면 휴대폰에서는 로고 자리까지 찾기 칸이 쓰고, PC에서는 로고를 두고 오른쪽에 적당한 길이로 연다 */}
                <Link href="/" aria-label="pica 홈" className={`${searching ? "hidden sm:flex" : "flex"} shrink-0 items-center gap-2 no-underline`}>
                    {/* 확정 로고 그림의 윗부분(우체통 위 까치). 높이 36px, 그림 파일은 3배 크기. AI 시안이라 나중에 벡터로 다시 그린 파일로 바꾼다(브랜드 가이드 4절) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/logo-mark.png" alt="" width={40} height={36} className="block h-9 w-auto flex-none" />
                    <span className="flex items-baseline gap-2.5">
                        <span className="pica-num text-[24px] font-bold leading-none tracking-[-0.6px] text-ink">pica<span className="text-accent">.</span></span>
                        <span className={`hidden text-[13px] font-semibold text-ink-soft ${searching ? "lg:inline" : "sm:inline"}`}>가까운 공연·전시·축제</span>
                    </span>
                </Link>

                <div className={`flex min-w-0 items-center justify-end gap-1 ${searching ? "flex-1" : ""}`}>
                    <Suspense fallback={<button type="button" className={iconBtn} aria-label="찾기"><Search size={20} /></button>}>
                        <HeaderSearch open={searching} setOpen={setSearching} />
                    </Suspense>
                    {user ? (
                        <Link href="/me" aria-label="내 정보" className="grid h-11 w-11 place-items-center rounded-full">
                            <Avatar path={avatarPath} fallbackUrl={providerPhoto(user)} admin={adminRole} size={44} />
                        </Link>
                    ) : (
                        <Link href="/login" className="ml-1 flex h-[38px] shrink-0 items-center rounded-full bg-white px-[13px] text-[14px] font-bold text-ink no-underline shadow-[inset_0_0_0_1.5px_#CFC5B4]">
                            로그인
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
