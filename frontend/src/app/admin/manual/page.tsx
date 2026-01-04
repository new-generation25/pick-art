"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { PlusCircle, Image as ImageIcon, Save, ArrowLeft, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Box, Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Textarea, Paper, FileButton, ActionIcon,
    rem, LoadingOverlay, ThemeIcon, SimpleGrid
} from "@mantine/core";

export default function AdminManualAddPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "공연",
        region: "창원",
        venue: "",
        event_date_start: "",
        price_info: "",
        poster_image_url: "",
        source_url: ""
    });

    const handleImageUpload = (file: File | null) => {
        if (!file) return;

        // 파일 크기 체크 (5MB 제한)
        if (file.size > 5 * 1024 * 1024) {
            alert("파일 크기는 5MB 이하여야 합니다.");
            return;
        }

        // 이미지 파일 타입 체크
        if (!file.type.startsWith('image/')) {
            alert("이미지 파일만 업로드 가능합니다.");
            return;
        }

        setImageFile(file);

        // 미리보기 생성
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview("");
        setFormData({ ...formData, poster_image_url: "" });
    };

    const uploadImageToSupabase = async (): Promise<string | null> => {
        if (!imageFile) return formData.poster_image_url || null;

        setUploading(true);
        try {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `event-posters/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('event-images')
                .upload(filePath, imageFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                alert("이미지 업로드 중 오류가 발생했습니다: " + uploadError.message);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('event-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error: any) {
            console.error('Upload error:', error);
            alert("이미지 업로드 중 오류가 발생했습니다.");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // 이미지 업로드 (파일이 있는 경우)
        let posterUrl = formData.poster_image_url;
        if (imageFile) {
            const uploadedUrl = await uploadImageToSupabase();
            if (!uploadedUrl) {
                setLoading(false);
                return;
            }
            posterUrl = uploadedUrl;
        }

        const { error } = await supabase.from("events").insert({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            region: formData.region,
            venue: formData.venue,
            event_date_start: formData.event_date_start,
            price_info: formData.price_info,
            poster_image_url: posterUrl,
            original_url: formData.source_url,
            status: "PUBLISHED",
            source: "manual",
            published_at: new Date().toISOString()
        });

        if (error) {
            alert("저장 중 오류가 발생했습니다: " + error.message);
        } else {
            alert("행사가 성공적으로 등록되었습니다.");
            router.push("/");
        }
        setLoading(false);
    };

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
                            <PlusCircle size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>수동 행사 등록</Title>
                            <Text c="dimmed" fw={500}>크롤링되지 않은 새로운 행사를 직접 등록합니다.</Text>
                        </Box>
                    </Group>
                    <Button
                        component={Link}
                        href="/admin"
                        variant="light"
                        color="gray"
                        radius="xl"
                        leftSection={<ArrowLeft size={18} />}
                    >
                        관리자 홈
                    </Button>
                </Group>

                <Paper radius="xl" p="xl" withBorder shadow="sm" style={{ position: 'relative', overflow: 'hidden' }}>
                    <LoadingOverlay visible={loading || uploading} overlayProps={{ radius: 'xl', blur: 2 }} />

                    <form onSubmit={handleSubmit}>
                        <Stack gap="lg">
                            {/* Title Section */}
                            <TextInput
                                label="행사 제목"
                                placeholder="예: 2024 경남 아트 페스티벌"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                size="md"
                                radius="md"
                                fw={700}
                            />

                            {/* Row 1: Basic Info (3 columns) */}
                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                                <Select
                                    label="카테고리"
                                    data={['공연', '전시', '축제', '강연', '체험']}
                                    value={formData.category}
                                    onChange={val => setFormData({ ...formData, category: val || '공연' })}
                                    size="md"
                                    radius="md"
                                />
                                <Select
                                    label="지역"
                                    data={['창원', '김해', '진주', '통영', '거제', '양산', '밀양']}
                                    value={formData.region}
                                    onChange={val => setFormData({ ...formData, region: val || '창원' })}
                                    size="md"
                                    radius="md"
                                />
                                <TextInput
                                    label="장소"
                                    placeholder="예: 경남도립미술관"
                                    value={formData.venue}
                                    onChange={e => setFormData({ ...formData, venue: e.target.value })}
                                    size="md"
                                    radius="md"
                                />
                            </SimpleGrid>

                            {/* Row 2: Event Details (3 columns) */}
                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                                <TextInput
                                    type="date"
                                    label="시작 일자"
                                    value={formData.event_date_start}
                                    onChange={e => setFormData({ ...formData, event_date_start: e.target.value })}
                                    size="md"
                                    radius="md"
                                />
                                <TextInput
                                    label="가격 정보"
                                    placeholder="예: 무료 또는 5,000원"
                                    value={formData.price_info}
                                    onChange={e => setFormData({ ...formData, price_info: e.target.value })}
                                    size="md"
                                    radius="md"
                                />
                                <TextInput
                                    label="출처 URL"
                                    placeholder="https://..."
                                    value={formData.source_url}
                                    onChange={e => setFormData({ ...formData, source_url: e.target.value })}
                                    size="md"
                                    radius="md"
                                />
                            </SimpleGrid>

                            {/* Row 3: Image & Description (2 columns) */}
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                                <Box>
                                    <Text fw={700} mb={6} size="sm">포스터 이미지</Text>
                                    <Paper p="md" withBorder radius="md" bg="gray.0" style={{ borderStyle: 'dashed', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {imagePreview ? (
                                            <Box pos="relative" w="100%" maw={240}>
                                                <img
                                                    src={imagePreview}
                                                    alt="미리보기"
                                                    style={{ width: '100%', borderRadius: 'var(--mantine-radius-md)', display: 'block' }}
                                                />
                                                <ActionIcon
                                                    color="red"
                                                    variant="filled"
                                                    size="sm"
                                                    radius="md"
                                                    style={{ position: 'absolute', top: -10, right: -10 }}
                                                    onClick={removeImage}
                                                >
                                                    <X size={14} />
                                                </ActionIcon>
                                            </Box>
                                        ) : (
                                            <Stack align="center" gap={8} w="100%">
                                                <ThemeIcon size={40} radius="md" color="indigo" variant="light">
                                                    <Upload size={20} />
                                                </ThemeIcon>
                                                <Box ta="center">
                                                    <Text fw={700} size="sm">이미지 업로드</Text>
                                                    <Text c="dimmed" style={{ fontSize: rem(10) }}>최대 5MB (png, jpg)</Text>
                                                </Box>
                                                <Group gap={5}>
                                                    <FileButton onChange={handleImageUpload} accept="image/png,image/jpeg">
                                                        {(props) => <Button {...props} variant="outline" color="indigo" radius="md" size="xs">파일 선택</Button>}
                                                    </FileButton>
                                                </Group>
                                                <TextInput
                                                    placeholder="또는 URL 입력"
                                                    value={formData.poster_image_url}
                                                    onChange={e => setFormData({ ...formData, poster_image_url: e.target.value })}
                                                    w="100%"
                                                    size="xs"
                                                    radius="md"
                                                    leftSection={<ImageIcon size={12} />}
                                                />
                                            </Stack>
                                        )}
                                    </Paper>
                                </Box>

                                <Textarea
                                    label="상세 설명"
                                    placeholder="행사 내용을 상세히 입력하세요."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    minRows={15}
                                    size="md"
                                    radius="md"
                                    styles={{ root: { display: 'flex', flexDirection: 'column' }, wrapper: { flex: 1 }, input: { flex: 1 } }}
                                />
                            </SimpleGrid>

                            <Button
                                type="submit"
                                size="lg"
                                radius="md"
                                color="indigo"
                                h={54}
                                disabled={loading || uploading}
                                leftSection={<Save size={20} />}
                                mt="md"
                                style={{ boxShadow: 'var(--mantine-shadow-md)' }}
                            >
                                {uploading ? "이미지 업로드 중..." : loading ? "저장 중..." : "행사 등록 완료"}
                            </Button>
                        </Stack>
                    </form>
                </Paper>
            </Container>
        </Box>
    );
}
