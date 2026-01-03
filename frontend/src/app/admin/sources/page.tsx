"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Plus, Search, Trash2, Edit2, Check, X,
    RefreshCcw, AlertCircle, Clock, Loader2, StopCircle
} from "lucide-react";
import {
    Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Badge, ActionIcon, Paper,
    SimpleGrid, Modal, SegmentedControl,
    LoadingOverlay, Timeline, Box, Alert, Progress
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

    const [logs, setLogs] = useState<any[]>([]);
    const [collectorStatus, setCollectorStatus] = useState<{ running: boolean; message: string } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SourceItem | null>(null);
    const [formData, setFormData] = useState({
        name: "", url: "", type: "webpage", value: "", reason: "", schedule: "daily",
    });

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    // 실시간 로그 업데이트 (2초마다)
    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, []);

    // Collector 상태 확인 (5초마다)
    useEffect(() => {
        const checkCollectorStatus = async () => {
            try {
                const res = await fetch('/api/collector/status');
                const data = await res.json();
                setCollectorStatus(data);
            } catch (err) {
                setCollectorStatus({ running: false, message: 'Failed to check status' });
            }
        };

        checkCollectorStatus();
        const interval = setInterval(checkCollectorStatus, 5000);
        return () => clearInterval(interval);
    }, []);

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
        try {
            const { data, error } = await supabase
                .from('crawl_logs')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(10);
            if (!error && data) setLogs(data);
        } catch (err) {
            // Silence errors
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
        // 이미 실행 중인지 확인
        const isRunning = logs.some(log =>
            (log.status === 'RUNNING' || log.status === 'REQUESTED') &&
            log.target_name === (item.name || item.value)
        );

        if (isRunning) {
            alert(`${item.name || item.value}는 이미 크롤링이 진행 중입니다.\n\n중복 실행을 방지하기 위해 대기 중입니다.`);
            return;
        }

        try {
            // 1. Collector 상태 확인
            const statusRes = await fetch('/api/collector/status');
            const status = await statusRes.json();

            // 2. Collector가 실행 중이 아니면 자동 시작
            if (!status.running) {
                const confirmStart = confirm(
                    `⚠️ Collector 서비스가 실행 중이 아닙니다.\n\n자동으로 시작하시겠습니까?\n\n(취소 시 수동으로 Collector를 실행해야 합니다)`
                );

                if (confirmStart) {
                    // Collector 시작
                    const startRes = await fetch('/api/collector/status', { method: 'POST' });
                    const startResult = await startRes.json();

                    if (!startResult.success) {
                        alert(`Collector 시작 실패: ${startResult.message}\n\n수동으로 Collector를 실행해주세요.`);
                        return;
                    }

                    alert('✅ Collector가 시작되었습니다.\n\n잠시 후 크롤링이 시작됩니다.');
                } else {
                    return; // 사용자가 취소한 경우
                }
            }

            // 3. 크롤링 요청 생성
            await supabase.from('crawl_logs').insert([{
                target_name: item.name || item.value,
                started_at: new Date().toISOString(),
                result_summary: '수동 실행 요청됨',
                status: 'REQUESTED'
            }]);

            alert(`${item.name || item.value} 크롤링 요청이 등록되었습니다.\n\n아래 로그 영역에서 진행 상황을 확인하세요.`);
        } catch (e) {
            alert(`크롤링 요청 중 오류 발생: ${e}`);
        }
    };

    const handleStopCrawl = async (logId: string, targetName: string) => {
        if (!confirm(`${targetName} 크롤링을 중지하시겠습니까?`)) return;

        try {
            await supabase.from('crawl_logs').update({
                status: 'CANCELLED',
                result_summary: '사용자가 수동으로 중지함',
                finished_at: new Date().toISOString()
            }).eq('id', logId);

            alert(`${targetName} 크롤링이 중지되었습니다.`);
            fetchLogs(); // 즉시 로그 갱신
        } catch (e) {
            alert(`크롤링 중지 중 오류 발생: ${e}`);
        }
    };

    // 진행 중인 크롤링 로그
    const runningLogs = logs.filter(log => log.status === 'RUNNING' || log.status === 'REQUESTED');
    const recentLogs = logs.slice(0, 5);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'green';
            case 'FAIL': return 'red';
            case 'RUNNING': return 'blue';
            case 'REQUESTED': return 'yellow';
            case 'CANCELLED': return 'gray';
            default: return 'gray';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS': return <Check size={14} />;
            case 'FAIL': return <X size={14} />;
            case 'RUNNING': return <Loader2 size={14} className="animate-spin" />;
            case 'REQUESTED': return <Clock size={14} />;
            case 'CANCELLED': return <StopCircle size={14} />;
            default: return <AlertCircle size={14} />;
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
                        <Group gap="xs">
                            <Text c="dimmed" size="sm">수집 소스 및 차단 대상을 관리합니다.</Text>
                            {collectorStatus && (
                                <Badge
                                    size="sm"
                                    color={collectorStatus.running ? 'green' : 'red'}
                                    variant="dot"
                                >
                                    Collector {collectorStatus.running ? 'ON' : 'OFF'}
                                </Badge>
                            )}
                        </Group>
                    </Stack>
                    <Button leftSection={<Plus size={16} />} onClick={() => handleOpenModal()}>
                        추가하기
                    </Button>
                </Group>

                {/* 실시간 크롤링 상태 영역 */}
                {runningLogs.length > 0 && (
                    <Alert icon={<Loader2 size={16} className="animate-spin" />} title="크롤링 진행 중" color="blue" mb="xl">
                        <Stack gap="xs">
                            {runningLogs.map(log => (
                                <Group key={log.id} justify="space-between">
                                    <Group gap="xs">
                                        <Text size="sm" fw={500}>{log.target_name}</Text>
                                        <Badge size="sm" color={getStatusColor(log.status)} leftSection={getStatusIcon(log.status)}>
                                            {log.status}
                                        </Badge>
                                    </Group>
                                    <Button
                                        size="compact-xs"
                                        variant="light"
                                        color="red"
                                        leftSection={<StopCircle size={12} />}
                                        onClick={() => handleStopCrawl(log.id, log.target_name)}
                                    >
                                        중지
                                    </Button>
                                </Group>
                            ))}
                            <Progress value={100} size="xs" animated striped />
                        </Stack>
                    </Alert>
                )}

                {/* 최근 로그 영역 */}
                <Paper withBorder p="md" mb="xl" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={700} size="sm">최근 크롤링 로그</Text>
                        <Button variant="subtle" size="compact-xs" onClick={fetchLogs} leftSection={<RefreshCcw size={12} />}>
                            새로고침
                        </Button>
                    </Group>
                    {recentLogs.length > 0 ? (
                        <Timeline active={-1} bulletSize={20} lineWidth={2}>
                            {recentLogs.map((log) => (
                                <Timeline.Item
                                    key={log.id}
                                    bullet={getStatusIcon(log.status)}
                                    title={
                                        <Group justify="space-between">
                                            <Text size="sm" fw={600}>{log.target_name}</Text>
                                            <Badge size="xs" color={getStatusColor(log.status)}>{log.status}</Badge>
                                        </Group>
                                    }
                                >
                                    <Text size="xs" c="dimmed">{log.result_summary || '처리 중...'}</Text>
                                    <Text size="xs" c="dimmed">{new Date(log.started_at).toLocaleString('ko-KR')}</Text>
                                    {log.finished_at && (
                                        <Text size="xs" c="dimmed">
                                            완료: {new Date(log.finished_at).toLocaleString('ko-KR')}
                                        </Text>
                                    )}
                                    {log.error_msg && (
                                        <Text size="xs" c="red" mt={4}>⚠️ {log.error_msg}</Text>
                                    )}
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    ) : (
                        <Text size="sm" c="dimmed" ta="center" py="lg">아직 크롤링 로그가 없습니다.</Text>
                    )}
                </Paper>

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
