"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@mantine/core";
import { LocateFixed, Bus, Car } from "lucide-react";
import { EventCard } from "@/components/ui/EventCard";
import { buildNearby, formatDistance, type LatLng, type Period } from "@/lib/nearby";
import { detectPlatform, naverRouteLinks, type RouteMode } from "@/lib/naverMap";
import { CATEGORIES } from "@/lib/categories";
import { formatPeriod } from "@/lib/utils";
import type { NearbyRow } from "@/lib/nearbyData";

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
        isFree: !!e.is_free,
    };
}

function RouteButtons({ e, appname }: { e: NearbyRow; appname: string }) {
    const open = (mode: RouteMode) => {
        const links = naverRouteLinks({
            name: e.venue || e.title,
            region: e.region,
            lat: e.coords?.lat,
            lng: e.coords?.lng,
            mode,
            platform: detectPlatform(navigator.userAgent),
            appname,
        });
        if (links.primary === links.fallback || links.primary.startsWith("https://")) {
            window.open(links.primary, "_blank", "noopener");
            return;
        }
        // 앱이 없으면 화면이 그대로 남는다 → 1.5초 뒤 네이버지도 웹으로
        const t = window.setTimeout(() => { if (!document.hidden) window.location.href = links.fallback; }, 1500);
        const clear = () => { if (document.hidden) window.clearTimeout(t); };
        document.addEventListener("visibilitychange", clear, { once: true });
        window.location.href = links.primary;
    };
    return (
        <div className="flex gap-2">
            <button type="button" className="pica-chip" onClick={() => open("public")}>
                <Bus size={14} aria-hidden /> 대중교통 길찾기
            </button>
            <button type="button" className="pica-chip" onClick={() => open("car")}>
                <Car size={14} aria-hidden /> 자동차 길찾기
            </button>
        </div>
    );
}

export function NearbyClient({ rows, today, appname }: { rows: NearbyRow[]; today: string; appname: string }) {
    const router = useRouter();
    const sp = useSearchParams();
    const period = (PERIODS.some(p => p.value === sp.get("p")) ? sp.get("p") : "week") as Period;
    const range = RANGES.some(r => r.value === sp.get("r")) ? sp.get("r")! : "all";
    const category = sp.get("c") || "전체";

    const [geo, setGeo] = useState<GeoState>("idle");
    const [origin, setOrigin] = useState<Origin | null>(null);

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
                setOrigin({
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
                            지역별로 보려면 <Link className="font-bold underline" href="/">전체 행사에서 지역을 고르세요</Link>.
                        </div>
                    )}
                </div>
            )}

            {origin && result && (
                <>
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

                    {tooFar && (
                        <div className="pica-box mt-5 p-4 text-[15px]">부산·경남 행사만 소개해요. 가장 가까운 행사도 {formatDistance(result.near[0].distanceM)} 떨어져 있어요.</div>
                    )}

                    {result.near.length === 0 && result.unknown.length === 0 ? (
                        <div className="pica-box mt-6 flex flex-col gap-3 p-5">
                            <p className="text-[16px] font-bold text-ink">가까운 곳에 이 기간 행사가 없어요.</p>
                            <div className="flex flex-wrap gap-2">
                                {period !== "2w" && <button type="button" className="pica-chip" onClick={() => setParam("p", "2w", "week")}>2주로 넓히기</button>}
                                {range !== "all" && <button type="button" className="pica-chip" onClick={() => setParam("r", "all", "all")}>거리 제한 풀기</button>}
                            </div>
                        </div>
                    ) : (
                        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {result.near.map((e, i) => (
                                <li key={e.id} className="flex flex-col gap-2">
                                    <p className="text-[15px] font-bold text-ink">{formatDistance(e.distanceM, origin.approx)}</p>
                                    <EventCard event={toCard(e)} priority={i < 3} />
                                    <RouteButtons e={e} appname={appname} />
                                </li>
                            ))}
                        </ol>
                    )}

                    {result.unknown.length > 0 && (
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
