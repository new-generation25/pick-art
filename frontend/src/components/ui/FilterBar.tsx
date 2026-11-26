"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Checkbox, Drawer, Menu } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ChevronDown, LocateFixed, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BUSAN_DISTRICTS, GN_REGIONS, regionFromPath, regionPath } from "@/lib/regions";
import { CATEGORIES as FEED_CATEGORIES, normalizeCategory } from "@/lib/categories";

const REGIONS = ["전체", ...GN_REGIONS];
const CATEGORIES = ["전체", ...FEED_CATEGORIES];
// 아이와 같이 가기 좋은 곳(specs/004). 값은 주소의 kids (lib/kids.ts readKidsParam)
const KIDS_FILTERS = [
    { label: "전체", value: "전체" },
    { label: "아이와", value: "any" },
    { label: "어린 아이(~6세)", value: "young" },
    { label: "초등학생", value: "school" },
];
const DATE_FILTERS = [
    { label: "전체", value: "all" },
    { label: "오늘", value: "today" },
    { label: "이번 주", value: "week" },
    { label: "이번 달", value: "month" },
    { label: "곧 끝남", value: "ending" }
];

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
        <div className="pica-chiprow" role="group" aria-label={label}>{children}</div>
    </div>
);

// 칩 한 줄(시안 f01): 기간 · 지역 · 분야 · 아이와 + 오른쪽 «필터». 넘겨도 맨 위 줄 아래에 붙는다
function Pick({ label, on, items, current, onPick }: { label: string; on: boolean; items: { label: string; value: string }[]; current: string; onPick: (v: string) => void }) {
    return (
        <Menu shadow="md" width={200} position="bottom-start">
            <Menu.Target>
                <button type="button" className="pica-chip" aria-pressed={on} aria-haspopup="menu">
                    {label}<ChevronDown size={15} aria-hidden />
                </button>
            </Menu.Target>
            <Menu.Dropdown className="pica-portal" mah={360} style={{ overflowY: "auto" }}>
                {items.map(it => (
                    <Menu.Item key={it.value} onClick={() => onPick(it.value)} fw={it.value === current ? 700 : 500}
                        c={it.value === current ? "var(--pk-accent)" : undefined}>
                        {it.label}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

export function FilterBar({ subs = [], total }: { subs?: { name: string; n: number }[]; total?: number }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    // 지역 고정 주소(/region/김해)면 주소의 지역, 홈이면 ?region= (자동 적용을 끈 '전체'만 남는다)
    const { region: pathRegion, district: pathDistrict } = regionFromPath(pathname);

    const currentRegion = pathRegion || searchParams.get("region") || "전체";
    const currentCategory = normalizeCategory(searchParams.get("category")) || "전체";
    const currentSub = searchParams.get("sub") || "";
    const currentDate = searchParams.get("date") || "all";
    const currentKids = searchParams.get("kids") || "전체";
    const showEnded = searchParams.get("ended") === "1";
    const [myRegion, setMyRegion] = useState<string | null>(null);
    const [opened, { open, close }] = useDisclosure(false);

    // 설정의 "내 지역 자동 적용"이 켜진 로그인 사용자: 주소에 지역이 없으면 거주 지역을 건다.
    // 사용자가 '전체'를 고르면 주소에 region=전체 가 남아 다시 걸지 않는다.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data: profile } = await supabase
                .from("profiles")
                .select("region, auto_region")
                .eq("id", session.user.id)
                .single();
            if (cancelled || !profile || profile.auto_region === false || !GN_REGIONS.includes(profile.region)) return;
            setMyRegion(profile.region);
            // 홈에서 지역을 고르지 않았을 때만 (지역 주소에 들어온 사람은 그 지역을 그대로 본다)
            if (pathname === "/" && !searchParams.get("region")) {
                const qs = searchParams.toString();
                router.replace(`${regionPath(profile.region)}${qs ? `?${qs}` : ""}`);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 지역은 주소 경로(/region/김해)로, 나머지 조건은 ?뒤에 둔다. 공유한 링크가 곧 지역 주소가 된다
    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        let region = currentRegion;
        let district: string | null = pathDistrict;
        if (key === "region") {
            region = value;
            district = null;
            params.delete("region");
        } else if (key === "district") {
            district = value === "전체" ? null : value;
        } else if (value === "전체" || value === "all") {
            params.delete(key);
            if (key === "category") params.delete("sub"); // 분야를 바꾸면 세부도 푼다 (specs/015)
        } else {
            params.set(key, value);
            if (key === "category") params.delete("sub");
        }
        if (region === "전체" && myRegion) params.set("region", "전체"); // 자동 적용 사용자가 고른 '전체'는 주소에 남긴다
        else if (region === "전체") params.delete("region");
        const qs = params.toString();
        router.push(`${region === "전체" ? "/" : regionPath(region, district)}${qs ? `?${qs}` : ""}`);
    };

    const dateLabel = DATE_FILTERS.find(f => f.value === currentDate)?.label;
    const kidsOn = currentKids !== "전체";
    const extraOn = showEnded || (kidsOn && currentKids !== "any") || !!pathDistrict;


    return (
        <>
            <div className="sticky top-[60px] z-[50] -mx-4 bg-paper/95 backdrop-blur sm:mx-0">
            <div className="flex items-center gap-1.5 py-1.5 pr-2.5 sm:pr-0">
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pl-3 [scrollbar-width:none] sm:pl-0" role="group" aria-label="필터">
                    <Pick label={currentDate === "all" ? "기간" : dateLabel || "기간"} on={currentDate !== "all"} items={DATE_FILTERS} current={currentDate} onPick={v => updateFilters("date", v)} />
                    <Pick label={currentRegion === "전체" ? "지역" : pathDistrict ? `${currentRegion} ${pathDistrict}` : currentRegion} on={currentRegion !== "전체"}
                        items={REGIONS.map(r => ({ label: r, value: r }))} current={currentRegion} onPick={v => updateFilters("region", v)} />
                    <Pick label={currentCategory === "전체" ? "분야" : currentCategory} on={currentCategory !== "전체"}
                        items={CATEGORIES.map(c => ({ label: c, value: c }))} current={currentCategory} onPick={v => updateFilters("category", v)} />
                    <button type="button" className="pica-chip" aria-pressed={kidsOn} onClick={() => updateFilters("kids", kidsOn ? "전체" : "any")}>
                        {kidsOn ? KIDS_FILTERS.find(k => k.value === currentKids)?.label : "아이와"}
                    </button>
                </div>
                <button type="button" onClick={open}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-3 text-[13.5px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--pk-ink)]"
                    aria-label={extraOn ? "필터 (켜진 조건 있음)" : "필터"}>
                    <SlidersHorizontal size={16} aria-hidden />필터{extraOn && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
                </button>
            </div>
            {/* 세부 갈래 칩 (specs/015): 분야를 골랐을 때만. 건수 0인 갈래는 숨긴다 */}
            {currentCategory !== "전체" && subs.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 pl-3 pr-2.5 [scrollbar-width:none] sm:pl-0" role="group" aria-label={`${currentCategory} 세부 갈래`}>
                    <button type="button" className="pica-chip !h-8 !px-3 !text-[13px]" aria-pressed={!currentSub} onClick={() => updateFilters("sub", "전체")}>
                        {currentCategory} 전체{typeof total === "number" && <span className="pica-num opacity-70">{total}</span>}
                    </button>
                    {subs.map(s => (
                        <button key={s.name} type="button" className="pica-chip !h-8 !px-3 !text-[13px]" aria-pressed={currentSub === s.name} onClick={() => updateFilters("sub", s.name)}>
                            {s.name}<span className="pica-num opacity-70">{s.n}</span>
                        </button>
                    ))}
                </div>
            )}
            </div>

            {myRegion && currentRegion === myRegion && (
                <p className="mt-1 text-[12.5px] text-ink-soft">
                    내 지역(<b className="text-ink">{myRegion}</b>)을 먼저 보여 줍니다. 지역 칩에서 바꿀 수 있어요.
                </p>
            )}

            {/* «필터»: 모든 조건 (언제·지역·구·군·분야·아이 나이·끝난 행사) */}
            <Drawer opened={opened} onClose={close} position="bottom" size={440} title="필터" radius="lg" classNames={{ content: "pica-portal" }}
                styles={{ title: { fontWeight: 700, fontSize: 18 }, body: { paddingBottom: 24 } }}>
                <div className="flex flex-col gap-3">
                    <Link href="/nearby" className="pica-chip w-max" onClick={close}>
                        <LocateFixed size={14} aria-hidden />내 주변 가까운 순으로 보기
                    </Link>
                    <Row label="언제">
                        {DATE_FILTERS.map(f => (
                            <button key={f.value} type="button" className="pica-chip" aria-pressed={currentDate === f.value} onClick={() => updateFilters("date", f.value)}>{f.label}</button>
                        ))}
                    </Row>
                    <Row label="지역">
                        {REGIONS.map(r => (
                            <button key={r} type="button" className="pica-chip" aria-pressed={currentRegion === r} onClick={() => updateFilters("region", r)}>{r}</button>
                        ))}
                    </Row>
                    {/* 부산을 고르면 구·군 (specs/010). 장소 주소로 가른 것이라 장소를 모르는 행사는 «전체»에만 나온다 */}
                    {currentRegion === "부산" && (
                        <Row label="구·군">
                            {[{ name: "전체" }, ...BUSAN_DISTRICTS].map(d => (
                                <button key={d.name} type="button" className="pica-chip" aria-pressed={(pathDistrict || "전체") === d.name} onClick={() => updateFilters("district", d.name)}>{d.name}</button>
                            ))}
                        </Row>
                    )}
                    <Row label="분야">
                        {CATEGORIES.map(c => (
                            <button key={c} type="button" className="pica-chip" aria-pressed={currentCategory === c} onClick={() => updateFilters("category", c)}>{c}</button>
                        ))}
                    </Row>
                    <Row label="아이">
                        {KIDS_FILTERS.map(k => (
                            <button key={k.value} type="button" className="pica-chip" aria-pressed={currentKids === k.value} onClick={() => updateFilters("kids", k.value)}>{k.label}</button>
                        ))}
                    </Row>
                    {/* 끝난 행사: 기본은 숨김. 켜면 종료 1개월 이내 행사가 "종료" 표시와 함께 맨 뒤에 붙는다 */}
                    <Checkbox
                        checked={showEnded}
                        onChange={(e) => updateFilters("ended", e.currentTarget.checked ? "1" : "all")}
                        label="종료된 행사도 보기 (종료 1개월 이내)"
                        color="var(--pk-accent)"
                        size="sm"
                        styles={{ label: { color: 'var(--pk-ink-soft)', fontWeight: 500 } }}
                    />
                </div>
            </Drawer>
        </>
    );
}
