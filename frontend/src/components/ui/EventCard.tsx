import { MapPin, Calendar, Heart } from "lucide-react";
import Link from "next/link";
import { ImageWithFallback } from "./ImageWithFallback";
import { Card, Text, Badge, Group, ActionIcon, rem, Box, Overlay } from "@mantine/core";

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
        <Card
            shadow="sm"
            padding="md"
            radius="md"
            withBorder
            component={Link}
            href={`/events/${event.id}`}
            className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card.Section style={{ position: 'relative' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                    <ImageWithFallback
                        src={event.imageUrl || `https://picsum.photos/seed/${event.id}/400/600`}
                        alt={event.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={priority}
                    />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                        <Badge color="white" c="dark" variant="filled" size="sm">
                            {event.category}
                        </Badge>
                        {event.isFree && (
                            <Badge color="green" variant="filled" size="sm">
                                무료
                            </Badge>
                        )}
                    </div>
                </div>
            </Card.Section>

            <Group justify="space-between" mt="md" mb="xs">
                <Text fw={700} lineClamp={2} style={{ minHeight: rem(48) }}>{event.title}</Text>
            </Group>

            <Group gap={4} mt="xs">
                <Calendar style={{ width: rem(14), height: rem(14), color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" c="dimmed">
                    {event.date}
                </Text>
            </Group>

            <Group gap={4} mt={4}>
                <MapPin style={{ width: rem(14), height: rem(14), color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" c="dimmed" lineClamp={1}>
                    {event.location}
                </Text>
            </Group>
        </Card>
    );
}
