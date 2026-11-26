"use client";

import { useEffect, useState } from "react";
import { needsTextPoster, posterSourceName, posterSrc, shortPeriod } from "@/lib/posters";

export type PosterEvent = {
    title: string;
    event_date_start?: string | null;
    event_date_end?: string | null;
    poster_image_url?: string | null;
    poster_placeholder?: boolean | null;
    venue?: string | null;
    source?: string | null;
};

/**
 * 포스터 칸 (specs/014). 포스터가 없거나 «안내 그림»이면, 또는 이미지를 불러오지 못하면 글자 포스터를 그린다.
 * 글자 포스터에는 DB 의 날짜·제목·출처만 넣는다(헌장 I). 포스터가 없는 행사는 «포스터 없음»을 함께 적는다.
 */
export function PosterOrText({ event, size = "shelf", className = "", priority = false }: {
    event: PosterEvent;
    size?: "shelf" | "detail" | "row";
    className?: string;
    priority?: boolean;
}) {
    const url = posterSrc(event.poster_image_url);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [url]);

    const text = failed || needsTextPoster(event);
    const src = posterSourceName(event);
    const noPoster = !url || failed;

    return (
        <div className={`pica-poster ${className}`} data-size={size}>
            {text ? (
                <div className="pica-textposter" aria-label={`${event.title} (포스터 대신 글자로 보임)`}>
                    <span className="tp-date">{shortPeriod(event.event_date_start, event.event_date_end)}</span>
                    <span className="tp-title pica-clamp-3">{event.title}</span>
                    {src && <span className="tp-src">정보: {src}</span>}
                    {noPoster && <span className="tp-none">포스터 없음</span>}
                </div>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt={`${event.title} 포스터`}
                    loading={priority ? "eager" : "lazy"}
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}
