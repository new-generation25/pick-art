
"use client";

import { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";

interface ImageWithFallbackProps extends ImageProps {
    fallbackText?: string;
}

export function ImageWithFallback({ src, alt, fallbackText = "No Image", ...props }: ImageWithFallbackProps) {
    const [error, setError] = useState(false);

    useEffect(() => {
        setError(false);
    }, [src]);

    if (error || !src) {
        return (
            <div className={`flex flex-col items-center justify-center bg-neutral-100 text-neutral-400 w-full h-full ${props.className}`}>
                <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{fallbackText}</span>
            </div>
        );
    }

    return (
        <Image
            {...props}
            src={src}
            alt={alt}
            onError={() => setError(true)}
            unoptimized // Bypass Next.js Image Optimization to avoid server-side 400 errors for local/broken URLs
        />
    );
}
