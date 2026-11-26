import Link from "next/link";
import { getDistrictVenueIds, getPublishedEvents } from "@/lib/supabase";
import { FeedSections } from "@/components/ui/FeedSections";
import { FilterBar } from "@/components/ui/FilterBar";
import { EventList } from "@/components/ui/EventList";
import { regionPath } from "@/lib/regions";
import { SECTION_LABELS, type SectionKey } from "@/lib/feedOrder";
import { Container, Title, Text, TextInput, Button, SimpleGrid, Group, Box, Alert, Stack } from "@mantine/core";
import { ArrowLeft } from "lucide-react";

import { formatPeriod, todayKST } from "@/lib/utils";
import { orderFeed } from "@/lib/feedOrder";
import { ageLabel, fitsAge, kidsInfo, readKidsParam } from "@/lib/kids";
import { isEndingSoon } from "@/lib/eventDetails";

export type HomeParams = {
  region?: string;
  category?: string;
  q?: string;
  date?: string;
  ended?: string;
  kids?: string;
  subscribed?: string;
  section?: string;
};

/** 홈 목록 화면. 지역 페이지(/region/[name])는 region 을 고정해 같은 화면을 쓴다 */
export async function HomeFeed({ params: resolvedParams, region, district }: { params: HomeParams; region?: string; district?: string }) {
  const filters = {
    region: region ?? resolvedParams.region,
    category: resolvedParams.category,
    search: resolvedParams.q,
    date: resolvedParams.date,
    ended: resolvedParams.ended
  };

  // 부산 구·군 페이지: 그 구에 있는 장소의 행사만 (장소를 모르는 행사는 «부산» 페이지에만 나온다)
  const districtVenues = district ? await getDistrictVenueIds(district) : null;
  const fetched = (await getPublishedEvents(filters)).filter((e: any) => !districtVenues || districtVenues.has(e.venue_id));
  const isSubscribed = resolvedParams.subscribed === "true";

  // 아이와 같이 가기 좋은 곳(specs/004): 규칙·운영자 수정으로 행사마다 구분을 매기고, 「아이」 필터가 켜지면 맞는 것만 남긴다
  const kids = readKidsParam(resolvedParams.kids);
  const kidsOf = new Map(fetched.map((e: any) => [e.id, kidsInfo(e)]));
  const today = todayKST();
  // 「곧 끝남」(specs/006): 7일 넘게 하는 행사 중 7일 안에 끝나는 것
  const dbEvents = fetched
    .filter((e: any) => !kids.on || fitsAge(kidsOf.get(e.id)!, kids.age))
    .filter((e: any) => filters.date !== "ending" || isEndingSoon(e, today));

  // DB 행을 EventCard 모양으로
  const toCard = (event: any) => ({
    kidMark: kidsOf.get(event.id)?.group === "target",
    endingSoon: isEndingSoon(event, today),
    ageBadge: kids.on ? ageLabel(kidsOf.get(event.id)?.minMonths ?? null) : undefined,
    kidRank: kids.on ? (kidsOf.get(event.id)?.group === "target" ? 0 : 1) : 0,
    id: event.id,
    title: event.title,
    category: event.category,
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

  // «모두 보기»(?section=…): 그 묶음만 세로 목록. 다른 조건은 그대로 둔다
  const base = region ? regionPath(region, district) : "/";
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(resolvedParams)) {
    if (typeof v === "string" && v && k !== "section" && k !== "subscribed" && !(region && k === "region")) keep.set(k, v);
  }
  const moreBase = `${base}${keep.toString() ? `?${keep.toString()}` : ""}`;
  const sectionKey = resolvedParams.section as SectionKey | undefined;
  const one = sectionKey && SECTION_LABELS[sectionKey] ? ordered.find(s => s.key === sectionKey) : undefined;

  const paperInput = { input: { backgroundColor: 'var(--pk-card)', border: '1px solid var(--pk-line)', color: 'var(--pk-ink)' } };
  const hasFilter = !!((filters.region && !region) || filters.category || filters.search || filters.date || kids.on);
  const place = region ? (district ? `${region} ${district}` : region) : null;

  return (
    <Box>
      {isSubscribed && (
        <Alert variant="light" color="green" title="구독 완료" withCloseButton styles={{ root: { borderRadius: 0 } }}>
          뉴스레터 구독이 완료되었습니다. 매주 가까운 곳의 공연·전시·축제 소식을 메일로 보내 드립니다.
        </Alert>
      )}

      {/* 칩 한 줄 (시안 f01). 큰 제목은 화면 읽기용으로만 둔다 */}
      <div className="mx-auto max-w-6xl px-4 pt-1 sm:px-6">
        <h1 className="sr-only">{place ? `${place}에서 열리는 공연·전시·축제` : "가까운 곳에서 열리는 공연·전시·축제"}</h1>
        <FilterBar />
        {(place || filters.search) && (
          <p className="mt-1 text-[13px] text-ink-soft">
            {place && <><b className="text-ink">{place}</b>에서 열리는 행사 </>}
            {filters.search && <>«<b className="text-ink">{filters.search}</b>» 찾은 결과 </>}
            <b className="pica-num text-ink">{dbEvents.length}</b>건
          </p>
        )}
      </div>

      <div className="mx-auto max-w-6xl pb-6 pt-2 sm:px-2">
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
        ) : sections.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-[16px] font-bold text-ink">조건에 맞는 행사가 없어요</p>
            {hasFilter && <a href={base} className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-bold text-on-accent">필터 풀기</a>}
          </div>
        ) : (
          <FeedSections sections={sections} moreBase={moreBase} />
        )}
      </div>

      {/* 소식 받기: 뉴스레터 + 키워드 알림 */}
      <Box component="section" bg="var(--pk-soft)" c="var(--pk-ink)" mt={24}>
        <Container size="xl" py={{ base: 32, sm: 56 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 40, md: 64 }}>
            <Box>
              <Title order={2} fz={{ base: 22, sm: 26 }} className="pica-display" mb={8}>
                매주 한 번, 가까운 공연·전시 소식
              </Title>
              <Text fz="sm" c="var(--pk-ink-soft)" mb="lg">새로 올라온 공연과 전시를 정리해 메일로 보내 드립니다.</Text>
              <form action="/api/newsletter" method="POST">
                <Group align="flex-start" gap="xs">
                  <TextInput
                    name="email"
                    type="email"
                    placeholder="이메일 주소"
                    aria-label="이메일 주소"
                    required
                    size="md"
                    radius={10}
                    flex={1}
                    styles={paperInput}
                  />
                  <Button type="submit" size="md" radius={10} color="var(--pk-accent)" c="var(--pk-on-accent)" fw={700}>
                    구독하기
                  </Button>
                </Group>
              </form>
              <Text fz="xs" c="var(--pk-ink-soft)" mt={8}>
                입력한 이메일은 소식 발송에만 쓰고, 언제든 그만 받을 수 있어요.{" "}
                <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>개인정보처리방침</Link>
              </Text>
            </Box>

            <Box>
              <Title order={2} fz={{ base: 22, sm: 26 }} className="pica-display" mb={8}>
                원하는 키워드가 올라오면 알림
              </Title>
              <Text fz="sm" c="var(--pk-ink-soft)" mb="lg">예: 창원, 무료, 국악. 키워드에 맞는 행사가 등록되면 바로 메일을 보냅니다.</Text>
              <form action="/api/keywords" method="POST">
                <Stack gap="xs">
                  <TextInput
                    name="email"
                    type="email"
                    placeholder="이메일 주소"
                    aria-label="알림 받을 이메일 주소"
                    required
                    size="md"
                    radius={10}
                    styles={paperInput}
                  />
                  <Group gap="xs" align="flex-start">
                    <TextInput
                      name="keywords"
                      placeholder="키워드 (쉼표로 구분)"
                      aria-label="키워드"
                      required
                      size="md"
                      radius={10}
                      flex={1}
                      styles={paperInput}
                    />
                    <Button type="submit" size="md" radius={10} variant="outline" color="var(--pk-ink)" fw={700}>
                      알림 신청
                    </Button>
                  </Group>
                </Stack>
              </form>
              <Text fz="xs" c="var(--pk-ink-soft)" mt={8}>
                입력한 이메일은 소식 발송에만 쓰고, 언제든 그만 받을 수 있어요.{" "}
                <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>개인정보처리방침</Link>
              </Text>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  );
}
