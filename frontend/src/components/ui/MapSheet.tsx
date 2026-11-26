"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, List, LocateFixed } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadNaverMaps } from "@/app/nearby/NearbyMap";
import { distanceM } from "@/lib/nearby";
import { ShelfTile, type ShelfCard } from "./Shelf";

export type SheetEvent = ShelfCard & { venueId: string | null; today?: boolean };
type Venue = { id: string; name: string; lat: number; lng: number };
type Place = { venue: Venue; events: SheetEvent[]; today: number; week: number };

/**
 * 지도 시트 (specs/014 US3, 시안 f01). 홈의 «지도» 버튼을 누를 때만 열리고, 그때 장소 좌표와 네이버 지도를 불러온다.
 * 장소마다 핀(행사 수). 핀을 누르면 그 장소 행사의 작은 선반 + «공간 정보». 그 아래 장소 목록.
 * 위치를 허락하면 장소 목록을 가까운 순으로. 위치는 순서를 정하는 데만 쓰고 저장하거나 보내지 않는다.
 */
export default function MapSheet({ events, summary, onClose }: { events: SheetEvent[]; summary: string; onClose: () => void }) {
    const [venues, setVenues] = useState<Map<string, Venue> | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [mapFailed, setMapFailed] = useState(false);
    const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markers = useRef<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- naver maps 타입 없음(위와 같음)
    const meMarker = useRef<any>(null);
    // 처음 그릴 때만 장소들이 다 보이게 맞춘다. 그 뒤(내 위치로 순서가 바뀌는 등)에는 사용자가 맞춘 배율을 건드리지 않는다
    const fitted = useRef(false);
    const [mapReady, setMapReady] = useState(false);

    // 뒤로 가기 = 시트 닫기
    useEffect(() => {
        history.pushState({ picaMap: true }, "");
        const onPop = () => onClose();
        window.addEventListener("popstate", onPop);
        document.body.style.overflow = "hidden";
        return () => { window.removeEventListener("popstate", onPop); document.body.style.overflow = ""; };
    }, [onClose]);
    const close = () => { if (history.state?.picaMap) history.back(); else onClose(); };

    // 장소 좌표 (공개 뷰: 좌표가 확인된 장소만)
    useEffect(() => {
        const ids = [...new Set(events.map(e => e.venueId).filter(Boolean))] as string[];
        (async () => {
            const out = new Map<string, Venue>();
            for (let i = 0; i < ids.length; i += 200) {
                const { data } = await supabase.from("public_venues").select("id,name,lat,lng").in("id", ids.slice(i, i + 200));
                for (const v of data || []) out.set(v.id, v as Venue);
            }
            setVenues(out);
        })();
    }, [events]);

    const { places, noCoords } = useMemo(() => {
        const by = new Map<string, Place>();
        let none = 0;
        for (const e of events) {
            const v = e.venueId ? venues?.get(e.venueId) : undefined;
            if (!v) { none++; continue; }
            const p = by.get(v.id) ?? { venue: v, events: [], today: 0, week: 0 };
            p.events.push(e);
            if (e.today) p.today++; else p.week++;
            by.set(v.id, p);
        }
        let list = [...by.values()];
        list = me
            ? list.sort((a, b) => distanceM(me, a.venue) - distanceM(me, b.venue))
            : list.sort((a, b) => b.events.length - a.events.length);
        return { places: list, noCoords: none };
    }, [events, venues, me]);

    // 장소를 고르면(핀·목록) 배율은 그대로 두고 지도를 그 장소로 옮긴다. 고른 장소의 행사는 지도 아래에 나오므로 가운데로 옮기면 가리지 않는다
    function pick(p: Place) {
        setSelected(p.venue.id);
        const map = mapRef.current;
        if (map && window.naver?.maps) map.panTo(new window.naver.maps.LatLng(p.venue.lat, p.venue.lng));
    }

    // 지도 만들기·핀 그리기
    useEffect(() => {
        if (!venues || !box.current || mapFailed) return;
        let cancelled = false;
        const guard = window.setTimeout(() => { if (!cancelled && !mapRef.current) setMapFailed(true); }, 6000);
        loadNaverMaps().then(() => {
            if (cancelled || !box.current) return;
            const { maps } = window.naver;
            if (!mapRef.current) {
                mapRef.current = new maps.Map(box.current, {
                    zoom: 12, zoomControl: true,
                    zoomControlOptions: { position: maps.Position.TOP_RIGHT, style: maps.ZoomControlStyle.SMALL },
                    mapDataControl: false, scaleControl: false,
                });
            }
            const map = mapRef.current;
            setMapReady(true);
            markers.current.forEach(m => m.setMap(null));
            markers.current = [];
            const b = new maps.LatLngBounds();
            for (const p of places) {
                const pos = new maps.LatLng(p.venue.lat, p.venue.lng);
                b.extend(pos);
                // 핀 안 글자는 숫자뿐 (데이터를 HTML 로 넣지 않는다)
                const m = new maps.Marker({
                    position: pos, map, title: `${p.venue.name} · 행사 ${p.events.length}건`,
                    icon: { content: `<div class="pica-pin" data-selected="${selected === p.venue.id}">${p.events.length}</div>`, anchor: new maps.Point(13, 13) },
                    zIndex: selected === p.venue.id ? 40 : undefined,
                });
                maps.Event.addListener(m, "click", () => pick(p));
                markers.current.push(m);
            }
            if (!fitted.current && places.length > 0) {
                fitted.current = true;
                if (places.length > 1 && !selected) map.fitBounds(b, { top: 40, right: 40, bottom: 40, left: 40 });
                else if (places.length === 1 && !selected) map.setCenter(new maps.LatLng(places[0].venue.lat, places[0].venue.lng));
            }
            window.clearTimeout(guard);
        }).catch(() => { if (!cancelled) setMapFailed(true); });
        return () => { cancelled = true; window.clearTimeout(guard); };
    }, [venues, places, selected, mapFailed]);

    // 위치를 허락하면 지도에 내 위치 점을 찍고, 지금 배율 그대로 내 위치로 옮긴다(위치는 이 화면에서만 쓰고 보내지 않는다)
    useEffect(() => {
        const map = mapRef.current;
        if (!me || !map || !window.naver?.maps) return;
        const { maps } = window.naver;
        const at = new maps.LatLng(me.lat, me.lng);
        if (!meMarker.current) {
            meMarker.current = new maps.Marker({
                position: at, map, title: "내 위치", zIndex: 50,
                icon: { content: '<div class="pica-origin" aria-hidden="true"></div>', anchor: new maps.Point(9, 9) },
            });
        } else {
            meMarker.current.setPosition(at);
        }
        map.panTo(at);
    }, [me, mapReady]);

    const sel = places.find(p => p.venue.id === selected) || null;
    const askLocation = () => navigator.geolocation?.getCurrentPosition(
        pos => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* 거절하면 행사 수 순 그대로 */ },
        { maximumAge: 600000, timeout: 8000 },
    );
    // 이미 위치를 허락한 사람은 지도를 열 때 바로 내 위치를 보여 준다(묻는 창은 띄우지 않는다)
    useEffect(() => {
        if (!venues || mapFailed) return;
        navigator.permissions?.query({ name: "geolocation" as PermissionName })
            .then(st => { if (st.state === "granted") askLocation(); })
            .catch(() => { /* 지원하지 않는 브라우저는 버튼으로만 */ });
    }, [venues, mapFailed]);

    return (
        <div className="pica-portal fixed inset-0 z-[1200]" role="dialog" aria-modal="true" aria-label="지도">
            <button type="button" aria-label="지도 닫기" onClick={close} className="absolute inset-0 bg-[rgba(30,26,21,.5)]" />
            <div className="absolute inset-x-0 bottom-0 top-[58px] overflow-y-auto rounded-t-[22px] bg-paper pb-24 shadow-[0_-8px_24px_rgba(30,26,21,.25)] [scrollbar-width:none] lg:left-auto lg:right-0 lg:top-[60px] lg:w-[560px] lg:rounded-none lg:rounded-tl-[22px]">
                <span className="mx-auto mt-2 block h-[5px] w-10 rounded bg-[#CFC5B4]" aria-hidden />
                <div className="flex items-center justify-between px-4 pb-2.5 pt-2">
                    <div>
                        <h2 className="pica-display text-[23px] leading-[1.2] text-ink">지도</h2>
                        <p className="mt-[3px] flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                            {summary && <i className="inline-flex h-[22px] items-center rounded-full bg-accent px-2 text-[12px] font-bold not-italic text-white">{summary}</i>}
                            <b className="pica-num text-ink">{events.length}</b>건 · 장소 <b className="pica-num text-ink">{venues ? places.length : "…"}</b>곳
                        </p>
                    </div>
                    <button type="button" onClick={close} aria-label="지도 내리기" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-[0_0_0_1px_var(--pk-line)]">
                        <ChevronDown size={22} />
                    </button>
                </div>

                <div className="relative mx-3 h-[290px] overflow-hidden rounded-2xl bg-land lg:h-[420px]">
                    {mapFailed ? (
                        <p className="grid h-full place-items-center px-6 text-center text-[14px] text-ink-soft">지도를 불러오지 못했어요. 아래 장소 목록은 그대로 볼 수 있어요.</p>
                    ) : <div ref={box} className="h-full w-full" />}
                    {!mapFailed && (
                        <button type="button" onClick={askLocation} aria-label="내 위치에서 가까운 순으로" className="absolute bottom-2.5 right-2.5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(30,26,21,.25)]">
                            <LocateFixed size={19} />
                        </button>
                    )}
                </div>

                {sel && (
                    <div className="mt-3.5">
                        <div className="flex items-baseline justify-between px-4 pb-2.5">
                            <span><b className="text-[16px] font-extrabold">{sel.venue.name}</b>{" "}
                                <span className="text-[12.5px] text-ink-soft">{[sel.today && `오늘 ${sel.today}`, sel.week && `예정 ${sel.week}`].filter(Boolean).join(" · ")}</span></span>
                            <Link href={`/venues/${sel.venue.id}`} className="whitespace-nowrap text-[13px] font-bold text-accent">공간 정보 ›</Link>
                        </div>
                        <div className="pica-shelf-row">
                            {sel.events.slice(0, 12).map(e => <ShelfTile key={e.id} c={e} />)}
                        </div>
                    </div>
                )}

                <ul className="mx-4 mt-3.5 border-t border-line">
                    {places.filter(p => p.venue.id !== selected).map(p => (
                        <li key={p.venue.id}>
                            <button type="button" onClick={() => pick(p)} className="flex h-[50px] w-full items-center gap-2.5 border-b border-line text-left text-[14.5px] font-semibold">
                                <b className="pica-num grid h-[26px] min-w-[26px] place-items-center rounded-full bg-card px-1 text-[14px] shadow-[inset_0_0_0_1.5px_var(--pk-ink)]">{p.events.length}</b>
                                <span className="flex-1 truncate">{p.venue.name}</span>
                                <small className="text-[12.5px] font-medium text-ink-soft">{[p.today && `오늘 ${p.today}`, p.week && `예정 ${p.week}`].filter(Boolean).join(" · ")}</small>
                            </button>
                        </li>
                    ))}
                    {noCoords > 0 && (
                        <li className="flex h-[50px] items-center gap-2.5 border-b border-line text-[14px] text-ink-soft">
                            <b className="pica-num grid h-[26px] min-w-[26px] place-items-center rounded-full px-1 text-[14px] shadow-[inset_0_0_0_1.5px_var(--pk-line)]">{noCoords}</b>
                            위치 정보 없음 (지도에 표시하지 않음)
                        </li>
                    )}
                </ul>
                <p className="mx-4 mt-3 text-[12.5px] leading-[1.6] text-ink-soft">
                    {me ? "가까운 순으로 정렬했어요." : "«가까운 순»은 위치를 허락하면 켜져요."} 위치는 순서를 정하는 데만 써요.
                </p>
            </div>
            <button type="button" onClick={close} className="fixed bottom-[18px] left-1/2 z-[1201] flex h-[46px] -translate-x-1/2 lg:left-auto lg:right-[280px] lg:translate-x-1/2 items-center gap-[7px] rounded-full bg-ink pl-4 pr-5 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(20,23,28,.3)]">
                <List size={18} aria-hidden /> 목록
            </button>
        </div>
    );
}
