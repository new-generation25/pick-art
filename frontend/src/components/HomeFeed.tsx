import Link from "next/link";
import { getDistrictVenueIds, getPublishedEvents } from "@/lib/supabase";
import { FeedSections } from "@/components/ui/FeedSections";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchBox } from "@/components/ui/SearchBox";
import { Container, Title, Text, TextInput, Button, SimpleGrid, Group, Box, Alert, Stack } from "@mantine/core";

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

  // 날짜 묶음(오늘·이번 주·다음 주·그 이후·상시·장기·최근 끝난 행사)과 묶음 안의 순서
  // 「아이」 필터가 켜지면 묶음 안에서 «아이 대상»을 먼저 (안정 정렬이라 그 안의 날짜 순서는 그대로)
  const sections = orderFeed(dbEvents, today).map(s => ({
    ...s,
    cards: s.items.map(toCard).sort((a, b) => a.kidRank - b.kidRank),
  }));
  const allEvents = dbEvents;

  // 머리말에 쓰는 오늘 날짜와 결과 수 (표시용)
  const [, todayMonth, todayDay] = today.split("-").map(Number);
  const hasFilter = !!((filters.region && !region) || filters.category || filters.search || filters.date || kids.on);

  const darkInput = { input: { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.22)', color: 'white' } };

  return (
    <Box>
      {isSubscribed && (
        <Alert variant="filled" color="teal" title="구독 완료" withCloseButton styles={{ root: { borderRadius: 0 } }}>
          뉴스레터 구독이 완료되었습니다. 매주 가까운 곳의 공연·전시·축제 소식을 메일로 보내 드립니다.
        </Alert>
      )}

      {/* 머리말: 오늘 날짜, 결과 수, 검색, 필터 */}
      <Box component="section" bg="var(--pk-paper)" style={{ borderBottom: '2px solid var(--pk-line)' }}>
        <Container size="xl" pt={{ base: 28, sm: 48 }} pb={{ base: 20, sm: 32 }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <div>
              <p className="text-[14px] font-bold text-accent">{todayMonth}월 {todayDay}일 기준</p>
              <h1 className="pica-display mt-2 text-[34px] leading-[1.15] text-ink sm:text-[52px]">
                {region ? <>{district ? `${region} ${district}` : region}에서 열리는</> : "가까운 곳에서 열리는"}<br />공연·전시·축제
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {hasFilter ? "조건에 맞는 행사" : "지금 볼 수 있는 행사"}{" "}
                <strong className="font-bold text-ink">{allEvents.length}건</strong>을 날짜별로 묶었습니다.
              </p>
              <SearchBox key={resolvedParams.q || ""} initialQuery={resolvedParams.q || ""} />
            </div>
            <div className="lg:pt-8">
              <FilterBar />
            </div>
          </div>
        </Container>
      </Box>

      {/* 행사 목록 */}
      <Container size="xl" py={{ base: 20, sm: 40 }}>
        <FeedSections sections={sections} filters={filters} />
      </Container>

      {/* 소식 받기: 뉴스레터 + 키워드 알림 */}
      <Box component="section" bg="var(--pk-band)" c="var(--pk-on-band)" mt={40}>
        <Container size="xl" py={{ base: 40, sm: 64 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 40, md: 64 }}>
            <Box>
              <Title order={2} fz={{ base: 22, sm: 26 }} className="pica-display" mb={8}>
                매주 한 번, 가까운 공연·전시 소식
              </Title>
              <Text fz="sm" c="rgba(255,255,255,0.75)" mb="lg">새로 올라온 공연과 전시를 정리해 메일로 보내 드립니다.</Text>
              <form action="/api/newsletter" method="POST">
                <Group align="flex-start" gap="xs">
                  <TextInput
                    name="email"
                    type="email"
                    placeholder="이메일 주소"
                    aria-label="이메일 주소"
                    required
                    size="md"
                    radius={0}
                    flex={1}
                    styles={darkInput}
                  />
                  <Button type="submit" size="md" radius={0} color="var(--pk-mark)" c="var(--pk-on-mark)" fw={700}>
                    구독하기
                  </Button>
                </Group>
              </form>
              <Text fz="xs" c="rgba(255,255,255,0.65)" mt={8}>
                입력한 이메일은 소식 발송에만 쓰고, 언제든 그만 받을 수 있어요.{" "}
                <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>개인정보처리방침</Link>
              </Text>
            </Box>

            <Box>
              <Title order={2} fz={{ base: 22, sm: 26 }} className="pica-display" mb={8}>
                원하는 키워드가 올라오면 알림
              </Title>
              <Text fz="sm" c="rgba(255,255,255,0.75)" mb="lg">예: 창원, 무료, 국악. 키워드에 맞는 행사가 등록되면 바로 메일을 보냅니다.</Text>
              <form action="/api/keywords" method="POST">
                <Stack gap="xs">
                  <TextInput
                    name="email"
                    type="email"
                    placeholder="이메일 주소"
                    aria-label="알림 받을 이메일 주소"
                    required
                    size="md"
                    radius={0}
                    styles={darkInput}
                  />
                  <Group gap="xs" align="flex-start">
                    <TextInput
                      name="keywords"
                      placeholder="키워드 (쉼표로 구분)"
                      aria-label="키워드"
                      required
                      size="md"
                      radius={0}
                      flex={1}
                      styles={darkInput}
                    />
                    <Button type="submit" size="md" radius={0} variant="white" color="dark" fw={700}>
                      알림 신청
                    </Button>
                  </Group>
                </Stack>
              </form>
              <Text fz="xs" c="rgba(255,255,255,0.65)" mt={8}>
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
