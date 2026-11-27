"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@mantine/core";
import { LocateFixed } from "lucide-react";
import { EventCard } from "@/components/ui/EventCard";
import { buildNearby, formatDistance, type LatLng, type Period } from "@/lib/nearby";
import { CATEGORIES } from "@/lib/categories";
import { formatPeriod } from "@/lib/utils";
import type { NearbyRow } from "@/lib/nearbyData";
import { AREAS, findArea } from "@/lib/areaCenters";
import { RouteButtons } from "@/components/ui/RouteButtons";
import { NearbyMap } from "./NearbyMap";

const AREA_KEY = "pica.nearby.area";

function AreaSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
    return (
        <label className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
            <span className="font-semibold">지역 고르기</span>
            <select
                className="pica-box px-3 py-2 text-[15px]"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label="거리 기준 지역"
            >
                <option value="">선택하세요</option>
                <optgroup label="부산">
                    {AREAS.filter(a => a.city === "부산").map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </optgroup>
                <optgroup label="경남">
                    {AREAS.filter(a => a.city !== "부산").map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </optgroup>
            </select>
        </label>
    );
}

/**
 * 내 주변 행사 (specs/002-nearby-events, contracts/nearby-ui.md)
 * - 위치는 「내 위치로 찾기」를 누를 때만 묻고, 이 화면 상태에만 둔다. 서버·URL·저장소에 남기지 않는다.
 * - URL 에는 거리(r)·기간(p)·분야(c)만 둔다.
 */

type Origin = { point: LatLng; label: string; approx: boolean };
type GeoState = "idle" | "asking" | "ok" | "denied" | "timeout" | "unsupported";

const PERIODS: { value: Period; label: string }[] = [
    { value: "today", label: "오늘" },
    { value: "weekend", label: "이번 주말" },
    { value: "week", label: "이번 주" },
    { value: "2w", label: "2주" },
];
const RANGES: { value: string; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "3", label: "3km 안" },
    { value: "10", label: "10km 안" },
    { value: "30", label: "30km 안" },
];
const FAR_M = 50000; // 가장 가까운 행사가 이보다 멀면 부산·경남 밖으로 본다

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[48px_minmax(0,1fr)]">
        <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
        <div className="pica-chiprow" role="group" aria-label={label}>{children}</div>
    </div>
);

function toCard(e: NearbyRow) {
    return {
        id: e.id,
        title: e.title,
        category: e.category || "",
        date: formatPeriod(e.event_date_start, e.event_date_end),
        location: e.venue || e.region || "",
        imageUrl: e.poster_image_url || "",
        posterPlaceholder: e.poster_placeholder,
        source: e.source,
        isFree: !!e.is_free,
    };
}

/** 거리순 목록에서 같은 장소(좌표가 같으면 같은 곳으로 본다)를 붙어 있는 대로 한 묶음으로 */
function groupByPlace<T extends { id: string; venue_id?: string | null; coords?: { lat: number; lng: number } | null }>(items: T[]): { key: string; items: T[] }[] {
    const out: { key: string; items: T[] }[] = [];
    const keyOf = (e: T) => e.coords ? `${e.coords.lat.toFixed(5)},${e.coords.lng.toFixed(5)}` : (e.venue_id || e.id);
    for (const e of items) {
        const k = keyOf(e);
        const last = out[out.length - 1];
        if (last && last.key === k) last.items.push(e);
        else out.push({ key: k, items: [e] });
    }
    return out;
}

/** 묶음 머리의 장소 이름: «김해문화의전당 (누리홀)» → «김해문화의전당» (같은 건물의 홀 이름은 카드에 남는다) */
function placeName(venue: string): string {
    return venue.replace(/\s*\([^)]*\)\s*$/, "").trim() || venue;
}

export function NearbyClient({ rows, today, appname }: { rows: NearbyRow[]; today: string; appname: string }) {
    const router = useRouter();
    const sp = useSearchParams();
    const period = (PERIODS.some(p => p.value === sp.get("p")) ? sp.get("p") : "week") as Period;
    const range = RANGES.some(r => r.value === sp.get("r")) ? sp.get("r")! : "all";
    const category = sp.get("c") || "전체";
    // 보기 방식(specs/005): 주소 v=map 이면 지도. 지도를 못 불러오면 목록으로 돌아가고 안내한다
    const [mapFailed, setMapFailed] = useState(false);
    const view = sp.get("v") === "map" && !mapFailed ? "map" : "list";

    const [geo, setGeo] = useState<GeoState>("idle");
    const [gpsOrigin, setGpsOrigin] = useState<Origin | null>(null);
    const area = findArea(sp.get("area"));
    // 위치 > 고른 지역(URL area). 지역은 시청·구청 좌표라 URL 에 이름만 둬도 방문자 위치가 드러나지 않는다
    const origin = useMemo<Origin | null>(() => gpsOrigin
        ?? (area ? { point: { lat: area.lat, lng: area.lng }, label: `${area.city === "부산" ? "부산 " + area.label : area.label} 중심 기준`, approx: false } : null),
    [gpsOrigin, area]);

    // 이 기기에서 전에 고른 지역이 있으면 다시 쓴다(FR-005, 기기 안에만 저장)
    useEffect(() => {
        if (sp.get("area")) return;
        let saved: string | null = null;
        try { saved = localStorage.getItem(AREA_KEY); } catch { /* 저장소를 못 쓰면 무시 */ }
        if (saved && findArea(saved)) {
            const params = new URLSearchParams(sp.toString());
            params.set("area", saved);
            router.replace(`/nearby?${params.toString()}`, { scroll: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const chooseArea = (key: string) => {
        try { if (key) localStorage.setItem(AREA_KEY, key); else localStorage.removeItem(AREA_KEY); } catch { /* 무시 */ }
        setGpsOrigin(null);
        setParam("area", key, "");
    };

    const setParam = (key: string, value: string, empty: string) => {
        const params = new URLSearchParams(sp.toString());
        if (value === empty) params.delete(key); else params.set(key, value);
        const qs = params.toString();
        router.replace(qs ? `/nearby?${qs}` : "/nearby", { scroll: false });
    };

    const locate = () => {
        if (!("geolocation" in navigator)) { setGeo("unsupported"); return; }
        setGeo("asking");
        let done = false;
        const guard = window.setTimeout(() => { if (!done) { done = true; setGeo("timeout"); } }, 6000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (done) return;
                done = true; window.clearTimeout(guard);
                setGpsOrigin({
                    point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
                    label: "내 위치 기준",
                    approx: pos.coords.accuracy > 1000,
                });
                setGeo("ok");
            },
            (err) => {
                if (done) return;
                done = true; window.clearTimeout(guard);
                setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "timeout");
            },
            { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 6000 },
        );
    };

    const result = useMemo(() => {
        if (!origin) return null;
        return buildNearby(rows, {
            origin: origin.point,
            today,
            period,
            maxKm: range === "all" ? null : Number(range),
            category: category === "전체" ? null : category,
        });
    }, [origin, rows, today, period, range, category]);

    const tooFar = !!result && result.near.length > 0 && result.near[0].distanceM > FAR_M;

    return (
        <Container size="xl" pt={{ base: 24, sm: 40 }} pb={64}>
            <p className="text-[14px] font-bold text-accent">가까운 순서로</p>
            <h1 className="pica-display mt-2 text-[34px] leading-[1.15] text-ink sm:text-[48px]">내 주변 공연·전시·축제</h1>

            {!origin && (
                <div className="mt-6 flex flex-col gap-3">
                    <button type="button" className="pica-chip self-start" aria-pressed onClick={locate} disabled={geo === "asking"}>
                        <LocateFixed size={16} aria-hidden />
                        {geo === "asking" ? "위치 확인 중…" : "내 위치로 찾기"}
                    </button>
                    <p className="text-[14px] text-ink-soft">위치는 거리 계산에만 쓰고 저장하거나 보내지 않아요.</p>
                    {(geo === "denied" || geo === "timeout" || geo === "unsupported") && (
                        <div className="pica-box p-4 text-[15px] text-ink">
                            {geo === "denied" ? "위치 사용이 꺼져 있어요." : geo === "timeout" ? "위치를 받지 못했어요." : "이 브라우저는 위치를 지원하지 않아요."}{" "}
                            지역을 고르면 그 중심에서 가까운 순으로 보여 드려요.
                        </div>
                    )}
                    <AreaSelect value="" onChange={chooseArea} />
                </div>
            )}

            {origin && result && (
                <>
                    {!gpsOrigin && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <AreaSelect value={area?.key || ""} onChange={chooseArea} />
                            <button type="button" className="pica-chip" onClick={locate} disabled={geo === "asking"}>
                                <LocateFixed size={14} aria-hidden /> {geo === "asking" ? "위치 확인 중…" : "내 위치로 바꾸기"}
                            </button>
                        </div>
                    )}
                    {/* 위치가 대략적이거나(오차 1km 넘음) 부산·경남 밖이면 지역 고르기도 함께 보인다(specs/002 T036) */}
                    {gpsOrigin && (gpsOrigin.approx || tooFar) && (
                        <div className="mt-4 flex flex-col gap-2">
                            <p className="text-[14px] text-ink-soft">
                                {tooFar ? "지금 위치가 부산·경남 밖이에요." : "위치가 대략적으로만 잡혔어요."} 지역을 고르면 그 중심에서 가까운 순으로 보여 드려요.
                            </p>
                            <AreaSelect value="" onChange={chooseArea} />
                        </div>
                    )}
                    <p className="mt-3 text-[15px] text-ink-soft">
                        <b className="text-ink">{origin.label}{origin.approx ? " · 약" : ""}</b> · 거리 표시 <b className="text-ink">{result.near.length}건</b>
                        {result.unknown.length > 0 && <> · 거리 확인 안 됨 {result.unknown.length}건</>}
                    </p>

                    <div className="mt-5 flex flex-col gap-2.5">
                        <Row label="언제">
                            {PERIODS.map(p => (
                                <button key={p.value} type="button" className="pica-chip" aria-pressed={period === p.value} onClick={() => setParam("p", p.value, "week")}>{p.label}</button>
                            ))}
                        </Row>
                        <Row label="거리">
                            {RANGES.map(r => (
                                <button key={r.value} type="button" className="pica-chip" aria-pressed={range === r.value} onClick={() => setParam("r", r.value, "all")}>{r.label}</button>
                            ))}
                        </Row>
                        <Row label="분야">
                            {["전체", ...CATEGORIES].map(c => (
                                <button key={c} type="button" className="pica-chip" aria-pressed={category === c} onClick={() => setParam("c", c, "전체")}>{c}</button>
                            ))}
                        </Row>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="pica-chiprow" role="group" aria-label="보기 방식">
                            <button type="button" className="pica-chip" aria-pressed={view === "list"} onClick={() => setParam("v", "list", "list")}>목록</button>
                            <button type="button" className="pica-chip" aria-pressed={view === "map"} onClick={() => { setMapFailed(false); setParam("v", "map", "list"); }}>지도</button>
                        </div>
                        {mapFailed && <p className="text-[14px] text-ink" role="alert">지도를 불러오지 못해 목록으로 보여 드려요.</p>}
                    </div>

                    {tooFar && (
                        <div className="pica-box mt-5 p-4 text-[15px]">부산·경남 행사만 소개해요. 가장 가까운 행사도 {formatDistance(result.near[0].distanceM)} 떨어져 있어요.</div>
                    )}

                    {view === "map" ? (
                        <div className="mt-6">
                            <NearbyMap items={result.near} origin={origin.point} originLabel={origin.label} range={range} appname={appname} onFail={() => setMapFailed(true)} />
                            {result.unknown.length > 0 && (
                                <p className="mt-3 text-[14px] text-ink-soft">
                                    지도에 표시하지 못한 행사 <b className="text-ink">{result.unknown.length}건</b>(장소 위치 미확인) —{" "}
                                    <button type="button" className="font-bold text-ink underline underline-offset-4" onClick={() => setParam("v", "list", "list")}>목록에서 보기</button>
                                </p>
                            )}
                        </div>
                    ) : result.near.length === 0 && result.unknown.length === 0 ? (
                        <div className="pica-box mt-6 flex flex-col gap-3 p-5">
                            <p className="text-[16px] font-bold text-ink">가까운 곳에 이 기간 행사가 없어요.</p>
                            <div className="flex flex-wrap gap-2">
                                {period !== "2w" && <button type="button" className="pica-chip" onClick={() => setParam("p", "2w", "week")}>2주로 넓히기</button>}
                                {range !== "all" && <button type="button" className="pica-chip" onClick={() => setParam("r", "all", "all")}>거리 제한 풀기</button>}
                            </div>
                        </div>
                    ) : (
                        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {/* 같은 장소(좌표가 같음)의 행사는 한 묶음: 거리·장소 이름 한 번, 길찾기 한 번 (11/27 «김해문화의전당이 따로따로») */}
                            {groupByPlace(result.near).map((g, gi) => (
                                <li key={g.key} className="flex flex-col gap-2">
                                    <p className="flex items-baseline gap-2 text-[15px] font-bold text-ink">
                                        {formatDistance(g.items[0].distanceM, origin.approx)}
                                        {g.items[0].venue && <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink-soft">{placeName(g.items[0].venue)}{g.items.length > 1 ? ` · ${g.items.length}건` : ""}</span>}
                                    </p>
                                    {g.items.map((e, i) => <EventCard key={e.id} event={toCard(e)} priority={gi < 3 && i === 0} />)}
                                    <RouteButtons e={g.items[0]} appname={appname} />
                                </li>
                            ))}
                        </ol>
                    )}

                    {view === "list" && result.unknown.length > 0 && (
                        <section className="mt-10">
                            <h2 className="text-[18px] font-bold text-ink">거리 확인 안 됨</h2>
                            <p className="mt-1 text-[14px] text-ink-soft">장소 위치를 아직 확인하지 못한 행사예요. 시군으로만 표시해요.</p>
                            <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {result.unknown.map(e => (
                                    <li key={e.id} className="flex flex-col gap-2">
                                        <p className="text-[15px] font-bold text-ink-soft">{e.region || "지역 미상"}</p>
                                        <EventCard event={toCard(e)} />
                                        <RouteButtons e={e} appname={appname} />
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </>
            )}
        </Container>
    );
}
