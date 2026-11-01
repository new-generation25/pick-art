import { getPublishedEvents } from "@/lib/supabase";
import { FeedSections } from "@/components/ui/FeedSections";
import { INSTAGRAM_URL, InstagramIcon } from "@/components/ui/InstagramLink";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchBox } from "@/components/ui/SearchBox";
import { Container, Title, Text, TextInput, Button, SimpleGrid, Group, Box, Alert, Stack } from "@mantine/core";

import { formatPeriod, todayKST } from "@/lib/utils";
import { orderFeed } from "@/lib/feedOrder";

interface HomeProps {
  searchParams: Promise<{
    region?: string;
    category?: string;
    q?: string;
    date?: string;
    ended?: string;
    subscribed?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedParams = await searchParams;
  const filters = {
    region: resolvedParams.region,
    category: resolvedParams.category,
    search: resolvedParams.q,
    date: resolvedParams.date,
    ended: resolvedParams.ended
  };

  const dbEvents = await getPublishedEvents(filters);
  const isSubscribed = resolvedParams.subscribed === "true";

  const today = todayKST();

  // DB 행을 EventCard 모양으로
  const toCard = (event: any) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    date: formatPeriod(event.event_date_start, event.event_date_end),
    location: event.venue || event.region,
    imageUrl: event.poster_image_url,
    isFree: event.is_free,
    isEnded: !!event.event_date_end && event.event_date_end < today,
  });

  // 날짜 묶음(오늘·이번 주·다음 주·그 이후·상시·장기·최근 끝난 행사)과 묶음 안의 순서
  const sections = orderFeed(dbEvents, today).map(s => ({ ...s, cards: s.items.map(toCard) }));
  const allEvents = dbEvents;

  // 머리말에 쓰는 오늘 날짜와 결과 수 (표시용)
  const [, todayMonth, todayDay] = today.split("-").map(Number);
  const hasFilter = !!(filters.region || filters.category || filters.search || filters.date);

  const darkInput = { input: { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.22)', color: 'white' } };

  return (
    <Box>
      {isSubscribed && (
        <Alert variant="filled" color="teal" title="구독 완료" withCloseButton styles={{ root: { borderRadius: 0 } }}>
          뉴스레터 구독이 완료되었습니다. 매주 경남의 문화예술 소식을 메일로 보내 드립니다.
        </Alert>
      )}

      {/* 머리말: 오늘 날짜, 결과 수, 검색, 필터 */}
      <Box component="section" bg="var(--pk-paper)" style={{ borderBottom: '2px solid var(--pk-line)' }}>
        <Container size="xl" pt={{ base: 28, sm: 48 }} pb={{ base: 20, sm: 32 }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <div>
              <p className="text-[14px] font-bold text-accent">{todayMonth}월 {todayDay}일 기준</p>
              <h1 className="pica-display mt-2 text-[34px] leading-[1.15] text-ink sm:text-[52px]">
                경남에서 열리는<br />공연·전시·축제
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
                매주 한 번, 경남 문화예술 소식
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
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" py={32} bg="var(--pk-paper)" style={{ borderTop: '2px solid var(--pk-line)' }}>
        <Container size="xl">
          <Group justify="space-between" gap="xs">
            <Group gap="md">
              <Text fz="sm" fw={700} c="var(--pk-ink)">pica · 경남 문화예술 안내</Text>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-ink underline-offset-4 hover:underline">
                <InstagramIcon size={16} /> 인스타그램 @picka.news
              </a>
            </Group>
            <Text fz="xs" c="var(--pk-ink-soft)">&copy; 2024 pickart (pica). All rights reserved.</Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
