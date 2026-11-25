"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { clusterGroups, countLabel, groupByVenue, zoomForRange, type VenueGroup } from "@/lib/mapGroups";
import { formatDistance, type LatLng } from "@/lib/nearby";
import { formatPeriod } from "@/lib/utils";
import { RouteButtons } from "@/components/ui/RouteButtons";
import type { NearbyRow } from "@/lib/nearbyData";

/**
 * 내 주변 지도 (specs/005-nearby-map). 네이버 지도 Web Dynamic Map v3.
 * - 키는 도메인 제한 공개 키(NEXT_PUBLIC_NAVER_MAP_KEY_ID)만 쓴다(헌장 III)
 * - 장소(좌표)마다 표시 하나 + 행사 수. 축소하면 가까운 장소를 묶는다
 * - 방문자 위치는 지도 위 표시로만 쓰고 어디에도 보내지 않는다
 * - 지도를 못 불러오면 onFail → 목록으로 돌아간다
 */
declare global {
    interface Window { naver?: any; navermap_authFailure?: () => void }
}

const KEY = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID || "";
let loading: Promise<void> | null = null;

function loadNaverMaps(): Promise<void> {
    if (window.naver?.maps) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
        if (!KEY) { reject(new Error("no key")); return; }
        const s = document.createElement("script");
        s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(KEY)}`;
        s.async = true;
        s.onload = () => (window.naver?.maps ? resolve() : reject(new Error("no maps")));
        s.onerror = () => reject(new Error("script error"));
        document.head.appendChild(s);
    });
    loading.catch(() => { loading = null; });
    return loading;
}

type Item = NearbyRow & { distanceM: number };

export function NearbyMap({ items, origin, originLabel, range, appname, onFail }: {
    items: Item[]; origin: LatLng; originLabel: string; range: string; appname: string; onFail: () => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markers = useRef<any[]>([]);
    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(zoomForRange(range));
    const [selected, setSelected] = useState<VenueGroup<Item> | null>(null);
    const groups = useMemo(() => groupByVenue(items), [items]);

    // 지도 만들기 (한 번)
    useEffect(() => {
        let cancelled = false;
        window.navermap_authFailure = () => { if (!cancelled) onFail(); };
        const guard = window.setTimeout(() => { if (!cancelled && !mapRef.current) onFail(); }, 5000);
        loadNaverMaps().then(() => {
            if (cancelled || !box.current) return;
            const { maps } = window.naver;
            const map = new maps.Map(box.current, {
                center: new maps.LatLng(origin.lat, origin.lng),
                zoom: zoomForRange(range),
                zoomControl: true,
                zoomControlOptions: { position: maps.Position.TOP_RIGHT, style: maps.ZoomControlStyle.SMALL },
                mapDataControl: false,
                scaleControl: false,
            });
            mapRef.current = map;
            new maps.Marker({
                position: new maps.LatLng(origin.lat, origin.lng),
                map,
                title: originLabel,
                icon: { content: '<div class="pica-origin" aria-hidden="true"></div>', anchor: new maps.Point(9, 9) },
                zIndex: 50,
            });
            maps.Event.addListener(map, "idle", () => setZoom(map.getZoom()));
            window.clearTimeout(guard);
            setReady(true);
        }).catch(() => { if (!cancelled) onFail(); });
        return () => { cancelled = true; window.clearTimeout(guard); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 기준점·거리 조건이 바뀌면 지도 가운데와 확대를 맞춘다
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        const { maps } = window.naver;
        map.setCenter(new maps.LatLng(origin.lat, origin.lng));
        map.setZoom(zoomForRange(range));
    }, [ready, origin.lat, origin.lng, range]);

    // 표시 그리기: 조건·확대가 바뀔 때마다 다시
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        const { maps } = window.naver;
        markers.current.forEach(m => m.setMap(null));
        markers.current = [];
        for (const c of clusterGroups(groups, zoom)) {
            const many = c.groups.length > 1;
            // 표시 안 글자는 숫자뿐이다(행사 이름 같은 데이터는 HTML 로 넣지 않는다)
            const html = `<div class="pica-pin${many ? " pica-pin-cluster" : ""}">${countLabel(c.count)}</div>`;
            const m = new maps.Marker({
                position: new maps.LatLng(c.lat, c.lng),
                map,
                title: many ? `장소 ${c.groups.length}곳 · 행사 ${c.count}건` : `${c.groups[0].venue} · 행사 ${c.count}건`,
                icon: { content: html, anchor: new maps.Point(18, 18) },
            });
            maps.Event.addListener(m, "click", () => {
                if (many) {
                    const b = new maps.LatLngBounds();
                    c.groups.forEach(g => b.extend(new maps.LatLng(g.lat, g.lng)));
                    map.fitBounds(b, { top: 60, right: 60, bottom: 60, left: 60 });
                } else {
                    setSelected(c.groups[0]);
                }
            });
            markers.current.push(m);
        }
    }, [ready, groups, zoom]);

    // 고른 장소가 조건 변경으로 사라지면 닫는다
    useEffect(() => {
        if (selected && !groups.some(g => g.key === selected.key)) setSelected(null);
    }, [groups, selected]);

    return (
        <div className="relative">
            <div ref={box} className="pica-box h-[62vh] min-h-[360px] w-full" role="application" aria-label={`${originLabel} 행사 지도`} />
            {!ready && <p className="absolute inset-0 flex items-center justify-center text-[14px] text-ink-soft">지도를 불러오는 중…</p>}
            {ready && groups.length === 0 && (
                <p className="pica-box absolute left-3 right-3 top-3 bg-paper p-3 text-[14px] text-ink">이 조건의 행사가 지도에 없어요. 기간이나 거리를 넓혀 보세요.</p>
            )}
            {selected && (
                <section className="pica-box absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto bg-paper p-4 shadow-lg" aria-label={`${selected.venue} 행사`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-[17px] font-bold text-ink">{selected.venue}</h2>
                            <p className="text-[13px] text-ink-soft">
                                행사 {selected.items.length}건{selected.distanceM !== null ? ` · ${formatDistance(selected.distanceM)}` : ""}
                            </p>
                        </div>
                        <button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="shrink-0 p-1 text-ink-soft hover:text-ink"><X size={20} /></button>
                    </div>
                    <ol className="mt-3 flex flex-col divide-y divide-line">
                        {selected.items.map(e => (
                            <li key={e.id} className="py-2.5">
                                <Link href={`/events/${e.id}`} className="flex items-baseline gap-3">
                                    <span className="pica-display w-[92px] shrink-0 text-[16px] text-accent tabular-nums">{formatPeriod(e.event_date_start, e.event_date_end).replace(/^\d{4}\./, "")}</span>
                                    <span className="min-w-0">
                                        <span className="block text-[15px] font-bold text-ink">{e.title}</span>
                                        {e.category && <span className="text-[12px] text-ink-soft">{e.category}{e.is_free ? " · 무료" : ""}</span>}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-3">
                        <RouteButtons e={selected.items[0]} appname={appname} />
                    </div>
                </section>
            )}
        </div>
    );
}
