"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Trash2, Edit2, Shield, CheckCircle, XCircle, Save, X } from "lucide-react";
import {
    Box, Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Badge, ActionIcon, Paper,
    SimpleGrid, Modal, SegmentedControl, ThemeIcon, rem, LoadingOverlay
} from "@mantine/core";

type SourceType = "trusted" | "blocked";

interface SourceItem {
    id: number;
    name?: string; // whitelist only
    value?: string; // whitelist & blacklist shared (url or blocked string)
    description?: string; // whitelist only (removed from db but kept in type if needed)
    type?: string; // blacklist only (domain, keyword)
    reason?: string; // blacklist only
    created_at: string;
}

export default function SourcesPage() {
    const [activeTab, setActiveTab] = useState<SourceType>("trusted");
    const [items, setItems] = useState<SourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SourceItem | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        url: "",
        description: "",
        type: "domain",
        value: "",
        reason: ""
    });

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    const fetchItems = async () => {
        setLoading(true);
        const table = activeTab === "trusted" ? "whitelist" : "blacklist";
        const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });

        if (data) setItems(data);
        setLoading(false);
    };

    const handleOpenModal = (item?: SourceItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name || "",
                url: item.value || "",
                description: item.description || "",
                type: item.type || "domain",
                value: item.value || "",
                reason: item.reason || ""
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: "",
                url: "",
                description: "",
                type: "domain",
                value: "",
                reason: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const table = activeTab === "trusted" ? "whitelist" : "blacklist";
        const payload = activeTab === "trusted"
            ? { name: formData.name, value: formData.url, type: 'website' }
            : { type: formData.type, value: formData.value, reason: formData.reason };

        if (!payload.value && activeTab === "trusted") return alert("URL은 필수입니다.");
        if (!payload.value && activeTab === "blocked") return alert("차단할 값은 필수입니다.");

        let error;
        if (editingItem) {
            const { error: updateError } = await supabase.from(table).update(payload).eq("id", editingItem.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from(table).insert([payload]);
            error = insertError;
        }

        if (error) {
            alert("저장 실패: " + error.message);
        } else {
            setIsModalOpen(false);
            fetchItems();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const table = activeTab === "trusted" ? "whitelist" : "blacklist";
        await supabase.from(table).delete().eq("id", id);
        fetchItems();
    };

    const filteredItems = items.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        if (activeTab === "trusted") {
            return item.name?.toLowerCase().includes(searchLower) || item.value?.toLowerCase().includes(searchLower);
        } else {
            return item.value?.toLowerCase().includes(searchLower) || item.reason?.toLowerCase().includes(searchLower);
        }
    });

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>

                {/* Header Section */}
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color={activeTab === 'trusted' ? 'indigo' : 'red'} variant="light">
                            <Shield size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>출처 관리 (Sources)</Title>
                            <Text c="dimmed" fw={500}>수집 대상 사이트(Trusted)와 차단할 키워드/도메인(Blocked)을 관리합니다.</Text>
                        </Box>
                    </Group>
                    <Button
                        size="md"
                        color="dark"
                        radius="xl"
                        leftSection={<Plus size={18} />}
                        onClick={() => handleOpenModal()}
                    >
                        새로운 {activeTab === "trusted" ? "출처" : "차단"} 등록
                    </Button>
                </Group>

                {/* Tabs & Search */}
                <Paper p="md" radius="xl" withBorder mb={30}>
                    <Group justify="space-between">
                        <SegmentedControl
                            value={activeTab}
                            onChange={(val) => setActiveTab(val as SourceType)}
                            data={[
                                { label: 'Trusted (Whitelist)', value: 'trusted' },
                                { label: 'Blocked (Blacklist)', value: 'blocked' },
                            ]}
                            size="md"
                            radius="xl"
                            color={activeTab === 'trusted' ? 'indigo' : 'red'}
                        />
                        <TextInput
                            placeholder={`${activeTab === "trusted" ? "사이트 이름, URL" : "차단 단어, 사유"} 검색...`}
                            leftSection={<Search size={16} />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            radius="xl"
                            style={{ flex: 1, maxWidth: 300 }}
                        />
                    </Group>
                </Paper>

                {/* List */}
                <Box style={{ position: 'relative', minHeight: 200 }}>
                    <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} />

                    {filteredItems.length === 0 && !loading ? (
                        <Paper py={60} radius="xl" withBorder style={{ borderStyle: 'dashed', textAlign: 'center' }}>
                            <Text c="dimmed" fw={700}>등록된 항목이 없습니다.</Text>
                        </Paper>
                    ) : (
                        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                            {filteredItems.map((item) => (
                                <Paper
                                    key={item.id}
                                    p="lg"
                                    radius="xl"
                                    withBorder
                                    shadow="sm"
                                    className="hover:shadow-md transition-shadow group relative overflow-hidden"
                                >
                                    <Box
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: 6,
                                            backgroundColor: activeTab === 'trusted' ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-red-6)'
                                        }}
                                    />

                                    <Group justify="space-between" align="start" mb="md">
                                        <Badge
                                            variant="light"
                                            color={activeTab === 'trusted' ? 'indigo' : 'red'}
                                            size="lg"
                                        >
                                            {activeTab === 'trusted' ? 'Safe Source' : item.type}
                                        </Badge>
                                        <Group gap="xs" style={{ opacity: 0, transition: 'opacity 0.2s' }} className="group-hover:opacity-100">
                                            <ActionIcon variant="subtle" color="gray" onClick={() => handleOpenModal(item)}>
                                                <Edit2 size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id)}>
                                                <Trash2 size={16} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>

                                    {activeTab === "trusted" ? (
                                        <>
                                            <Title order={3} size="h4" fw={900} mb={4}>{item.name}</Title>
                                            <Text size="sm" c="indigo" fw={700} mb="xs" lineClamp={1}>{item.value}</Text>
                                            <Text size="sm" c="dimmed" lineClamp={2}>{item.description || "설명 없음"}</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Title order={3} size="h4" fw={900} mb={4}>{item.value}</Title>
                                            <Text size="sm" c="red" fw={700} mb="xs">{item.type === 'domain' ? '도메인 차단' : '키워드 차단'}</Text>
                                            <Text size="sm" c="dimmed" lineClamp={2}>{item.reason || "사유 없음"}</Text>
                                        </>
                                    )}
                                </Paper>
                            ))}
                        </SimpleGrid>
                    )}
                </Box>
            </Container>

            {/* Modal */}
            <Modal
                opened={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? "정보 수정" : "새로 등록하기"}
                centered
                radius="lg"
                size="md"
            >
                <Stack gap="md">
                    {activeTab === "trusted" ? (
                        <>
                            <TextInput
                                label="사이트/기관명"
                                placeholder="예: 경남문화예술회관"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                            <TextInput
                                label="URL"
                                placeholder="https://..."
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            />
                        </>
                    ) : (
                        <>
                            <Select
                                label="차단 유형"
                                data={[
                                    { value: 'domain', label: '도메인 (URL)' },
                                    { value: 'keyword', label: '키워드 (텍스트)' }
                                ]}
                                value={formData.type}
                                onChange={(val) => setFormData({ ...formData, type: val || 'domain' })}
                            />
                            <TextInput
                                label="차단 값"
                                placeholder={formData.type === 'domain' ? "example.com" : "도박, 불법 등"}
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            />
                            <TextInput
                                label="차단 사유"
                                placeholder="관리자 직권 차단"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            />
                        </>
                    )}

                    <Button fullWidth onClick={handleSave} color={activeTab === 'trusted' ? 'indigo' : 'red'} mt="md">
                        {editingItem ? "수정 완료" : "등록하기"}
                    </Button>
                </Stack>
            </Modal>
        </Box>
    );
}
