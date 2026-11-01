"use client";

import { useState, useEffect, useRef } from "react";
import { EventCard } from "./EventCard";
import { supabase } from "@/lib/supabase";
import { formatPeriod } from "@/lib/utils";
import { AlertCircle, Check } from "lucide-react";
import { SimpleGrid, Loader, Stack, Text, Paper, ThemeIcon, rem, Box } from "@mantine/core";

interface Event {
    id: string;
    title: string;
    category: string;
    date: string;
    location: string;
    imageUrl: string;
    isFree: boolean;
    isEnded?: boolean;
}

interface EventListProps {
    initialEvents?: Event[];
    filters?: any;
    limit?: number; // Optional limit for simple display
    // 다중 선택 모드 props
    isSelectMode?: boolean;
    selectedIds?: string[];
    onSelect?: (id: string) => void;
}

export function EventList({ initialEvents, filters = {}, limit, isSelectMode = false, selectedIds = [], onSelect }: EventListProps) {
    // initialEvents 를 받으면(빈 배열 포함) 서버가 필터를 적용한 전체 목록이다 → 다시 불러오거나 이어 붙이지 않는다.
    // 예전에는 빈 배열이면 필터를 무시한 전체 목록을 다시 불러왔고, 목록이 있어도 무한 스크롤이 같은 행사를 또 붙였다.
    const serverProvided = initialEvents !== undefined;
    const [events, setEvents] = useState<Event[]>(initialEvents ?? []);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(!limit && !serverProvided); // If limit exists, no infinite scroll
    const [loading, setLoading] = useState(!serverProvided);
    const observerTarget = useRef<HTMLDivElement>(null);

    // Initial fetch if no props provided or filtering
    useEffect(() => {
        if (serverProvided) {
            setEvents(initialEvents ?? []);
            setHasMore(false);
            setLoading(false);
            return;
        }

        const fetchInitial = async () => {
            setLoading(true);
            let query = supabase
                .from("events")
                .select("*")
                .eq("status", "PUBLISHED")
                .order("published_at", { ascending: false });

            if (limit) {
                query = query.range(0, limit - 1);
            } else {
                query = query.range(0, 11);
            }

            const { data, error } = await query;

            if (error) {
                console.error("EventFetchError:", error);
                // 화면에 에러 표시를 위해 임시로 alert 사용
                alert(`데이터 로딩 실패: ${error.message}`);
                setLoading(false);
                return;
            }

            if (data) {
                console.log(`Fetched ${data.length} events (limit: ${limit})`);
                const formatted = data.map(event => ({
                    id: event.id,
                    title: event.title,
                    category: event.category,
                    date: formatPeriod(event.event_date_start, event.event_date_end),
                    location: event.venue || event.region,
                    imageUrl: event.poster_image_url,
                    isFree: event.is_free,
                }));
                setEvents(formatted);
            } else {
                console.log("No data returned");
            }
            setLoading(false);
        };

        fetchInitial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [limit, JSON.stringify(initialEvents), JSON.stringify(filters)]);

    // Infinite Scroll Logic (Fetching Next Page)
    const fetchMoreEvents = async () => {
        if (loading || !hasMore || limit) return;
        setLoading(true);

        const pageSize = 12;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from("events")
            .select("*")
            .eq("status", "PUBLISHED")
            .order("published_at", { ascending: false })
            .range(from, to);

        if (filters.region) query = query.eq("region", filters.region);
        if (filters.category) query = query.eq("category", filters.category);
        if (filters.search) query = query.ilike("title", `%${filters.search}%`);

        const { data, error } = await query;

        if (error || !data || data.length < pageSize) {
            setHasMore(false);
        }

        if (data) {
            const formatted = data.map(event => ({
                id: event.id,
                title: event.title,
                category: event.category,
                date: formatPeriod(event.event_date_start, event.event_date_end),
                location: event.venue || event.region,
                imageUrl: event.poster_image_url,
                isFree: event.is_free,
            }));
            setEvents(prev => [...prev, ...formatted]);
            setPage(prev => prev + 1);
        }
        setLoading(false);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    fetchMoreEvents();
                }
            },
            { threshold: 0.5 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, page, loading, filters]);

    return (
        <Stack gap="xl">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={{ base: 10, sm: 'lg' }} verticalSpacing={{ base: 10, sm: 'xl' }}>
                {events.map((event, idx) => (
                    <Box
                        key={event.id + idx}
                        style={{
                            position: 'relative',
                            cursor: isSelectMode ? 'pointer' : 'default',
                            opacity: isSelectMode && !selectedIds.includes(event.id) ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: isSelectMode ? 'manipulation' : 'auto'
                        }}
                        onClick={(e) => {
                            if (isSelectMode && onSelect) {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelect(event.id);
                            }
                        }}
                    >
                        {/* 선택 모드일 때 체크 표시 */}
                        {isSelectMode && (
                            <Box
                                style={{
                                    position: 'absolute',
                                    top: 12,
                                    right: 12,
                                    zIndex: 20,
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: selectedIds.includes(event.id) ? 'var(--mantine-color-red-5)' : 'rgba(0,0,0,0.4)',
                                    border: '2px solid white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                }}
                            >
                                {selectedIds.includes(event.id) && <Check size={16} color="white" strokeWidth={3} />}
                            </Box>
                        )}
                        {/* 선택 시 빨간 테두리 */}
                        {isSelectMode && selectedIds.includes(event.id) && (
                            <Box
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    border: '3px solid var(--mantine-color-red-5)',
                                    borderRadius: 'var(--mantine-radius-lg)',
                                    zIndex: 15,
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                        <EventCard event={event} priority={idx < 4} disableNavigation={isSelectMode} />
                    </Box>
                ))}
            </SimpleGrid>

            {/* Empty State */}
            {events.length === 0 && !loading && (
                <Paper py={48} px="md" radius={0} withBorder style={{ borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'var(--pk-line)', backgroundColor: 'var(--pk-card)' }}>
                    <Stack align="center" gap="xs">
                        <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                            <AlertCircle style={{ width: rem(24), height: rem(24) }} />
                        </ThemeIcon>
                        <Text c="var(--pk-ink)" size="lg" fw={700} ta="center">조건에 맞는 행사가 없습니다</Text>
                        <Text c="var(--pk-ink-soft)" size="sm" ta="center">지역이나 기간을 &lsquo;전체&rsquo;로 바꾸거나, 종료된 행사도 보기를 켜 보세요.</Text>
                    </Stack>
                </Paper>
            )}

            {/* Infinite Scroll Trigger / Loading Indicator */}
            {!limit && (
                <div ref={observerTarget} style={{ padding: '2rem 0', display: 'flex', justifyContent: 'center' }}>
                    {loading && (
                        <Stack align="center" gap="xs">
                            <Loader color="var(--pk-accent)" type="dots" />
                            <Text size="sm" fw={600} c="var(--pk-ink-soft)">행사를 불러오는 중</Text>
                        </Stack>
                    )}
                    {!hasMore && events.length > 0 && !limit && (
                        <Text c="var(--pk-ink-soft)" fw={500} size="sm">
                            {events.length}개 행사를 모두 보여 드렸습니다
                        </Text>
                    )}
                </div>
            )}
        </Stack>
    );
}
