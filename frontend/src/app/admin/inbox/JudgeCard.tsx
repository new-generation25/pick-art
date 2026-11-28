"use client";

// 공개 판단의 모든 탭이 쓰는 카드 하나 (운영자 2026-11-28 «모든 판별 카드의 규격과 디자인을 통일해 왜 제각각이야(탭마다 노출되는 버튼만 다르게)»).
// 모양·크기·순서는 여기서만 정한다: 포스터(96×120) | 출처·계정 → 제목 → 날짜·장소 → 분류 이유 → 상태 → 본문 두 줄 → 코멘트 수 → 아래 줄.
// 아래 줄 왼쪽은 늘 «원문 열기»·«자세히 · 코멘트», 오른쪽은 탭마다 다른 단추(actions). 날짜 넣기 같은 입력은 extra 자리에.

import type { ReactNode } from "react";
import { Badge, Box, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Calendar, ExternalLink, MapPin, MessageSquare } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { notesOf, opensDetail } from "./notes";
import { IgHandle, withIgLinks } from "./igLinks";

export interface JudgePost {
    id: string;
    source: string;
    source_url: string;
    content: Record<string, unknown> & { title?: string; ai_suggestion?: Record<string, unknown> } | null;
    image_urls?: string[] | null;
}

type Props = {
    post: JudgePost;
    /** 카드(빈 곳)·제목·«자세히 · 코멘트»를 누르면 자세히 보기 창을 연다 */
    onOpen?: () => void;
    /** 포스터 앞(공개 후보의 고르기 칸) */
    leading?: ReactNode;
    /** 분류 이유 한 줄 */
    reason?: { text: string; tone?: "red" | "dimmed" };
    /** 상태 표시(승인됨·검증 실패·공개됨 …) */
    status?: ReactNode;
    /** 입력 자리(날짜 넣기 등) */
    extra?: ReactNode;
    /** 아래 줄 오른쪽 단추들 — 탭마다 다르다 */
    actions?: ReactNode;
    /** 아래 줄 밑의 안내·결과 한 줄 */
    note?: ReactNode;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function JudgeCard({ post, onOpen, leading, reason, status, extra, actions, note }: Props) {
    const c = post.content || {};
    const a = (c.ai_suggestion || {}) as Record<string, unknown>;
    const title = str(c.title) || "제목 없음";
    const body = String(c.description || c.text || c.caption || "").trim();
    const thumb = post.image_urls?.[0] || str(a.poster_url);
    const account = str(a.account);
    const author = str(a.author);
    const noteCount = notesOf(c).length;
    const place = [str(a.region), str(a.venue)].filter(Boolean).join(" · ");
    return (
        <Paper p="md" radius="lg" withBorder shadow="sm" style={onOpen ? { cursor: "pointer" } : undefined}
            onClick={onOpen ? (e) => { if (opensDetail(e)) onOpen(); } : undefined}>
            <Group align="flex-start" wrap="nowrap">
                {leading}
                <Box w={96} h={120} bg="gray.1" style={{ position: "relative", borderRadius: "var(--mantine-radius-md)", overflow: "hidden", flexShrink: 0 }}>
                    <ImageWithFallback src={thumb} alt="" fill className="object-cover" sizes="96px" referrerPolicy="no-referrer" fallbackText="포스터 없음" />
                </Box>
                <Stack flex={1} gap={6} style={{ minWidth: 0 }}>
                    <Group gap="xs" wrap="wrap">
                        <Badge color="pink" variant="light" radius="md">{post.source}</Badge>
                        {account && <Text size="sm" fw={700} style={{ wordBreak: "break-all" }}><IgHandle handle={account} /></Text>}
                        {author && author !== account && <Text size="sm" c="dimmed">{author}</Text>}
                        {str(a.role) && <Badge variant="default" size="sm">{str(a.role)}</Badge>}
                        {c.review_reason === "standing_consent" && (
                            <Badge color="teal" variant="light" size="sm" style={{ textTransform: "none" }}>{str(c.review_note) || "상시 동의"}</Badge>
                        )}
                    </Group>
                    <Title order={4} size="h5" lineClamp={2}>
                        {onOpen
                            ? <button type="button" onClick={onOpen} style={{ all: "unset", cursor: "pointer" }} aria-label={`${title} 자세히 보기`}>{title}</button>
                            : title}
                    </Title>
                    <Group gap="md" wrap="wrap">
                        <Group gap={4}>
                            <Calendar size={14} />
                            <Text size="sm">{str(a.date_start) || "시작일 없음"} ~ {str(a.date_end) || "끝나는 날 없음"}</Text>
                        </Group>
                        <Group gap={4}>
                            <MapPin size={14} />
                            <Text size="sm">{place || "장소 없음"}</Text>
                        </Group>
                    </Group>
                    {reason?.text && <Text size="xs" c={reason.tone === "red" ? "red" : "dimmed"}>분류 이유: {reason.text}</Text>}
                    {status}
                    {extra}
                    {body && <Text size="xs" c="dimmed" lineClamp={2} style={{ wordBreak: "break-word" }}>{withIgLinks(body)}</Text>}
                    {noteCount > 0 && (
                        <Group gap={4}>
                            <MessageSquare size={13} color="var(--mantine-color-dimmed)" />
                            <Text size="xs" c="dimmed">운영자 코멘트 {noteCount}개</Text>
                        </Group>
                    )}
                    <Group pt="xs" gap="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-1)" }}>
                        <Button component="a" href={post.source_url} target="_blank" rel="noopener noreferrer" variant="subtle" size="xs" color="indigo" rightSection={<ExternalLink size={12} />}>
                            원문 열기
                        </Button>
                        {onOpen && <Button variant="subtle" size="xs" color="gray" onClick={onOpen}>자세히 · 코멘트</Button>}
                        <Box style={{ flex: 1 }} />
                        {actions}
                    </Group>
                    {note}
                </Stack>
            </Group>
        </Paper>
    );
}

/** 카드 안에서 시작일·끝나는 날을 넣는 칸 — 사람 판단·동의 필요·자동 공개 대기가 같이 쓴다 */
export function DateFields({ label, start, end, onStart, onEnd }: { label?: string; start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
    return (
        <Group gap="xs" wrap="wrap" align="center">
            {label && <Text size="xs" c="orange.7">{label}</Text>}
            <input type="date" className="pica-date" aria-label="시작일" value={start} onChange={(e) => onStart(e.target.value)} />
            <Text size="xs" c="dimmed">~</Text>
            <input type="date" className="pica-date" aria-label="끝나는 날" value={end} min={start || undefined} onChange={(e) => onEnd(e.target.value)} />
        </Group>
    );
}
