import Link from "next/link";
import { getDistrictVenueIds, getPublishedEvents } from "@/lib/supabase";
import { FeedSections } from "@/components/ui/FeedSections";
import { FilterBar } from "@/components/ui/FilterBar";
import { EventList } from "@/components/ui/EventList";
import { MapButton } from "@/components/ui/MapButton";
import { GN_REGIONS, guList, regionList, regionPath, splitList } from "@/lib/regions";
import { SECTION_LABELS, type SectionKey } from "@/lib/feedOrder";
import { Box } from "@mantine/core";
import { ArrowLeft, CalendarPlus, MessageCircle } from "lucide-react";
import { INSTAGRAM_URL, InstagramIcon } from "@/components/ui/InstagramLink";
import { PushButton } from "@/components/ui/PushButton";
import { InstallHint } from "@/components/ui/InstallApp";

/** 카카오톡 채널 «피카» 홈 (specs/017) */
const KAKAO_CHANNEL = "https://pf.kakao.com/_xoxdxkvX";

import { formatPeriod, todayKST } from "@/lib/utils";
import { orderFeed } from "@/lib/feedOrder";
import { ageLabel, fitsAge, kidsInfo, readKidsParam } from "@/lib/kids";
import { isEndingSoon } from "@/lib/eventDetails";
import { CATEGORIES, SUBCATEGORIES, normalizeCategory } from "@/lib/categories";
import { homeDate } from "@/lib/homeDate";

const DATE_LABEL: Record<string, string> = { today: "오늘", week: "이번 주", month: "이번 달", ending: "곧 끝남" };

export type HomeParams = {
  region?: string;
  category?: string;
  q?: string;
  date?: string;
  ended?: string;
  kids?: string;
  subscribed?: string;
  section?: string;
  sub?: string;
  gu?: string;
};

/** 홈 목록 화면. 지역 페이지(/region/[name])는 region 을 고정해 같은 화면을 쓴다 */
export async function HomeFeed({ params: resolvedParams, region, district }: { params: HomeParams; region?: string; district?: string }) {
  // 지역·분야는 필터 창에서 여러 개 고를 수 있다(«김해,양산», «공연,전시»). 위쪽 칩은 하나씩 (2026-11-26)
  const regions = region ? [region] : regionList(resolvedParams.region);
  const gus = district ? [district] : guList(resolvedParams.gu);
  if (gus.length && !regions.includes("부산")) regions.push("부산");
  // 예전 «체험·교육» 주소도 «체험»으로 (specs/015)
  const cats = [...new Set(splitList(resolvedParams.category).map(c => normalizeCategory(c)))].filter(c => (CATEGORIES as readonly string[]).includes(c));
  // 기간: 주소에 없으면 «이번 주»가 기본, «전체»는 date=all (lib/homeDate.ts)
  const dateKey = homeDate(resolvedParams.date, resolvedParams.q, resolvedParams.section);
  const filters = {
    region: regions.length === 1 ? regions[0] : undefined,
    regions: regions.length > 1 ? regions : undefined,
    category: cats.length === 1 ? cats[0] : undefined,
    categories: cats.length > 1 ? cats : undefined,
    search: resolvedParams.q,
    date: dateKey === "all" ? undefined : dateKey,
    ended: resolvedParams.ended
  };

  // 부산 구·군: 그 구에 있는 장소의 행사만 (장소를 모르는 행사는 «부산» 전체에만 나온다). 다른 지역 행사는 그대로
  const guVenues = new Set<string>();
  for (const g of gus) for (const id of await getDistrictVenueIds(g)) guVenues.add(id);
  const fetched = (await getPublishedEvents(filters)).filter((e: any) => !gus.length || e.region !== "부산" || guVenues.has(e.venue_id));

  // 아이와 같이 가기 좋은 곳(specs/004): 규칙·운영자 수정으로 행사마다 구분을 매기고, 「아이」 필터가 켜지면 맞는 것만 남긴다
  const kids = readKidsParam(resolvedParams.kids);
  const kidsOf = new Map(fetched.map((e: any) => [e.id, kidsInfo(e)]));
  const today = todayKST();
  // 「곧 끝남」(specs/006): 7일 넘게 하는 행사 중 7일 안에 끝나는 것
  const beforeSub = fetched
    .filter((e: any) => !kids.on || fitsAge(kidsOf.get(e.id)!, kids.age))
    .filter((e: any) => filters.date !== "ending" || isEndingSoon(e, today));
  // 세부 갈래(specs/015): 분야를 골랐을 때만. 칩에 쓸 세부별 건수는 세부로 거르기 전에 센다
  const subList = filters.category ? SUBCATEGORIES[filters.category] ?? [] : [];
  const sub = subList.includes(resolvedParams.sub || "") ? resolvedParams.sub! : undefined;
  const subCounts = subList.map(name => ({ name, n: beforeSub.filter((e: any) => e.subcategory === name).length })).filter(x => x.n > 0);
  const dbEvents = sub ? beforeSub.filter((e: any) => e.subcategory === sub) : beforeSub;

  // DB 행을 EventCard 모양으로
  const toCard = (event: any) => ({
    kidMark: kidsOf.get(event.id)?.group === "target",
    endingSoon: isEndingSoon(event, today),
    ageBadge: kids.on ? ageLabel(kidsOf.get(event.id)?.minMonths ?? null) : undefined,
    kidRank: kids.on ? (kidsOf.get(event.id)?.group === "target" ? 0 : 1) : 0,
    id: event.id,
    title: event.title,
    category: event.category,
    subcategory: event.subcategory,
    date: formatPeriod(event.event_date_start, event.event_date_end),
    location: event.venue || event.region,
    imageUrl: event.poster_image_url,
    posterPlaceholder: event.poster_placeholder,
    source: event.source,
    isFree: event.is_free,
    isEnded: !!event.event_date_end && event.event_date_end < today,
  });

  // 선반 칸 (specs/014): 날짜·장소·짧은 관람료·피카가 본 이유(사람이 쓴 값만)
  const shortPrice = (e: any) => e.is_free ? "무료" : (typeof e.price_info === "string" && e.price_info.trim().length <= 18 ? e.price_info.trim() : null);
  const toShelf = (e: any) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    subcategory: e.subcategory,
    start: e.event_date_start,
    end: e.event_date_end,
    venue: e.venue || e.region,
    imageUrl: e.poster_image_url,
    posterPlaceholder: e.poster_placeholder,
    source: e.source,
    price: shortPrice(e),
    note: typeof e.pica_note === "string" && e.pica_note.trim() ? e.pica_note.trim() : null,
    kidMark: kidsOf.get(e.id)?.group === "target",
    endingSoon: isEndingSoon(e, today),
    isEnded: !!e.event_date_end && e.event_date_end < today,
    kidRank: kids.on ? (kidsOf.get(e.id)?.group === "target" ? 0 : 1) : 0,
  });

  // 날짜 묶음(오늘·이번 주·다음 주·그 이후·상시·장기·최근 끝난 행사)과 묶음 안의 순서
  // 「아이」 필터가 켜지면 묶음 안에서 «아이 대상»을 먼저 (안정 정렬이라 그 안의 날짜 순서는 그대로)
  const ordered = orderFeed(dbEvents, today);
  const sections = ordered.map(s => ({
    key: s.key,
    cards: s.items.map(toShelf).sort((a, b) => a.kidRank - b.kidRank),
  }));

  // 기간 필터(오늘·이번 주)를 걸었어도 그 뒤 기간 행사는 아래에 접힌 한 줄로 보여 준다(«상시·장기»처럼, 11/27 운영자).
  // 다른 조건(지역·분야·세부·아이·검색)은 그대로 둔다
  const AFTER: Record<string, SectionKey[]> = { today: ["week", "next"], week: ["next"] };
  const extraKeys = resolvedParams.section ? [] : AFTER[filters.date || ""] ?? [];
  let extraSections: typeof sections = [];
  if (extraKeys.length) {
    const rest = (await getPublishedEvents({ ...filters, date: undefined }))
      .filter((e: any) => !gus.length || e.region !== "부산" || guVenues.has(e.venue_id));
    for (const e of rest) if (!kidsOf.has(e.id)) kidsOf.set(e.id, kidsInfo(e));
    const restRows = rest
      .filter((e: any) => !kids.on || fitsAge(kidsOf.get(e.id)!, kids.age))
      .filter((e: any) => !sub || e.subcategory === sub);
    extraSections = orderFeed(restRows, today)
      .filter(s => extraKeys.includes(s.key))
      .map(s => ({ key: s.key, cards: s.items.map(toShelf).sort((a, b) => a.kidRank - b.kidRank) }));
  }
  // 순서: 기간 안 묶음 → 접힌 다음 기간 → 상시·장기 → 최근 끝난 행사
  const tailKeys: SectionKey[] = ["long", "ended"];
  const shown = [
    ...sections.filter(s => !tailKeys.includes(s.key)),
    ...extraSections,
    ...sections.filter(s => tailKeys.includes(s.key)),
  ];

  // «모두 보기»(?section=…): 그 묶음만 세로 목록. 다른 조건은 그대로 둔다
  const base = region ? regionPath(region, district) : "/";
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(resolvedParams)) {
    if (typeof v === "string" && v && k !== "section" && k !== "subscribed" && !(region && k === "region")) keep.set(k, v);
  }
  const moreBase = `${base}${keep.toString() ? `?${keep.toString()}` : ""}`;
  // 접힌 다음 기간의 «모두 보기»는 기간 필터를 뺀 주소로
  const keepNoDate = new URLSearchParams(keep);
  keepNoDate.delete("date");
  const extraMoreBase = `${base}${keepNoDate.toString() ? `?${keepNoDate.toString()}` : ""}`;
  const sectionKey = resolvedParams.section as SectionKey | undefined;
  const one = sectionKey && SECTION_LABELS[sectionKey] ? ordered.find(s => s.key === sectionKey) : undefined;

  // 기본값(이번 주)만 걸린 상태는 «필터를 건» 것으로 치지 않는다
  const hasFilter = !!((regions.length && !region) || cats.length || sub || filters.search || resolvedParams.date || kids.on);
  // 기간 때문에 비어 보일 때 «전체 기간 보기»로 갈 주소(다른 조건은 그대로)
  const keepAllDates = new URLSearchParams(keep);
  keepAllDates.set("date", "all");
  const allDatesHref = `${base}?${keepAllDates.toString()}`;
  // 경남 18곳을 모두 골랐으면 «경남 전체»로 줄여 쓴다
  const GN_ONLY = GN_REGIONS.filter(r => r !== "부산");
  const allGn = GN_ONLY.every(r => regions.includes(r));
  const placeParts = allGn ? ["경남 전체", ...regions.filter(r => !GN_ONLY.includes(r))] : regions;
  const place = regions.length
    ? placeParts.map(r => r === "부산" && gus.length ? `부산 ${gus.join("·")}` : r).join(" · ")
    : null;

  return (
    <Box>

      {/* 칩 한 줄 (시안 f01). 큰 제목은 화면 읽기용으로만 둔다 */}
      <div className="mx-auto max-w-6xl px-4 pt-1 sm:px-6">
        <h1 className="sr-only">{place ? `${place}에서 열리는 공연·전시·축제` : "가까운 곳에서 열리는 공연·전시·축제"}</h1>
        <FilterBar subs={subCounts} total={beforeSub.length} />
        {(place || filters.search) && (
          <p className="mt-1 text-[13px] text-ink-soft">
            {place && <><b className="text-ink">{place}</b>에서 열리는 행사 </>}
            {filters.search && <>«<b className="text-ink">{filters.search}</b>» 찾은 결과 </>}
            <b className="pica-num text-ink">{dbEvents.length}</b>건
          </p>
        )}

      {/* 선반을 칩 줄과 같은 부모 안에 둔다: 칩 줄(sticky)은 부모 높이 안에서만 붙어 있으므로, 부모가 칩 줄 높이뿐이면
          내리자마자 같이 올라간다(specs/014 FR-006 «칩 줄 고정», 11/27 converge 에서 찾음). 좌우 여백은 예전과 같게 -mx-4 */}
      <div className="-mx-4 pb-6 pt-2">
        {one ? (
          <div className="px-4">
            <a href={moreBase} className="inline-flex items-center gap-1.5 py-2 text-[14px] font-semibold text-ink-soft hover:text-ink">
              <ArrowLeft size={16} aria-hidden /> 전체 묶음으로
            </a>
            <h2 className="pica-display mt-1 flex items-baseline gap-2 text-[25px] text-ink">
              {SECTION_LABELS[one.key].title}<span className="pica-num text-[22px] font-semibold text-accent">{one.items.length}</span>
            </h2>
            <p className="mb-4 text-[12.5px] text-ink-soft">{SECTION_LABELS[one.key].note}</p>
            <EventList initialEvents={one.items.map(toCard)} filters={filters} showEndNote={false} />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-[16px] font-bold text-ink">조건에 맞는 행사가 없어요</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {filters.date && <a href={allDatesHref} className="inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-bold text-on-accent">전체 기간 보기</a>}
              {hasFilter && <a href={base} className="inline-block rounded-full border border-line bg-card px-5 py-2.5 text-[14px] font-bold text-ink">필터 풀기</a>}
            </div>
          </div>
        ) : (
          <FeedSections sections={shown} moreBase={moreBase} folded={extraSections.map(s => s.key)} foldedMoreBase={extraMoreBase} />
        )}
      </div>
      </div>

      {/* «지도» 버튼 (specs/014 US3): 누르면 지금 필터 결과의 장소를 지도 시트로 */}
      {!one && (
        <MapButton
          showTip
          hideFromId="home-news"
          summary={[DATE_LABEL[filters.date || ""] || "", place || "", cats.length ? (sub ? `${cats[0]} · ${sub}` : cats.join("·")) : "", kids.on ? "아이와" : ""].filter(Boolean).join(" · ")}
          events={dbEvents.map((e: any) => ({ ...toShelf(e), venueId: e.venue_id ?? null, today: (e.event_date_start || e.event_date_end || today) <= today }))}
        />
      )}

      {/* 소식 받기 (11/27): 메일을 보내는 기능이 없어 이메일 구독·키워드 알림 칸을 뺐다. 실제로 받아 볼 수 있는 길만 둔다 */}
      <section id="home-news" className="mt-6 bg-[var(--pk-soft)]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <h2 className="pica-display text-[22px] text-ink sm:text-[26px]">새 소식 받아 보기</h2>
          <p className="mt-1 text-[14px] text-ink-soft">찜한 행사 전날과 주말 행사를 휴대폰 알림으로, 또는 쓰시는 곳에서 받아 보세요.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PushButton compact />
            <Link href="/calendar" className="pica-chip"><CalendarPlus size={15} aria-hidden />캘린더로 받기</Link>
            <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer" className="pica-chip"><MessageCircle size={15} aria-hidden />카카오톡 채널 «피카»</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="pica-chip"><InstagramIcon size={15} />인스타그램 @picka.news</a>
          </div>
          {/* 앱으로 설치 안내 (specs/018 덧붙임). 이미 설치한 앱에서는 보이지 않는다 */}
          <InstallHint />
        </div>
      </section>
    </Box>
  );
}
