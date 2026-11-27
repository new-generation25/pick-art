"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";

/**
 * 프로필 원 (specs/022, 머리 줄 시안 h01-B). 그리는 순서: 올린 사진 → 관리자면 까치 그림 → 사람 그림.
 * 사진이 없을 때는 흰 원 + 안쪽 1.5px 선(#CFC5B4). 관리자는 종이색(#F4EFE6) 원 안에 확정 로고 윗부분(우체통 위 까치).
 */
export function Avatar({ path, admin = false, size, className = "" }: { path?: string | null; admin?: boolean; size: number; className?: string }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        setUrl(null);
        avatarUrl(path).then(u => { if (alive) setUrl(u); });
        return () => { alive = false; };
    }, [path]);

    const box = { width: size, height: size };
    if (url) {
        // 사진 위의 테두리는 outline 으로 그린다(img 에는 안쪽 그림자가 보이지 않는다)
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt="" style={{ ...box, outline: "1.5px solid #CFC5B4", outlineOffset: "-1.5px" }} className={`flex-none rounded-full object-cover ${className}`} onError={() => setUrl(null)} />;
    }
    if (admin) {
        return (
            <span style={box} className={`grid flex-none place-items-center overflow-hidden rounded-full bg-[#F4EFE6] shadow-[inset_0_0_0_1.5px_#CFC5B4] ${className}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/logo-mark.png" alt="" style={{ height: Math.round(size * 0.64), width: "auto" }} />
            </span>
        );
    }
    return (
        <span style={box} className={`grid flex-none place-items-center rounded-full bg-white text-ink shadow-[inset_0_0_0_1.5px_#CFC5B4] ${className}`}>
            <UserRound size={Math.round(size * 0.46)} aria-hidden />
        </span>
    );
}
