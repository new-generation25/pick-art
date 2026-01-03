import { MapPin, Calendar, Heart } from "lucide-react";
import Link from "next/link";
import { ImageWithFallback } from "./ImageWithFallback";
import { Card, Text, Badge, Group, ActionIcon, rem, Box, Overlay, Stack } from "@mantine/core";

interface EventProps {
    id: string;
    title: string;
    category: string;
    date: string;
    location: string;
    imageUrl: string;
    isFree?: boolean;
}

export function EventCard({ event, priority = false }: { event: EventProps; priority?: boolean }) {
    return (
        <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <Card
                shadow="sm"
                padding="md"
                radius="lg"
                withBorder
                className="transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                style={{ height: '100%' }}
            >
                {/* 카드 상단 이미지 영역 (기존 Card.Section 역할 대체) */}
                <div style={{ margin: rem(-16), marginBottom: rem(16), position: 'relative', overflow: 'hidden', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                        <ImageWithFallback
                            src={event.imageUrl || `https://picsum.photos/seed/${event.id}/400/600`}
                            alt={event.title}
                            fill
                            className="object-cover transition-transform duration-500 hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            priority={priority}
                        />
                        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
                            <Badge color="indigo" variant="filled" size="sm" radius="sm">
                                {event.category}
                            </Badge>
                            {event.isFree && (
                                <Badge color="teal" variant="filled" size="sm" radius="sm">
                                    무료
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <Stack gap="xs" style={{ flex: 1 }}>
                    <Text fw={800} size="lg" lineClamp={2} style={{ minHeight: rem(56), lineHeight: 1.4 }}>
                        {event.title}
                    </Text>

                    <Box mt="auto">
                        <Group gap={6} mb={4}>
                            <Calendar size={14} className="text-neutral-400" />
                            <Text size="xs" c="dimmed" fw={600}>
                                {event.date}
                            </Text>
                        </Group>

                        <Group gap={6}>
                            <MapPin size={14} className="text-neutral-400" />
                            <Text size="xs" c="dimmed" fw={600} lineClamp={1}>
                                {event.location}
                            </Text>
                        </Group>
                    </Box>
                </Stack>
            </Card>
        </Link>
    );
}
