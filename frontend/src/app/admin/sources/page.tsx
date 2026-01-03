"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Plus, Search, Trash2, Edit2, Check, X,
    ArrowRight, RefreshCcw, AlertCircle, Play,
    Clock, Calendar, List, ShieldCheck
} from "lucide-react";
import {
    Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Badge, ActionIcon, Paper,
    SimpleGrid, Modal, SegmentedControl, ThemeIcon, rem,
    LoadingOverlay, ScrollArea, Drawer, Timeline, Loader, Box
} from "@mantine/core";

type SourceType = "trusted" | "blocked";

interface SourceItem {
    id: number;
    name?: string;
    value: string;
    type: string;
    reason?: string;
    created_at: string;
    schedule?: string;
}

export default function SourcesPage() {
    const [activeTab, setActiveTab] = useState<SourceType>("trusted");
    const [items, setItems] = useState<SourceItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SourceItem | null>(null);
    const [formData, setFormData] = useState({
        name: "", url: "", type: "webpage", value: "", reason: "", schedule: "daily",
    });

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const table = activeTab === "trusted" ? "whitelist" : "blacklist";
            const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
            if (!error && data) setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async () => {
        setIsLogsLoading(true);
        try {
            const { data, error } = await supabase
                .from('crawl_logs')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(20);
            if (!error && data) setLogs(data);
        } catch (err) {
            // Silence 404
        } finally {
            setIsLogsLoading(false);
        }
    };

    const handleOpenModal = (item?: SourceItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name || "",
                url: item.value || "",
                type: item.type || "webpage",
                value: item.value || "",
                reason: item.reason || "",
                schedule: (item as any).schedule || "daily"
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: "", url: "", type: activeTab === 'trusted' ? "webpage" : "domain",
                value: "", reason: "", schedule: "daily"
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const table = activeTab === "trusted" ? "whitelist" : "blacklist";
        const payload: any = activeTab === "trusted"
            ? { name: formData.name, value: formData.url, type: formData.type, schedule: formData.schedule }
            : { type: formData.type, value: formData.value, reason: formData.reason };

        if (!payload.value) return alert("필수 항목을 입력해주세요.");

        const result = editingItem
            ? await supabase.from(table).update(payload).eq("id", editingItem.id)
            : await supabase.from(table).insert([payload]);

        if (result.error) alert(result.error.message);
        else { setIsModalOpen(false); fetchItems(); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        await supabase.from(activeTab === "trusted" ? "whitelist" : "blacklist").delete().eq("id", id);
        fetchItems();
    };

    const handleRunCrawl = async (item: SourceItem) => {
        try {
            await supabase.from('crawl_logs').insert([{
                target_name: item.name || item.value,
                started_at: new Date().toISOString(),
                result_summary: '수동 실행 요청됨',
                status: 'REQUESTED'
            }]);
            alert(`${item.name || item.value} 크롤링 요청됨`);
        } catch (e) {
            alert(`${item.name || item.value} 수집 시작`);
        }
    };

    const filteredItems = items.filter(item => {
        const s = searchTerm.toLowerCase();
        return (item.name?.toLowerCase().includes(s) || item.value?.toLowerCase().includes(s));
    });

    return (
        <Box mih="100vh" py={120}>
            <Container size="lg">
                <Group justify="space-between" mb="xl">
                    <Stack gap={0}>
                        <Title order={2} fw={900}>출처 관리</Title>
                        <Text c="dimmed" size="sm">수집 소스 및 차단 대상을 관리합니다.</Text>
                    </Stack>
                    <Group>
                        <Button variant="light" color="gray" leftSection={<List size={16} />} onClick={() => { setIsLogDrawerOpen(true); fetchLogs(); }}>
                            로그 보기
                        </Button>
                        <Button leftSection={<Plus size={16} />} onClick={() => handleOpenModal()}>
                            추가하기
                        </Button>
                    </Group>
                </Group>

                <Group justify="space-between" mb="xl">
                    <SegmentedControl value={activeTab} onChange={(v) => setActiveTab(v as SourceType)} data={['trusted', 'blocked']} radius="xl" />
                    <TextInput placeholder="검색..." leftSection={<Search size={16} />} value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} radius="xl" w={300} />
                </Group>

                <Box pos="relative">
                    <LoadingOverlay visible={isLoading} />
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {filteredItems.map((item) => (
                            <Paper key={item.id} withBorder p="md" radius="md">
                                <Stack gap="xs">
                                    <Group justify="space-between">
                                        <Badge variant="light" size="sm">{item.type}</Badge>
                                        <Group gap={4}>
                                            <ActionIcon variant="subtle" size="sm" onClick={() => handleOpenModal(item)}><Edit2 size={14} /></ActionIcon>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></ActionIcon>
                                        </Group>
                                    </Group>
                                    <Text fw={700} lineClamp={1}>{item.name || item.value}</Text>
                                    <Text size="xs" c="dimmed" lineClamp={1}>{item.value}</Text>
                                    {activeTab === 'trusted' && (
                                        <Group justify="space-between" mt="sm">
                                            <Group gap={4}><Clock size={12} /><Text size="xs" c="dimmed">{item.schedule || 'daily'}</Text></Group>
                                            <Button size="compact-xs" variant="light" onClick={() => handleRunCrawl(item)}>실행</Button>
                                        </Group>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </Box>
            </Container>

            <Drawer
                opened={isLogDrawerOpen}
                onClose={() => setIsLogDrawerOpen(false)}
                title="실시간 수집 로그" // plain string to avoid h2 > h4 nesting
                position="right"
                size="md"
            >
                <ScrollArea h="calc(100vh - 80px)" p="md">
                    {isLogsLoading ? <Loader size="sm" /> : logs.length > 0 ? (
                        <Timeline active={-1} bulletSize={20} lineWidth={2}>
                            {logs.map((log) => (
                                <Timeline.Item key={log.id} bullet={log.status === 'SUCCESS' ? <Check size={10} /> : <Clock size={10} />} title={<Text size="sm" fw={700}>{log.target_name}</Text>}>
                                    <Text size="xs">{log.result_summary}</Text>
                                    <Text size="xs" c="dimmed">{new Date(log.started_at).toLocaleString()}</Text>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    ) : <Text size="sm" c="dimmed" ta="center" py="xl">로그가 없습니다.</Text>}
                </ScrollArea>
            </Drawer>

            <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "수정" : "추가"}>
                <Stack>
                    <TextInput label="이름" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    <TextInput label="URL/값" value={formData.url || formData.value} onChange={(e) => setFormData({ ...formData, url: e.target.value, value: e.target.value })} required />
                    <Select label="유형" data={['webpage', 'facebook', 'instagram', 'source']} value={formData.type} onChange={(v) => setFormData({ ...formData, type: v || 'webpage' })} />
                    <Button onClick={handleSave}>저장</Button>
                </Stack>
            </Modal>
        </Box>
    );
}
