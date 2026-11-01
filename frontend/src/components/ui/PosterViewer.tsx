"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "@mantine/core";
import { Maximize2, X } from "lucide-react";

// 행사 상세의 포스터. 누르면 화면 가득 원본 비율로 크게 보여 준다 (Esc·바깥 누르기·닫기 버튼으로 닫힘)
export function PosterViewer({ src, alt, ended = false }: { src?: string | null; alt: string; ended?: boolean }) {
    const [opened, setOpened] = useState(false);
    const poster = src || "/images/placeholder.webp";
    const canZoom = !!src;

    const thumb = (
        <Image
            src={poster}
            alt={alt}
            fill
            className={ended ? "object-cover grayscale" : "object-cover"}
            priority
            sizes="(max-width: 768px) 100vw, 400px"
            unoptimized={poster.startsWith("http")}
        />
    );

    if (!canZoom) {
        return <div className="pica-box relative mx-auto aspect-[3/4] w-full max-w-[400px] overflow-hidden">{thumb}</div>;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpened(true)}
                className="pica-box group relative mx-auto block aspect-[3/4] w-full max-w-[400px] cursor-zoom-in overflow-hidden"
                aria-label="포스터 크게 보기"
            >
                {thumb}
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-ink px-2 py-1 text-[12px] font-bold text-paper">
                    <Maximize2 size={13} aria-hidden />
                    크게 보기
                </span>
            </button>

            <Modal
                opened={opened}
                onClose={() => setOpened(false)}
                fullScreen
                withCloseButton={false}
                padding={0}
                transitionProps={{ transition: "fade", duration: 150 }}
                styles={{ content: { background: "rgba(10, 10, 10, 0.94)" }, body: { height: "100%" } }}
                aria-label={`${alt} 포스터`}
            >
                <div
                    className="relative flex h-full w-full cursor-zoom-out items-center justify-center p-3 sm:p-8"
                    onClick={() => setOpened(false)}
                >
                    {/* 원본 크기 그대로 화면 안에 맞춘다 (잘리지 않게 contain) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={poster} alt={alt} className="max-h-full max-w-full object-contain" />
                    <button
                        type="button"
                        onClick={() => setOpened(false)}
                        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center border-[1.5px] border-white bg-black/60 text-white"
                        aria-label="닫기"
                    >
                        <X size={22} aria-hidden />
                    </button>
                </div>
            </Modal>
        </>
    );
}
