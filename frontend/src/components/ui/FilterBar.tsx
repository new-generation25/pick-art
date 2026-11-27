"use client";

import { useEffect, useState } from "react";
import { homeDate } from "@/lib/homeDate";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Checkbox, Drawer, Menu } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ChevronDown, LocateFixed, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BUSAN_DISTRICTS, GN_REGIONS, guList, regionFromPath, regionList, regionPath, splitList } from "@/lib/regions";
import { CATEGORIES as FEED_CATEGORIES, normalizeCategory } from "@/lib/categories";

const REGIONS = ["전체", ...GN_REGIONS];
const GN_ONLY = GN_REGIONS.filter(r => r !== "부산"); // 경남 18개 시군
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
        <Menu shadow="md" width={200} position="bottom-start" transitionProps={{ transition: "pop-top-left", duration: 220, timingFunction: "cubic-bezier(.2,.8,.2,1)" }}>
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

    // 지역·분야는 필터 창에서 여러 개 고를 수 있다(주소 ?region=김해,양산 · ?gu=해운대구,수영구 · ?category=공연,전시).
    // 위쪽 칩은 하나씩 고른다(고르면 그 하나로 바뀐다)
    const regions = pathRegion ? [pathRegion] : regionList(searchParams.get("region"));
    const gus = pathDistrict ? [pathDistrict] : guList(searchParams.get("gu"));
    const cats = splitList(searchParams.get("category")).map(c => normalizeCategory(c)).filter(c => FEED_CATEGORIES.includes(c));
    const currentRegion = regions.length === 1 ? regions[0] : regions.length ? "여럿" : "전체";
    const currentCategory = cats.length === 1 ? cats[0] : cats.length ? "여럿" : "전체";
    const currentSub = searchParams.get("sub") || "";
    // 주소에 기간이 없으면 «이번 주»가 기본이다(lib/homeDate.ts). «전체»는 date=all 로 주소에 남긴다
    const currentDate = homeDate(searchParams.get("date"), searchParams.get("q"), searchParams.get("section"));
    const currentKids = searchParams.get("kids") || "전체";
    const showEnded = searchParams.get("ended") === "1";
    const [myRegion, setMyRegion] = useState<string | null>(null);
    const [opened, { open, close }] = useDisclosure(false);
    // 필터 창의 지역·구·분야는 고르는 동안 창 안에만 두고(초안), «결과 보기»나 창을 닫을 때 한 번에 적용한다.
    // 누를 때마다 주소가 바뀌면 지역 주소(/region/…)와 홈 사이를 오가며 창이 닫혀 여러 개를 고를 수 없다
    const [draft, setDraft] = useState<{ r: string[]; g: string[]; c: string[] } | null>(null);

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

    // 지역은 하나면 주소 경로(/region/gimhae, /region/busan/haeundae)로, 여럿이면 홈 ?region=김해,양산 로. 나머지 조건은 ?뒤에 둔다.
    // 공유한 링크가 곧 그 조건이다
    const go = (nextRegions: string[], nextGus: string[], params: URLSearchParams) => {
        params.delete("region");
        params.delete("gu");
        let rs = nextRegions.filter(r => GN_REGIONS.includes(r));
        const gs = rs.includes("부산") ? nextGus : [];
        // 경남 18곳과 부산 전체를 모두 고르면 지역 조건이 없는 것과 같다 → «전체»로 (11/27 «창원 외 18»이 헷갈림)
        if (gs.length === 0 && GN_REGIONS.every(r => rs.includes(r))) rs = [];
        let path = "/";
        if (rs.length === 0) {
            if (myRegion) params.set("region", "전체"); // 자동 적용 사용자가 고른 '전체'는 주소에 남긴다
        } else if (rs.length === 1 && gs.length <= 1) {
            path = regionPath(rs[0], gs[0] ?? null);
        } else if (rs.length === 1) {
            path = regionPath(rs[0]);
            params.set("gu", gs.join(","));
        } else {
            params.set("region", rs.join(","));
            if (gs.length) params.set("gu", gs.join(","));
        }
        const qs = params.toString();
        router.push(`${path}${qs ? `?${qs}` : ""}`);
    };

    // 위쪽 칩·«하나 고르기»: 지역·구·분야·기간·아이·끝난 행사
    const updateFilters = (key: string, value: string) => {
        const params = withDraftCategory(new URLSearchParams(searchParams.toString()));
        let rs = draft ? draft.r : regions;
        let gs = draft ? draft.g : gus;
        if (key === "region") {
            rs = value === "전체" ? [] : [value];
            gs = [];
        } else if (key === "district") {
            gs = value === "전체" ? [] : [value];
        } else if (key === "date") {
            params.set(key, value);   // «전체»(all)도 주소에 남겨 기본값(이번 주)과 구분한다
        } else if (value === "전체" || value === "all") {
            params.delete(key);
            if (key === "category") params.delete("sub"); // 분야를 바꾸면 세부도 푼다 (specs/015)
        } else {
            params.set(key, value);
            if (key === "category") params.delete("sub");
        }
        go(rs, gs, params);
    };

    // 필터 창 «여러 개 고르기»: 누르면 넣고, 다시 누르면 뺀다. «전체»는 모두 푼다
    const dr = draft ?? { r: regions, g: gus, c: cats };
    const toggle = (list: string[], v: string) => v === "전체" ? [] : list.includes(v) ? list.filter(x => x !== v) : [...list, v];
    const toggleRegion = (r: string) => {
        // «경남 전체»가 켜진 채 시군 하나를 누르면 그 시군만 (부산 전체 → 구 하나와 같은 방식, 11/27)
        const rs = GN_ONLY.includes(r) && GN_ONLY.every(x => dr.r.includes(x))
            ? [...dr.r.filter(x => !GN_ONLY.includes(x)), r]
            : toggle(dr.r, r);
        setDraft({ ...dr, r: rs, g: rs.includes("부산") ? dr.g : [] });
    };
    // 경남 전체: 18개 시군을 한꺼번에 넣거나 뺀다
    const allGn = GN_ONLY.every(r => dr.r.includes(r));
    const toggleAllGn = () => setDraft({ ...dr, r: allGn ? dr.r.filter(r => !GN_ONLY.includes(r)) : [...new Set([...dr.r, ...GN_ONLY])] });
    // 부산 전체: 부산(구 제한 없음). 이미 «부산 전체»면 부산을 뺀다
    const busanAll = dr.r.includes("부산") && dr.g.length === 0;
    const toggleBusanAll = () => busanAll
        ? setDraft({ ...dr, r: dr.r.filter(r => r !== "부산"), g: [] })
        : setDraft({ ...dr, r: dr.r.includes("부산") ? dr.r : [...dr.r, "부산"], g: [] });
    // 구·군을 고르면 부산도 같이 들어가고, 마지막 구를 빼면 부산도 뺀다
    const toggleGu = (g: string) => {
        const gs = toggle(dr.g, g);
        const rs = gs.length ? (dr.r.includes("부산") ? dr.r : [...dr.r, "부산"]) : dr.r.filter(r => r !== "부산");
        setDraft({ ...dr, r: rs, g: gs });
    };
    const toggleCategory = (c: string) => setDraft({ ...dr, c: toggle(dr.c, c) });
    function same(a: string[], b: string[]) { return a.length === b.length && a.every(x => b.includes(x)); }
    const draftChanged = !!draft && !(same(draft.r, regions) && same(draft.g, gus) && same(draft.c, cats));
    // 초안을 주소에 싣는다(분야 목록, 세부 갈래는 분야 하나일 때만 남김)
    function withDraftCategory(params: URLSearchParams) {
        if (!draft) return params;
        if (draft.c.length) params.set("category", draft.c.join(",")); else params.delete("category");
        if (!same(draft.c, cats)) params.delete("sub");
        return params;
    }
    const openDrawer = () => { setDraft({ r: regions, g: gus, c: cats }); open(); };
    const applyAndClose = () => {
        if (draftChanged && draft) go(draft.r, draft.g, withDraftCategory(new URLSearchParams(searchParams.toString())));
        setDraft(null);
        close();
    };

    const dateLabel = DATE_FILTERS.find(f => f.value === currentDate)?.label;
    const kidsOn = currentKids !== "전체";
    const extraOn = showEnded || (kidsOn && currentKids !== "any") || gus.length > 0 || regions.length > 1 || cats.length > 1;


    return (
        <>
            <div className="sticky top-[60px] z-[50] -mx-4 bg-paper/95 backdrop-blur sm:mx-0">
            <div className="flex items-center gap-1.5 py-1.5 pr-2.5 sm:pr-0">
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pl-3 [scrollbar-width:none] sm:pl-0" role="group" aria-label="필터">
                    <Pick label={currentDate === "all" ? "기간" : dateLabel || "기간"} on={currentDate !== "all"} items={DATE_FILTERS} current={currentDate} onPick={v => updateFilters("date", v)} />
                    <Pick label={regions.length === 0 ? "지역" : GN_ONLY.every(r => regions.includes(r)) ? (regions.includes("부산") ? (gus.length ? `경남·부산 ${gus.length}개 구` : "경남·부산") : "경남 전체") : regions.length > 1 ? `${regions[0]} 외 ${regions.length - 1}` : gus.length === 1 ? `${regions[0]} ${gus[0]}` : gus.length > 1 ? `${regions[0]} ${gus[0]} 외 ${gus.length - 1}` : regions[0]} on={regions.length > 0}
                        items={REGIONS.map(r => ({ label: r, value: r }))} current={currentRegion} onPick={v => updateFilters("region", v)} />
                    <Pick label={cats.length === 0 ? "분야" : cats.length > 1 ? `${cats[0]} 외 ${cats.length - 1}` : cats[0]} on={cats.length > 0}
                        items={CATEGORIES.map(c => ({ label: c, value: c }))} current={currentCategory} onPick={v => updateFilters("category", v)} />
                    <button type="button" className="pica-chip" aria-pressed={kidsOn} onClick={() => updateFilters("kids", kidsOn ? "전체" : "any")}>
                        {kidsOn ? KIDS_FILTERS.find(k => k.value === currentKids)?.label : "아이와"}
                    </button>
                </div>
                <button type="button" onClick={openDrawer}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-3 text-[13.5px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--pk-ink)]"
                    aria-label={extraOn ? "필터 (켜진 조건 있음)" : "필터"}>
                    <SlidersHorizontal size={16} aria-hidden />필터{extraOn && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
                </button>
            </div>
            {/* 세부 갈래 칩 (specs/015): 분야를 골랐을 때만. 건수 0인 갈래는 숨긴다 */}
            {cats.length === 1 && subs.length > 0 && (
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

            {/* «필터»: 모든 조건 (언제·지역·구·군·분야·아이 나이·끝난 행사) */}
            <Drawer opened={opened} onClose={applyAndClose} position="bottom" size={340} title={<>필터 <span className="ml-1 text-[12px] font-medium text-ink-soft">지역·분야는 여러 개 고를 수 있어요</span></>} radius="lg" classNames={{ content: "pica-portal pica-filter-drawer" }}
                styles={{ header: { paddingTop: 10, paddingBottom: 6, minHeight: 0 }, title: { fontWeight: 700, fontSize: 16 }, body: { paddingBottom: 14 } }}>
                <div className="flex flex-col gap-1.5">
                    <Row label="언제">
                        {DATE_FILTERS.map(f => (
                            <button key={f.value} type="button" className="pica-chip" aria-pressed={currentDate === f.value} onClick={() => updateFilters("date", f.value)}>{f.label}</button>
                        ))}
                    </Row>
                    {/* 지역·분야는 여러 개 고를 수 있다(누르면 넣고 다시 누르면 뺀다). 아무것도 안 고르면 모든 지역 */}
                    <Row label="경남">
                        <button type="button" className="pica-chip" aria-pressed={allGn} onClick={toggleAllGn}>경남 전체</button>
                        {GN_ONLY.map(r => (
                            <button key={r} type="button" className="pica-chip" aria-pressed={!allGn && dr.r.includes(r)} onClick={() => toggleRegion(r)}>{r}</button>
                        ))}
                    </Row>
                    {/* 부산은 구·군까지 (specs/010). 장소 주소로 가른 것이라 장소를 모르는 행사는 «부산 전체»에만 나온다 */}
                    <Row label="부산">
                        <button type="button" className="pica-chip" aria-pressed={busanAll} onClick={toggleBusanAll}>부산 전체</button>
                        {BUSAN_DISTRICTS.map(d => (
                            <button key={d.name} type="button" className="pica-chip" aria-pressed={dr.g.includes(d.name)} onClick={() => toggleGu(d.name)}>{d.name}</button>
                        ))}
                    </Row>
                    <Row label="분야">
                        {CATEGORIES.map(c => (
                            <button key={c} type="button" className="pica-chip" aria-pressed={c === "전체" ? dr.c.length === 0 : dr.c.includes(c)} onClick={() => toggleCategory(c)}>{c}</button>
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
                    {/* 맨 아래 한 줄: 내 주변(가까운 순) · 적용 */}
                    <div className="mt-0.5 flex gap-2">
                        <Link href="/nearby" onClick={() => { setDraft(null); close(); }}
                            className="flex h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13.5px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--pk-ink)]">
                            <LocateFixed size={15} aria-hidden />내 주변
                        </Link>
                        <button type="button" onClick={applyAndClose}
                            className="h-11 flex-1 rounded-full bg-accent text-[15px] font-bold text-on-accent">
                            {draftChanged ? "고른 조건으로 보기" : "닫기"}
                        </button>
                    </div>
                </div>
            </Drawer>
        </>
    );
}
