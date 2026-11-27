"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import {
    Inbox, CheckCircle, XCircle, ExternalLink,
    Image as ImageIcon, Edit3,
    Copy, Check, Save, MapPin, Tag, Calendar,
    BookOpen, Search, Trash2, RefreshCcw, Maximize2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import { EventList } from "@/components/ui/EventList";
import {
    Box, Container, Title, Text, Button, Group, Stack, Badge,
    Card, SimpleGrid, Modal, TextInput, Select, Textarea,
    ActionIcon, SegmentedControl, Paper, ScrollArea, rem, ThemeIcon
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ReviewQueue, BUCKET_LABEL, type ReviewBucket, type ReviewChange } from "./ReviewQueue";

interface RawPost {
    id: string;
    source: string;
    source_url: string;
    content: any;
    image_urls: string[];
    collected_at: string;
    status: string;
}

// pending = 인박스(COLLECTED·PENDING). candidate·consent·human = 인스타 후보(REVIEW)의 무더기(specs/003 R2)
type TabType = "pending" | ReviewBucket | "published";
const REVIEW_BUCKETS: ReviewBucket[] = ["candidate", "consent", "human"];

const TABS: TabType[] = ["pending", "candidate", "consent", "human", "published"];

// 주소의 ?tab= 을 읽으려면(«오늘 할 일»에서 넘어올 때) Suspense 안에 있어야 한다
export default function AdminInboxPage() {
    return <Suspense fallback={null}><AdminInbox /></Suspense>;
}

function AdminInbox() {
    const wanted = useSearchParams().get("tab") as TabType | null;
    const [activeTab, setActiveTab] = useState<TabType>(wanted && TABS.includes(wanted) ? wanted : "pending");
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

    // UI States
    const [isImageModalOpen, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);

    const [rejectedPosts, setRejectedPosts] = useState<RawPost[]>([]);
    const [reviewPosts, setReviewPosts] = useState<RawPost[]>([]);
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

        // 4. 인스타 후보(REVIEW). 1,000건씩 끝까지 읽는다
        const reviewData: RawPost[] = [];
        for (let from = 0; ; from += 1000) {
            const { data: page, error: reviewError } = await supabase
                .from("raw_posts")
                .select("*")
                .eq("status", "REVIEW")
                .order("collected_at", { ascending: false })
                .range(from, from + 999);
            if (reviewError || !page) break;
            reviewData.push(...page);
            if (page.length < 1000) break;
        }
        setReviewPosts(reviewData);

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
            category: isWGCC ? "공연" : normalizeCategory(post.content.ai_suggestion?.category || "행사"),
            region: isWGCC ? "김해" : (post.content.ai_suggestion?.region || "경남"),
            venue: isWGCC ? "김해서부문화센터" : (post.content.ai_suggestion?.venue || ""),
            event_date_start: post.content.ai_suggestion?.date_start || "",
            event_date_end: post.content.ai_suggestion?.date_end || "",
            imageUrl: post.image_urls?.[0] || ""
        });
    };

    const handlePublish = async () => {
        if (!editingPost) return;

        // 예약 발행은 없앴다(specs/019 A0): 예약 상태를 공개로 바꾸는 코드가 어디에도 없어 예약한 행사가 끝내 공개되지 않았다
        // 1. Insert into events
        // Remove UI-only fields (imageUrl) before inserting
        const { imageUrl, ...eventData } = editForm;

        const { error: insertError } = await supabase.from("events").insert([{
            ...eventData,
            poster_image_url: imageUrl || "", // Use extracted imageUrl for the correct column
            source: editingPost.source,
            original_url: editingPost.source_url,
            status: "PUBLISHED",
            raw_post_id: editingPost.id,
            published_at: new Date().toISOString()
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
        // 인스타 후보 탭에서 «반영 안 함»한 줄(무더기가 있음)은 REVIEW 로 되돌린다. PENDING 으로 두면 정기 자동 공개에 걸린다
        const fromReview = !!rejectedPosts.find(p => p.id === postId)?.content?.review_bucket;
        const { error } = await supabase.from("raw_posts").update({ status: fromReview ? "REVIEW" : "PENDING" }).eq("id", postId);
        if (!error) {
            const restoredPost = rejectedPosts.find(p => p.id === postId);
            setRejectedPosts(rejectedPosts.filter(p => p.id !== postId));
            if (restoredPost && fromReview) {
                setReviewPosts(prev => [{ ...restoredPost, status: "REVIEW" }, ...prev]);
                setStats(prev => ({ ...prev, rejected: prev.rejected - 1 }));
            } else if (restoredPost) {
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
        const confirmDelete = confirm("이 행사를 삭제하시겠습니까?\n\n현재 노출 중인 행사는 물론, 수집 원본(인박스 데이터)도 함께 삭제되어 재수집이 가능해집니다.");
        if (!confirmDelete) return;

        // 1. Get raw_post_id first
        const { data: eventData } = await supabase.from("events").select("raw_post_id").eq("id", eventId).single();
        const rawPostId = eventData?.raw_post_id;

        // 2. Delete from events
        const { error: eventError } = await supabase.from("events").delete().eq("id", eventId);

        if (!eventError) {
            // 3. Delete from raw_posts if linked
            if (rawPostId) {
                await supabase.from("raw_posts").delete().eq("id", rawPostId);
            }

            setPublishedEvents(publishedEvents.filter(e => e.id !== eventId));
            setStats(prev => ({ ...prev, published: prev.published - 1 }));
        }
    };

    // 선택된 이벤트 일괄 삭제
    const handleDeleteSelectedEvents = async () => {
        if (selectedEvents.length === 0) return;

        const confirmDelete = confirm(`선택한 ${selectedEvents.length}개의 행사를 삭제하시겠습니까?\n\n수집 원본도 함께 삭제되어 다시 수집할 수 있게 됩니다.`);
        if (!confirmDelete) return;

        try {
            const deletedCount = selectedEvents.length;
            let errorCount = 0;

            // 선택된 모든 이벤트 삭제
            for (const eventId of selectedEvents) {
                // Get raw_post_id first
                const { data: evData } = await supabase.from("events").select("raw_post_id").eq("id", eventId).single();

                // Delete from events
                const { error: eventError } = await supabase.from("events").delete().eq("id", eventId);

                if (eventError) {
                    console.error(`Failed to delete event ${eventId}:`, eventError);
                    errorCount++;
                } else if (evData?.raw_post_id) {
                    // Delete from raw_posts if exists
                    await supabase.from("raw_posts").delete().eq("id", evData.raw_post_id);
                }
            }

            // 상태 초기화
            setSelectedEvents([]);
            setIsSelectMode(false);

            // 데이터 새로고침
            await fetchData();

            if (errorCount > 0) {
                alert(`${deletedCount - errorCount}개의 행사가 삭제되었습니다.\n${errorCount}개의 행사 삭제에 실패했습니다.`);
            } else {
                alert(`${deletedCount}개의 행사가 삭제되었습니다.`);
            }
        } catch (error) {
            console.error("Delete error:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };


    // 인스타 후보 탭에서 바뀐 줄 반영: REVIEW 면 내용만 바꾸고, 아니면(REJECTED) 목록에서 빼 휴지통에 넣는다
    const applyReviewChanges = (changes: ReviewChange[]) => {
        if (changes.length === 0) return;
        const byId = new Map(changes.map(c => [c.id, c]));
        setReviewPosts(prev => prev.flatMap(p => {
            const ch = byId.get(p.id);
            if (!ch) return [p];
            return ch.status === "REVIEW" ? [{ ...p, content: ch.content }] : [];
        }));
        const rejected = changes.filter(c => c.status === "REJECTED");
        if (rejected.length) {
            const moved = reviewPosts.filter(p => rejected.some(c => c.id === p.id))
                .map(p => ({ ...p, status: "REJECTED", content: byId.get(p.id)!.content }));
            setRejectedPosts(prev => [...moved, ...prev]);
            setStats(prev => ({ ...prev, rejected: prev.rejected + moved.length }));
        }
    };

    const reviewCount = (b: ReviewBucket) => reviewPosts.filter(p => p.content?.review_bucket === b).length;

    const copyDMMessage = (post: RawPost) => {
        const author = post.content.username || "작가";
        const title = post.content.title || "작품/행사";
        const message = `안녕하세요, 피카(pica)입니다.\n@${author}님께서 올리신 '${title}' 정보를 저희 사이트에 소개하고 싶어 연락드렸습니다.\n\n출처 표기 및 원본 링크를 함께 게시하며, 언제든 삭제 요청이 가능합니다.\n내용 확인차 연락드렸는데, 혹시 게시를 허락해 주실 수 있을까요?\n감사합니다!`;

        navigator.clipboard.writeText(message);
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <Box pb={40}>
            <Container size="lg" pt={32}>

                {/* Header Section */}
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
                            <Inbox size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(28)} fw={900}>공개 판단</Title>
                            <Text c="dimmed" fw={500}>자동 공개에서 빠진 수집분과 인스타 후보를 검토합니다.</Text>
                        </Box>
                    </Group>

                    <Group align="flex-end" gap="lg">
                        <Stack gap={0} align="flex-end">
                            <Text size="xs" fw={700} c="indigo" tt="uppercase">검토 대기중</Text>
                            <Title order={2} size="h1" c="indigo" fw={900} style={{ fontSize: rem(48), lineHeight: 1 }}>
                                {stats.pending}
                            </Title>
                        </Stack>
                        <Group gap="xs">
                            <ActionIcon
                                variant="light"
                                color="gray"
                                radius="xl"
                                size="lg"
                                onClick={fetchData}
                                loading={loading}
                            >
                                <RefreshCcw size={18} />
                            </ActionIcon>
                        </Group>
                    </Group>
                </Group>

                {/* Tabs */}
                <ScrollArea mb={30} type="auto" offsetScrollbars>
                    <SegmentedControl
                        value={activeTab}
                        onChange={(value) => setActiveTab(value as TabType)}
                        data={[
                            { label: `자동 공개 대기 (${stats.pending})`, value: 'pending' },
                            ...REVIEW_BUCKETS.map(b => ({ label: `${BUCKET_LABEL[b]} (${reviewCount(b)})`, value: b })),
                            { label: `현재 노출 (${stats.published})`, value: 'published' },
                        ]}
                        size="md"
                        radius="xl"
                    />
                </ScrollArea>

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
                                                            radius="xl"
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
                                                            radius="md"
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
                                                            radius="xl"
                                                            onClick={() => handleDeletePending(post.id)}
                                                            title="영구 삭제"
                                                        >
                                                            <Trash2 size={16} />
                                                        </ActionIcon>
                                                        <Button variant="default" color="gray" radius="xl" onClick={() => handleReject(post.id)} leftSection={<XCircle size={14} />}>
                                                            거절
                                                        </Button>
                                                        <Button color="indigo" radius="xl" onClick={() => openEditModal(post)} leftSection={<Edit3 size={14} />}>
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
                ) : activeTab !== "published" ? (
                    /* 인스타 후보(REVIEW) 무더기 탭 */
                    <ReviewQueue
                        key={activeTab}
                        bucket={activeTab}
                        posts={reviewPosts.filter(p => p.content?.review_bucket === activeTab)}
                        loading={loading}
                        onChanged={applyReviewChanges}
                    />
                ) : (
                    /* Published Events - 원래 카드 디자인 + 다중 선택 */
                    <Box mb={60}>
                        <Group justify="space-between" mb="lg">
                            <Group>
                                <Box w={4} h={24} bg="green" style={{ borderRadius: 999 }} />
                                <Title order={2} size="h3" fw={900}>현재 노출중인 행사 ({stats.published})</Title>
                            </Group>
                            <Group gap="xs">
                                {isSelectMode && selectedEvents.length > 0 && (
                                    <Button
                                        variant="filled"
                                        color="red"
                                        size="sm"
                                        leftSection={<Trash2 size={16} />}
                                        onClick={handleDeleteSelectedEvents}
                                    >
                                        삭제 ({selectedEvents.length})
                                    </Button>
                                )}
                                <Button
                                    variant={isSelectMode ? "light" : "light"}
                                    color="gray"
                                    size="sm"
                                    leftSection={<Trash2 size={16} />}
                                    onClick={() => {
                                        setIsSelectMode(!isSelectMode);
                                        setSelectedEvents([]);
                                    }}
                                >
                                    {isSelectMode ? "취소" : "삭제선택"}
                                </Button>
                            </Group>
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
                                        <Box style={{ minWidth: 0, flex: 1 }}>
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
                                            data={[...GN_REGIONS]}
                                            value={editForm.region}
                                            onChange={(val) => setEditForm({ ...editForm, region: val || '창원' })}
                                            size="md"
                                            radius="md"
                                        />
                                        <Select
                                            label="카테고리"
                                            leftSection={<Tag size={16} />}
                                            data={CATEGORIES}
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

        </Box>
    );
}
