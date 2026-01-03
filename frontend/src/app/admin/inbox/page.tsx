"use client";

import { useState, useEffect } from "react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { AdminHeader } from "@/components/ui/AdminHeader";
import {
    Inbox, CheckCircle, XCircle, ExternalLink,
    Image as ImageIcon, Edit3,
    Copy, Check, Save, MapPin, Tag, Calendar, Clock,
    Settings, List, BookOpen, Search, Trash2, RefreshCcw, Maximize2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { EventList } from "@/components/ui/EventList";
import {
    Box, Container, Title, Text, Button, Group, Stack, Badge,
    Card, SimpleGrid, Modal, TextInput, Select, Textarea,
    ActionIcon, SegmentedControl, Paper, ScrollArea, rem, ThemeIcon
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

interface RawPost {
    id: string;
    source: string;
    source_url: string;
    content: any;
    image_urls: string[];
    collected_at: string;
    status: string;
}

type TabType = "pending" | "published";

export default function AdminInboxPage() {
    const [activeTab, setActiveTab] = useState<TabType>("pending");
    const [posts, setPosts] = useState<RawPost[]>([]);
    const [publishedEvents, setPublishedEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPost, setEditingPost] = useState<RawPost | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        title: "",
        description: "",
        category: "행사",
        region: "경남",
        venue: "",
        event_date_start: "",
        event_date_end: "",
        imageUrl: "",
    });
    const [scheduledAt, setScheduledAt] = useState<string>("");

    // UI States
    const [isImageModalOpen, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    // New modal states
    const [isReportModalOpen, { open: openReportModal, close: closeReportModal }] = useDisclosure(false);
    const [reportLogs, setReportLogs] = useState<any[]>([]);
    const [isSettingsModalOpen, { open: openSettingsModal, close: closeSettingsModal }] = useDisclosure(false);
    const [promptText, setPromptText] = useState('');
    const [promptLoading, setPromptLoading] = useState(false);

    const [rejectedPosts, setRejectedPosts] = useState<RawPost[]>([]);
    const [stats, setStats] = useState({ pending: 0, published: 0, rejected: 0 });

    // 다중 선택 모드 (아이폰 스타일 삭제)
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // 1. Fetch Pending Posts
        const { data: pendingData } = await supabase
            .from("raw_posts")
            .select("*")
            .or("status.eq.COLLECTED,status.eq.PENDING")
            .order("collected_at", { ascending: false });

        // 2. Fetch Published Events
        const { data: publishedData } = await supabase
            .from("events")
            .select("*")
            .eq("status", "PUBLISHED")
            .order("published_at", { ascending: false });

        // 3. Fetch Rejected Posts
        const { data: rejectedData } = await supabase
            .from("raw_posts")
            .select("*")
            .eq("status", "REJECTED")
            .order("collected_at", { ascending: false });

        if (pendingData) {
            setPosts(pendingData);
            setPublishedEvents(publishedData || []);
            setRejectedPosts(rejectedData || []);
            setStats({
                pending: pendingData.length,
                published: publishedData?.length || 0,
                rejected: rejectedData?.length || 0
            });
        }
        setLoading(false);
    };

    const openEditModal = (post: RawPost) => {
        setEditingPost(post);

        // 서부문화센터 출처인 경우 자동으로 장소, 지역, 카테고리 설정
        const isWGCC = post.source === '김해서부문화센터' ||
            (post.source_url && post.source_url.includes('wgcc.ghct.or.kr'));

        // 제목에서 [기획], [특별], [공모] 등의 분류 태그 제거
        const cleanTitle = (title: string) => {
            return title.replace(/^\[.*?\]\s*/g, '').trim();
        };

        const rawTitle = post.content.title || (post.source === 'instagram' ? `@${post.content.username}의 포스트` : '제목 없음');

        setEditForm({
            title: cleanTitle(rawTitle),
            description: post.content.description || post.content.text || "",
            category: isWGCC ? "공연" : (post.content.ai_suggestion?.category || "행사"),
            region: isWGCC ? "김해" : (post.content.ai_suggestion?.region || "경남"),
            venue: isWGCC ? "김해서부문화센터" : (post.content.ai_suggestion?.venue || ""),
            event_date_start: post.content.ai_suggestion?.date_start || "",
            event_date_end: post.content.ai_suggestion?.date_end || "",
            imageUrl: post.image_urls?.[0] || ""
        });
    };

    const handlePublish = async () => {
        if (!editingPost) return;

        const isScheduled = !!scheduledAt;
        const status = isScheduled ? "SCHEDULED" : "PUBLISHED";

        // 1. Insert into events
        // Remove UI-only fields (imageUrl) before inserting
        const { imageUrl, ...eventData } = editForm;

        const { error: insertError } = await supabase.from("events").insert([{
            ...eventData,
            poster_image_url: imageUrl || "", // Use extracted imageUrl for the correct column
            source: editingPost.source,
            original_url: editingPost.source_url,
            status: status,
            scheduled_at: isScheduled ? scheduledAt : null,
            raw_post_id: editingPost.id,
            published_at: isScheduled ? null : new Date().toISOString()
        }]);

        if (insertError) {
            alert("발행 중 오류가 발생했습니다: " + insertError.message);
            return;
        }

        // 2. Update raw_post status
        await supabase.from("raw_posts").update({ status: "PUBLISHED" }).eq("id", editingPost.id);

        setPosts(posts.filter(p => p.id !== editingPost.id));
        setStats(prev => ({
            pending: prev.pending - 1,
            published: prev.published + 1,
            rejected: prev.rejected // Keep rejected count
        }));
        setEditingPost(null);
        setScheduledAt("");
    };

    const handleReject = async (postId: string) => {
        const { error } = await supabase.from("raw_posts").update({ status: "REJECTED" }).eq("id", postId);
        if (!error) {
            const rejectedPost = posts.find(p => p.id === postId);
            setPosts(posts.filter(p => p.id !== postId));
            if (rejectedPost) {
                setRejectedPosts(prev => [rejectedPost, ...prev]);
                setStats(prev => ({ ...prev, pending: prev.pending - 1, rejected: prev.rejected + 1 }));
            }
        }
    };

    const handleRestore = async (postId: string) => {
        const { error } = await supabase.from("raw_posts").update({ status: "PENDING" }).eq("id", postId);
        if (!error) {
            const restoredPost = rejectedPosts.find(p => p.id === postId);
            setRejectedPosts(rejectedPosts.filter(p => p.id !== postId));
            if (restoredPost) {
                setPosts(prev => [restoredPost, ...prev]);
                setStats(prev => ({ ...prev, rejected: prev.rejected - 1, pending: prev.pending + 1 }));
            }
        }
    };

    const handleDelete = async (postId: string) => {
        const confirmDelete = confirm("정말 영구 삭제하시겠습니까? 복구할 수 없습니다.");
        if (!confirmDelete) return;

        const { error } = await supabase.from("raw_posts").delete().eq("id", postId);
        if (!error) {
            setRejectedPosts(rejectedPosts.filter(p => p.id !== postId));
            setStats(prev => ({ ...prev, rejected: prev.rejected - 1 }));
        }
    };

    // 검토 대기 목록에서 직접 삭제
    const handleDeletePending = async (postId: string) => {
        const confirmDelete = confirm("이 항목을 영구 삭제하시겠습니까?\n\n거절 휴지통을 거치지 않고 바로 삭제됩니다.");
        if (!confirmDelete) return;

        const { error } = await supabase.from("raw_posts").delete().eq("id", postId);
        if (!error) {
            setPosts(posts.filter(p => p.id !== postId));
            setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
        }
    };

    const handleEmptyTrash = async () => {
        const confirmEmpty = confirm("휴지통을 비우시겠습니까? 모든 거절된 항목이 영구 삭제됩니다.");
        if (!confirmEmpty) return;

        const { error } = await supabase.from("raw_posts").delete().eq("status", "REJECTED");
        if (!error) {
            setRejectedPosts([]);
            setStats(prev => ({ ...prev, rejected: 0 }));
        }
    };

    // 발행된 이벤트 삭제 (events 테이블에서 삭제)
    const handleDeleteEvent = async (eventId: string) => {
        const confirmDelete = confirm("이 행사를 삭제하시겠습니까?\n\n현재 노출 중인 행사가 삭제됩니다.");
        if (!confirmDelete) return;

        const { error } = await supabase.from("events").delete().eq("id", eventId);
        if (!error) {
            setPublishedEvents(publishedEvents.filter(e => e.id !== eventId));
            setStats(prev => ({ ...prev, published: prev.published - 1 }));
        }
    };

    // 선택된 이벤트 일괄 삭제
    const handleDeleteSelectedEvents = async () => {
        if (selectedEvents.length === 0) return;

        const confirmDelete = confirm(`선택한 ${selectedEvents.length}개의 행사를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
        if (!confirmDelete) return;

        try {
            // 선택된 모든 이벤트 삭제
            for (const eventId of selectedEvents) {
                await supabase.from("events").delete().eq("id", eventId);
            }

            // 상태 초기화 후 데이터 새로고침
            const deletedCount = selectedEvents.length;
            setSelectedEvents([]);
            setIsSelectMode(false);

            // 데이터 새로고침
            await fetchData();

            alert(`${deletedCount}개의 행사가 삭제되었습니다.`);
        } catch (error) {
            console.error("Delete error:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };


    const copyDMMessage = (post: RawPost) => {
        const author = post.content.username || "작가";
        const title = post.content.title || "작품/행사";
        const message = `안녕하세요, 픽아트(pica)입니다.\n@${author}님께서 올리신 '${title}' 정보를 저희 사이트에 소개하고 싶어 연락드렸습니다.\n\n출처 표기 및 원본 링크를 함께 게시하며, 언제든 삭제 요청이 가능합니다.\n내용 확인차 연락드렸는데, 혹시 게시를 허락해 주실 수 있을까요?\n감사합니다!`;

        navigator.clipboard.writeText(message);
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>

                {/* Header Section */}
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
                            <Inbox size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>픽아트 인박스 (Curation)</Title>
                            <Text c="dimmed" fw={500}>수집된 원본 데이터를 픽아트 스타일로 검토하고 발행합니다.</Text>
                        </Box>
                    </Group>

                    <Group>
                        <Button
                            variant="white"
                            color="gray"
                            leftSection={<Clock size={16} />}
                            onClick={fetchData}
                        >
                            새로고침
                        </Button>
                        <Button
                            variant="white"
                            color="gray"
                            leftSection={<Settings size={16} />}
                            onClick={async () => {
                                setPromptLoading(true);
                                const res = await fetch('/api/getPrompt');
                                const data = await res.json();
                                setPromptText(data.prompt || '');
                                setPromptLoading(false);
                                openSettingsModal();
                            }}
                        >
                            설정
                        </Button>
                        <Button
                            variant="white"
                            color="gray"
                            leftSection={<List size={16} />}
                            onClick={async () => {
                                const res = await fetch('/api/crawlLogs');
                                const data = await res.json();
                                setReportLogs(data);
                                openReportModal();
                            }}
                        >
                            리포트
                        </Button>
                    </Group>
                </Group>

                {/* Tabs */}
                <Box mb={30}>
                    <SegmentedControl
                        value={activeTab}
                        onChange={(value) => setActiveTab(value as TabType)}
                        data={[
                            { label: `검토 대기 (${stats.pending})`, value: 'pending' },
                            { label: `현재 노출 (${stats.published})`, value: 'published' },
                        ]}
                        size="md"
                        radius="xl"
                    />
                </Box>

                {/* Content based on active tab */}
                {activeTab === "pending" ? (
                    <Box mb={60}>
                        <Group mb="lg">
                            <Box w={4} h={24} bg="indigo" style={{ borderRadius: 999 }} />
                            <Title order={2} size="h3" fw={900}>검토 대기 카드 ({stats.pending})</Title>
                        </Group>

                        {loading ? (
                            <Text ta="center" c="dimmed" py={60} fw={700}>데이터를 불러오는 중...</Text>
                        ) : posts.length === 0 ? (
                            <Paper p={60} radius="xl" withBorder style={{ borderStyle: 'dashed' }} ta="center">
                                <CheckCircle size={48} className="text-green-300 mx-auto mb-4" />
                                <Text size="xl" fw={700} c="dimmed">모든 소식을 검토했습니다!</Text>
                            </Paper>
                        ) : (
                            <Stack gap="lg">
                                {posts.map((post) => (
                                    <Paper key={post.id} p="md" radius="lg" withBorder shadow="sm" className="hover:shadow-md transition-shadow">
                                        <Group align="flex-start" wrap="nowrap">
                                            {/* Image Preview */}
                                            <Box
                                                w={160}
                                                h={160}
                                                style={{ position: 'relative', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
                                                bg="gray.1"
                                                visibleFrom="sm"
                                            >
                                                {post.image_urls?.[0] ? (
                                                    <ImageWithFallback
                                                        src={post.image_urls[0]}
                                                        alt="Preview"
                                                        fill
                                                        className="object-cover"
                                                        sizes="160px"
                                                    />
                                                ) : (
                                                    <Stack align="center" justify="center" h="100%" c="gray.4">
                                                        <ImageIcon size={32} />
                                                        <Text size="xs" fw={700} tt="uppercase">No Image</Text>
                                                    </Stack>
                                                )}
                                            </Box>

                                            {/* Content */}
                                            <Stack flex={1} gap="xs">
                                                <Group justify="space-between">
                                                    <Group gap="xs">
                                                        <Button
                                                            size="xs"
                                                            variant={copiedId === post.id ? "light" : "default"}
                                                            color={copiedId === post.id ? "green" : "gray"}
                                                            leftSection={copiedId === post.id ? <Check size={12} /> : <Copy size={12} />}
                                                            onClick={() => copyDMMessage(post)}
                                                        >
                                                            {copiedId === post.id ? '완료' : 'DM'}
                                                        </Button>
                                                        <Badge
                                                            color={post.source === 'instagram' ? 'pink' : post.source === 'blog' ? 'indigo' : 'blue'}
                                                            variant="light"
                                                            size="lg"
                                                            leftSection={post.source === 'blog' && <BookOpen size={12} />}
                                                        >
                                                            {post.source}
                                                        </Badge>
                                                    </Group>

                                                </Group>

                                                <Box>
                                                    <Title order={4} size="h4" mb={4} lineClamp={1}>
                                                        {post.content.title || (post.source === 'instagram' ? `@${post.content.username}의 포스트` : '제목 없음')}
                                                    </Title>
                                                    <Text size="sm" c="dimmed" lineClamp={2} style={{ lineHeight: 1.6 }}>
                                                        {post.content.description || post.content.text}
                                                    </Text>
                                                </Box>

                                                <Group pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
                                                    <Button
                                                        component="a"
                                                        href={post.source_url}
                                                        target="_blank"
                                                        variant="subtle"
                                                        size="xs"
                                                        color="indigo"
                                                        rightSection={<ExternalLink size={12} />}
                                                    >
                                                        원본 보기
                                                    </Button>
                                                    <Box style={{ flex: 1 }} />
                                                    <Group gap="xs">
                                                        <ActionIcon
                                                            variant="light"
                                                            color="red"
                                                            size="lg"
                                                            onClick={() => handleDeletePending(post.id)}
                                                            title="영구 삭제"
                                                        >
                                                            <Trash2 size={16} />
                                                        </ActionIcon>
                                                        <Button variant="default" color="gray" onClick={() => handleReject(post.id)} leftSection={<XCircle size={14} />}>
                                                            거절
                                                        </Button>
                                                        <Button color="indigo" onClick={() => openEditModal(post)} leftSection={<Edit3 size={14} />}>
                                                            검토
                                                        </Button>
                                                    </Group>
                                                </Group>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Box>
                ) : (
                    /* Published Events - 원래 카드 디자인 + 다중 선택 */
                    <Box mb={60}>
                        <Group justify="space-between" mb="lg">
                            <Group>
                                <Box w={4} h={24} bg="green" style={{ borderRadius: 999 }} />
                                <Title order={2} size="h3" fw={900}>현재 노출중인 행사 ({stats.published})</Title>
                            </Group>
                            <Button
                                variant={isSelectMode ? "filled" : "light"}
                                color={isSelectMode ? "red" : "gray"}
                                size="sm"
                                onClick={() => {
                                    setIsSelectMode(!isSelectMode);
                                    setSelectedEvents([]);
                                }}
                            >
                                {isSelectMode ? "취소" : "선택"}
                            </Button>
                        </Group>

                        {/* 원래 EventList 컴포넌트 사용 + 선택 모드 props */}
                        <EventList
                            key={stats.published}
                            limit={32}
                            isSelectMode={isSelectMode}
                            selectedIds={selectedEvents}
                            onSelect={(id) => {
                                setSelectedEvents(prev =>
                                    prev.includes(id)
                                        ? prev.filter(x => x !== id)
                                        : [...prev, id]
                                );
                            }}
                        />
                    </Box>
                )}

                {/* Trash Section */}
                <Box py={40} style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                    <Group justify="space-between" mb="lg">
                        <Group>
                            <Box w={4} h={24} bg="red" style={{ borderRadius: 999 }} />
                            <Title order={2} size="h3" fw={900}>휴지통 (거절됨: {stats.rejected})</Title>
                        </Group>
                        {stats.rejected > 0 && (
                            <Button variant="light" color="red" size="xs" onClick={handleEmptyTrash} leftSection={<Trash2 size={14} />}>
                                휴지통 비우기
                            </Button>
                        )}
                    </Group>

                    {stats.rejected === 0 ? (
                        <Text ta="center" c="dimmed" py="lg">휴지통이 비어있습니다.</Text>
                    ) : (
                        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md" style={{ opacity: 0.8 }} >
                            {rejectedPosts.map((post) => (
                                <Paper key={post.id} p="md" radius="md" withBorder className="group" style={{ filter: 'grayscale(100%)', transition: 'filter 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.filter = 'none'} onMouseLeave={(e) => e.currentTarget.style.filter = 'grayscale(100%)'}>
                                    <Group align="flex-start" mb="xs">
                                        <Badge variant="default" size="sm">{post.source}</Badge>
                                        <Box style={{ flex: 1 }} />
                                        <ActionIcon variant="light" color="blue" size="sm" onClick={() => handleRestore(post.id)}>
                                            <RefreshCcw size={12} />
                                        </ActionIcon>
                                        <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(post.id)}>
                                            <Trash2 size={12} />
                                        </ActionIcon>
                                    </Group>
                                    <Group align="start" wrap="nowrap">
                                        <Box w={60} h={60} bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-sm)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                            {post.image_urls?.[0] ? (
                                                <ImageWithFallback src={post.image_urls[0]} alt="" fill className="object-cover" />
                                            ) : (
                                                <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center' }}>
                                                    <ImageIcon size={16} color="gray" />
                                                </Box>
                                            )}
                                        </Box>
                                        <Box>
                                            <Text size="sm" fw={700} lineClamp={1}>{post.content.title || '제목 없음'}</Text>
                                            <Text size="xs" c="dimmed" lineClamp={2}>{post.content.description}</Text>
                                        </Box>
                                    </Group>
                                </Paper>
                            ))}
                        </SimpleGrid>
                    )}
                </Box>
            </Container>

            {/* Edit Modal */}
            <Modal
                opened={!!editingPost}
                onClose={() => setEditingPost(null)}
                size="80%"
                radius="xl"
                padding={0}
                withCloseButton={false}
                styles={{ content: { overflow: 'hidden' } }}
            >
                {editingPost && (
                    <Box display="flex" style={{ height: '85vh' }}>
                        {/* Left: Form */}
                        <ScrollArea style={{ flex: 1, borderRight: '1px solid var(--mantine-color-gray-2)' }}>
                            <Box p={40}>
                                <Group justify="space-between" mb="xl">
                                    <Box>
                                        <Title order={2} fw={900}>행사 정보 편집</Title>
                                        <Text c="dimmed" size="sm">수집된 내용을 정제하여 최종 발행합니다.</Text>
                                    </Box>
                                    <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setEditingPost(null)}>
                                        <XCircle size={24} />
                                    </ActionIcon>
                                </Group>

                                <Stack gap="md">
                                    <TextInput
                                        label="제목"
                                        leftSection={<Tag size={16} />}
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        size="md"
                                        radius="md"
                                        fw={700}
                                    />

                                    <SimpleGrid cols={2}>
                                        <Select
                                            label="지역"
                                            leftSection={<MapPin size={16} />}
                                            data={['창원', '김해', '진주', '통영', '거제', '양산', '밀양', '함안', '기타']}
                                            value={editForm.region}
                                            onChange={(val) => setEditForm({ ...editForm, region: val || '창원' })}
                                            size="md"
                                            radius="md"
                                        />
                                        <Select
                                            label="카테고리"
                                            leftSection={<Tag size={16} />}
                                            data={['공연', '전시', '행사', '축제', '강연', '체험']}
                                            value={editForm.category}
                                            onChange={(val) => setEditForm({ ...editForm, category: val || '공연' })}
                                            size="md"
                                            radius="md"
                                        />
                                    </SimpleGrid>

                                    <TextInput
                                        label="구체적 장소 (Venue)"
                                        leftSection={<MapPin size={16} />}
                                        value={editForm.venue}
                                        onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                                        size="md"
                                        radius="md"
                                    />

                                    <SimpleGrid cols={2}>
                                        <TextInput
                                            type="date"
                                            label="시작일"
                                            value={editForm.event_date_start}
                                            onChange={(e) => setEditForm({ ...editForm, event_date_start: e.target.value })}
                                            size="md"
                                            radius="md"
                                        />
                                        <TextInput
                                            type="date"
                                            label="종료일"
                                            value={editForm.event_date_end}
                                            onChange={(e) => setEditForm({ ...editForm, event_date_end: e.target.value })}
                                            size="md"
                                            radius="md"
                                        />
                                    </SimpleGrid>

                                    <Textarea
                                        label="상세 설명"
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        minRows={15}
                                        size="md"
                                        radius="md"
                                    />
                                </Stack>
                            </Box>
                        </ScrollArea>

                        {/* Right: Sidebar */}
                        <Box w={360} bg="gray.0" p="xl" style={{ display: 'flex', flexDirection: 'column' }}>
                            <Stack gap="xl" flex={1}>
                                <Box>
                                    <Text size="sm" fw={700} mb="xs">대표 이미지</Text>
                                    <Box
                                        h={200}
                                        bg="dark"
                                        style={{ position: 'relative', borderRadius: 'var(--mantine-radius-lg)', overflow: 'hidden' }}
                                        className="group"
                                    >
                                        {editForm.imageUrl ? (
                                            <>
                                                <ImageWithFallback src={editForm.imageUrl} alt="Selected" fill className="object-contain" />
                                                <Box
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                                    onClick={openImageModal}
                                                >
                                                    <Maximize2 color="white" />
                                                </Box>
                                            </>
                                        ) : (
                                            <Stack align="center" justify="center" h="100%" c="gray.6">
                                                <ImageIcon />
                                                <Text size="xs">No Image</Text>
                                            </Stack>
                                        )}
                                    </Box>

                                    {/* Thumbnails */}
                                    {editingPost.image_urls && editingPost.image_urls.length > 0 && (
                                        <Group gap={8} mt="sm" wrap="nowrap" style={{ overflowX: 'auto' }}>
                                            {editingPost.image_urls.map((url, idx) => (
                                                <ActionIcon
                                                    key={idx}
                                                    size={48}
                                                    radius="md"
                                                    variant="outline"
                                                    color={editForm.imageUrl === url ? "indigo" : "gray"}
                                                    style={{ flexShrink: 0, borderWidth: 2 }}
                                                    onClick={() => setEditForm({ ...editForm, imageUrl: url })}
                                                >
                                                    <Box w="100%" h="100%" style={{ position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
                                                        <ImageWithFallback src={url} alt="" fill className="object-cover" />
                                                    </Box>
                                                </ActionIcon>
                                            ))}
                                        </Group>
                                    )}
                                </Box>

                                <Paper p="md" radius="lg" withBorder>
                                    <Group justify="space-between" mb="xs">
                                        <Group gap="xs">
                                            <Clock size={16} />
                                            <Text fw={700} size="sm">예약 발행 설정</Text>
                                        </Group>
                                        <Badge variant="light" color={isScheduleOpen ? "indigo" : "gray"}>{isScheduleOpen ? "ON" : "OFF"}</Badge>
                                    </Group>
                                    <Button variant="default" size="xs" fullWidth onClick={() => setIsScheduleOpen(!isScheduleOpen)} mb={isScheduleOpen ? "sm" : 0}>
                                        {isScheduleOpen ? "예약 끄기" : "예약 설정하기"}
                                    </Button>
                                    {isScheduleOpen && (
                                        <Box>
                                            <TextInput
                                                type="datetime-local"
                                                value={scheduledAt}
                                                onChange={(e) => setScheduledAt(e.target.value)}
                                                size="xs"
                                            />
                                            <Text size="xs" c="indigo" mt={4} fw={700}>지정된 시간에 자동 발행됩니다</Text>
                                        </Box>
                                    )}
                                </Paper>
                            </Stack>

                            <Stack mt="xl">
                                <Button variant="default" size="lg" fullWidth onClick={() => setEditingPost(null)}>
                                    취소
                                </Button>
                                <Button size="lg" fullWidth color="indigo" onClick={handlePublish} leftSection={<Save size={18} />}>
                                    발행하기
                                </Button>
                            </Stack>
                        </Box>
                    </Box>
                )}
            </Modal>

            {/* Image Modal */}
            <Modal opened={isImageModalOpen} onClose={closeImageModal} size="xl" centered withCloseButton={false} styles={{ body: { padding: 0 }, content: { backgroundColor: 'transparent', boxShadow: 'none' } }}>
                <Box h="80vh" style={{ position: 'relative' }}>
                    <ImageWithFallback src={editForm.imageUrl} alt="Full" fill className="object-contain" />
                    <ActionIcon
                        variant="transparent"
                        color="white"
                        size="xl"
                        style={{ position: 'absolute', top: 0, right: 0 }}
                        onClick={closeImageModal}
                    >
                        <XCircle size={32} />
                    </ActionIcon>
                </Box>
            </Modal>

            {/* 하단 플로팅 삭제 바 (선택 모드에서 항목 선택 시 표시) */}
            {isSelectMode && selectedEvents.length > 0 && (
                <Box
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7))',
                        backdropFilter: 'blur(10px)',
                        padding: '16px 24px',
                        zIndex: 1000,
                    }}
                >
                    <Container size="lg">
                        <Group justify="space-between">
                            <Text c="white" fw={600} size="lg">
                                {selectedEvents.length}개 선택됨
                            </Text>
                            <Group>
                                <Button
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => setSelectedEvents(publishedEvents.map(e => e.id))}
                                >
                                    전체 선택
                                </Button>
                                <Button
                                    color="red"
                                    leftSection={<Trash2 size={18} />}
                                    onClick={handleDeleteSelectedEvents}
                                >
                                    삭제
                                </Button>
                            </Group>
                        </Group>
                    </Container>
                </Box>
            )}
        </Box>
    );
}
