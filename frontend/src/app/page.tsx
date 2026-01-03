import { getPublishedEvents } from "@/lib/supabase";
import { EventList } from "@/components/ui/EventList";
import { FilterBar } from "@/components/ui/FilterBar";
import { Search, Mail, Bell } from "lucide-react";
import { Container, Title, Text, TextInput, Button, SimpleGrid, Paper, ThemeIcon, Group, Box, rem, Alert, Stack } from "@mantine/core";

// Mock Data for Fallback/Demo
const MOCK_EVENTS = [
  {
    id: "1",
    title: "2024 창원 조각 비엔날레: 미래의 도시",
    category: "전시",
    date: "2024.09.27 - 2024.11.10",
    location: "창원 성산아트홀 및 용지공원",
    imageUrl: "https://images.unsplash.com/photo-1545989253-02cc26577452?q=80&w=800&auto=format&fit=crop",
    isFree: false,
  },
  // ... other mock events
];

interface HomeProps {
  searchParams: Promise<{
    region?: string;
    category?: string;
    q?: string;
    subscribed?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedParams = await searchParams;
  const filters = {
    region: resolvedParams.region,
    category: resolvedParams.category,
    search: resolvedParams.q
  };

  const dbEvents = await getPublishedEvents(filters);
  const isSubscribed = resolvedParams.subscribed === "true";

  // Transform DB data to match EventCard props
  const formattedDbEvents = dbEvents.map(event => ({
    id: event.id,
    title: event.title,
    category: event.category,
    date: `${event.event_date_start}${event.event_date_end ? ` ~ ${event.event_date_end}` : ''} `,
    location: event.venue || event.region,
    imageUrl: event.poster_image_url,
    isFree: event.is_free,
  }));

  const allEvents = formattedDbEvents.length > 0 ? formattedDbEvents : (filters.region || filters.category || filters.search ? [] : MOCK_EVENTS);

  return (
    <Box>
      {isSubscribed && (
        <Alert variant="filled" color="green" title="구독 완료" withCloseButton styles={{ root: { borderRadius: 0 } }}>
          🎉 뉴스레터 구독이 완료되었습니다! 경남의 따끈따끈한 예술 소식을 보내드릴게요.
        </Alert>
      )}

      {/* Hero Section */}
      <Box pos="relative" py={80} style={{ overflow: 'hidden', background: 'linear-gradient(180deg, var(--mantine-color-indigo-0) 0%, white 100%)' }}>
        {/* Background effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '1000px',
          height: '500px',
          background: 'var(--mantine-color-indigo-1)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          opacity: 0.5,
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <Container size="lg" pos="relative" style={{ zIndex: 1, textAlign: 'center' }}>
          <Title order={1} size={rem(48)} fw={900} mb="md" style={{ lineHeight: 1.2 }}>
            이번 주말, <br style={{ display: 'none' }} />
            <Text span inherit variant="gradient" gradient={{ from: 'indigo', to: 'violet', deg: 45 }}>
              경남의 예술
            </Text>
            을 만나보세요
          </Title>
          <Text size="xl" c="dimmed" mb={50} maw={600} mx="auto">
            전시, 공연, 축제부터 숨겨진 문화 행사까지.<br />
            당신이 놓쳤던 감동적인 순간을 픽아트(pica)가 찾아드립니다.
          </Text>

          <Box maw={600} mx="auto">
            <form action="/" method="GET">
              <TextInput
                name="q"
                defaultValue={resolvedParams.q || ""}
                placeholder="어떤 행사를 찾으시나요? (공연 제목, 장소 등)"
                size="xl"
                radius="xl"
                leftSection={<Search size={20} />}
                rightSectionWidth={0} // 검색 버튼 따로 둘 수도 있음
                styles={{ input: { boxShadow: 'var(--mantine-shadow-sm)' } }}
              />
            </form>
            <Box mt="xl">
              <FilterBar />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Content Grid */}
      <Container size="xl" py={60}>
        <EventList initialEvents={allEvents} filters={filters} />
      </Container>

      {/* Newsletter & Keywords Section */}
      <Container size="xl" mb={120}>
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={40}>
          {/* Newsletter Card */}
          <Paper radius="xl" p={50} bg="indigo.6" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Deco */}
            <Box style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', transform: 'translate(50%, -50%)', filter: 'blur(40px)' }} />

            <Box pos="relative" style={{ zIndex: 1 }}>
              <Text size="xs" fw={900} c="white" tt="uppercase" mb="lg" bg="white.3" style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, letterSpacing: '0.1em' }}>
                Weekly Newsletter
              </Text>
              <Title order={2} c="white" mb="lg">
                경남의 예술 소식을 <br />매주 메일로 받아보세요
              </Title>

              <form action="/api/newsletter" method="POST">
                <Group align="flex-start">
                  <TextInput
                    name="email"
                    placeholder="이메일 주소"
                    required
                    size="md"
                    radius="md"
                    flex={1}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', '&::placeholder': { color: 'rgba(255,255,255,0.7)' } } }}
                  />
                  <Button type="submit" size="md" radius="md" variant="white" color="indigo" fw={900}>
                    구독하기
                  </Button>
                </Group>
              </form>
            </Box>
          </Paper>

          {/* Keyword Alert Card */}
          <Paper radius="xl" p={50} bg="dark.8" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Deco */}
            <Box style={{ position: 'absolute', bottom: 0, left: 0, width: 200, height: 200, background: 'rgba(99, 102, 241, 0.2)', borderRadius: '50%', transform: 'translate(-50%, 50%)', filter: 'blur(40px)' }} />

            <Box pos="relative" style={{ zIndex: 1 }}>
              <Group mb="lg">
                <Text size="xs" fw={900} c="indigo.1" bg="indigo" tt="uppercase" style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, letterSpacing: '0.1em' }}>
                  Keyword Alert
                </Text>
                <Group gap={4}>
                  <Text size="xs" c="gray.5">#창원</Text>
                  <Text size="xs" c="gray.5">#공연</Text>
                  <Text size="xs" c="gray.5">#무료</Text>
                </Group>
              </Group>

              <Title order={2} c="white" mb="lg">
                원하는 키워드의 소식만 <br /> <Text span c="indigo.4">실시간 알림</Text> 받기
              </Title>

              <form action="/api/keywords" method="POST">
                <Stack gap="md">
                  <TextInput
                    name="email"
                    placeholder="이메일 주소"
                    required
                    size="md"
                    radius="md"
                    w="100%"
                    styles={{ input: { backgroundColor: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)', color: 'white' } }}
                  />
                  <Group w="100%">
                    <TextInput
                      name="keywords"
                      placeholder="키워드 (예: 창원, 무료)"
                      required
                      size="md"
                      radius="md"
                      flex={1}
                      styles={{ input: { backgroundColor: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)', color: 'white' } }}
                    />
                    <Button type="submit" size="md" radius="md" color="indigo">
                      알림 신청
                    </Button>
                  </Group>
                </Stack>
                <Text size="xs" c="dimmed" mt="xs">* 키워드에 맞는 행사가 등록되면 즉시 메일이 발송됩니다.</Text>
              </form>
            </Box>
          </Paper>
        </SimpleGrid>
      </Container>


      {/* Footer */}
      <Box component="footer" py={60} bg="white" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="lg" ta="center">
          <Text c="dimmed" size="sm" mb={8}>&copy; 2024 pickart (pica). All rights reserved.</Text>
          <Text c="dimmed" size="sm" fw={700} variant="gradient" gradient={{ from: 'indigo', to: 'violet', deg: 45 }}>Pick Art for Your Creative Life</Text>
        </Container>
      </Box>
    </Box>
  );
}
