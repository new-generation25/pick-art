"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import {
    Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Badge, ActionIcon, Paper,
    SimpleGrid, Modal, SegmentedControl,
    LoadingOverlay, Box, Tooltip
} from "@mantine/core";
import { latestRunRows, runStatusTone, type CollectorRun } from "@/lib/opsStats";

// 출처(whitelist) 목록. 수집은 이 PC의 정기 실행(매일 08:20·15:00)이 한다.
// 예전의 «실행»·«중지»·«Collector ON/OFF»·크롤링 로그·차단 목록은 없앴다(specs/019 A0):
// 운영 주소에서는 이 PC의 수집기에 닿지 않아 동작하지 않았고, 차단 목록은 0건이었다.
// 대신 출처마다 마지막 정기 실행 결과(ops_snapshots.collector_runs)를 보여 준다.

interface SourceItem {
    id: string;
    name?: string;
    value: string;
    type: string;
    created_at: string;
    role?: string | null;          // official 기관 · group 단체 · artist 예술인 · informant 정보 계정 · dormant 휴면
    score?: number | null;         // 인스타그램 계정 채점(100점)
    score_detail?: string | null;  // 채점 근거
}

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
    official: { label: "공식", color: "blue" },
    group: { label: "단체", color: "teal" },
    artist: { label: "예술인", color: "grape" },
    informant: { label: "정보 계정", color: "orange" },
    dormant: { label: "휴면", color: "gray" },
};

const TYPE_LABEL: Record<string, string> = { webpage: "웹", naver_blog: "블로그", instagram: "인스타", facebook: "페이스북" };
const TYPE_OPTIONS = [
    { value: "webpage", label: "웹(행사 게시판)" },
    { value: "naver_blog", label: "네이버 블로그" },
    { value: "instagram", label: "인스타그램" },
];
type TypeFilter = "webpage" | "naver_blog" | "instagram" | "all";

function runTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

export default function SourcesPage() {
    const [items, setItems] = useState<SourceItem[]>([]);
    const [runs, setRuns] = useState<Map<string, CollectorRun>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("webpage");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SourceItem | null>(null);
    const [formData, setFormData] = useState({ name: "", value: "", type: "webpage" });
    const [deleting, setDeleting] = useState<SourceItem | null>(null);
    const [saveError, setSaveError] = useState("");

    const fetchItems = async () => {
        const [w, snap] = await Promise.all([
            supabase.from("whitelist").select("id,name,value,type,created_at,role,score,score_detail").order("created_at", { ascending: false }).limit(2000),
            supabase.from("ops_snapshots").select("data").eq("name", "collector_runs").maybeSingle(),
        ]);
        setError(w.error ? `출처를 읽지 못했습니다: ${w.error.message}` : "");
        setItems((w.data || []) as SourceItem[]);
        const rows = (snap.data?.data as { rows?: CollectorRun[] } | undefined)?.rows;
        const latest = latestRunRows(Array.isArray(rows) ? rows : []);
        setRuns(new Map(latest.map(r => [r.source, r])));
        setIsLoading(false);
    };

    useEffect(() => {
        (async () => { await fetchItems(); })();
    }, []);

    const openModal = (item?: SourceItem) => {
        setEditingItem(item || null);
        setFormData(item ? { name: item.name || "", value: item.value || "", type: item.type || "webpage" } : { name: "", value: "", type: typeFilter === "all" ? "webpage" : typeFilter });
        setSaveError("");
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const payload = { name: formData.name.trim(), value: formData.value.trim(), type: formData.type };
        if (!payload.value) { setSaveError("주소를 넣어 주세요."); return; }
        const result = editingItem
            ? await supabase.from("whitelist").update(payload).eq("id", editingItem.id)
            : await supabase.from("whitelist").insert([payload]);
        if (result.error) { setSaveError(result.error.message); return; }
        setIsModalOpen(false);
        fetchItems();
    };

    const handleDelete = async () => {
        if (!deleting) return;
        const { error: err } = await supabase.from("whitelist").delete().eq("id", deleting.id);
        if (err) setError(`지우지 못했습니다: ${err.message}`);
        setDeleting(null);
        fetchItems();
    };

    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const i of items) c[i.type] = (c[i.type] || 0) + 1;
        return c;
    }, [items]);

    const shown = useMemo(() => {
        const s = searchTerm.trim().toLowerCase();
        return items
            .filter(i => typeFilter === "all" || i.type === typeFilter)
            .filter(i => !s || i.name?.toLowerCase().includes(s) || i.value?.toLowerCase().includes(s));
    }, [items, typeFilter, searchTerm]);

    return (
        <Box mih="100vh" py={32}>
            <Container size="lg">
                <Group justify="space-between" mb="lg" wrap="wrap">
                    <Stack gap={0}>
                        <Title order={2} fw={900}>출처</Title>
                        <Text c="dimmed" size="sm">정기 실행(매일 08:20·15:00)이 읽는 곳입니다. 카드의 «마지막 실행»은 가장 최근 회차의 결과입니다.</Text>
                    </Stack>
                    <Button leftSection={<Plus size={16} />} onClick={() => openModal()}>출처 추가</Button>
                </Group>

                <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
                    <SegmentedControl
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v as TypeFilter)}
                        radius="xl"
                        data={[
                            { value: "webpage", label: `웹 ${counts.webpage || 0}` },
                            { value: "naver_blog", label: `블로그 ${counts.naver_blog || 0}` },
                            { value: "instagram", label: `인스타 ${counts.instagram || 0}` },
                            { value: "all", label: `전체 ${items.length}` },
                        ]}
                    />
                    <TextInput placeholder="이름·주소로 찾기" leftSection={<Search size={16} />} value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} radius="xl" style={{ flex: "1 1 220px", maxWidth: 320 }} />
                </Group>

                {error && <Text c="red" size="sm" mb="md" role="alert">{error}</Text>}

                <Box pos="relative" mih={120}>
                    <LoadingOverlay visible={isLoading} />
                    {!isLoading && shown.length === 0 && <Text c="dimmed" ta="center" py="xl">조건에 맞는 출처가 없습니다.</Text>}
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {shown.map((item) => {
                            const run = runs.get(item.name || "");
                            const tone = run ? runStatusTone(run.status) : null;
                            return (
                                <Paper key={item.id} withBorder p="md" radius="md">
                                    <Stack gap="xs">
                                        <Group justify="space-between" wrap="nowrap">
                                            <Group gap={4}>
                                                <Badge variant="light" size="sm">{TYPE_LABEL[item.type] || item.type}</Badge>
                                                {item.role && ROLE_LABEL[item.role] && (
                                                    <Badge variant="light" size="sm" color={ROLE_LABEL[item.role].color}>{ROLE_LABEL[item.role].label}</Badge>
                                                )}
                                                {item.score != null && (
                                                    <Badge variant="filled" size="sm" color={item.score >= 80 ? "green" : item.score >= 60 ? "yellow" : "gray"}>{item.score}점</Badge>
                                                )}
                                            </Group>
                                            <Group gap={4} wrap="nowrap">
                                                <ActionIcon variant="subtle" size="md" aria-label="고치기" onClick={() => openModal(item)}><Edit2 size={15} /></ActionIcon>
                                                <ActionIcon variant="subtle" color="red" size="md" aria-label="지우기" onClick={() => setDeleting(item)}><Trash2 size={15} /></ActionIcon>
                                            </Group>
                                        </Group>
                                        <Text fw={700} lineClamp={1}>{item.name || item.value}</Text>
                                        <Text size="xs" c="dimmed" lineClamp={1} style={{ wordBreak: "break-all" }}>{item.value}</Text>
                                        {item.score_detail && (
                                            <Tooltip label={item.score_detail} multiline w={280}>
                                                <Text size="xs" c="dimmed" lineClamp={2}>{item.score_detail}</Text>
                                            </Tooltip>
                                        )}
                                        {run && (
                                            <Text size="xs" c={tone === "bad" ? "red" : tone === "ok" ? "teal" : "dimmed"} mt={4}>
                                                마지막 실행 {runTime(run.run_at)} · {tone === "ok" ? `발견 ${run.found ?? 0}건(새 ${run.new ?? 0})` : (run.note || run.status || "기록 없음")}
                                                {run.expired_def ? " · 정의 만료 의심" : ""}
                                            </Text>
                                        )}
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </SimpleGrid>
                </Box>
            </Container>

            <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "출처 고치기" : "출처 추가"}>
                <Stack>
                    <TextInput label="이름" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    <TextInput label="주소" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
                    <Select label="종류" data={TYPE_OPTIONS} value={formData.type} onChange={(v) => setFormData({ ...formData, type: v || "webpage" })} allowDeselect={false} />
                    {formData.type === "webpage" && <Text size="xs" c="dimmed">웹 출처는 정의 파일(collector/sources)이 있어야 읽힙니다. 주소만 넣으면 다음 회차에 «정의 파일 없음» 경고가 켜집니다.</Text>}
                    {saveError && <Text size="sm" c="red" role="alert">{saveError}</Text>}
                    <Button onClick={handleSave}>저장</Button>
                </Stack>
            </Modal>

            <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="출처 지우기" centered>
                <Stack>
                    <Text size="sm">«{deleting?.name || deleting?.value}»를 출처 목록에서 지웁니다. 되돌릴 수 없습니다. 이미 수집·공개된 행사는 그대로 남습니다.</Text>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setDeleting(null)}>취소</Button>
                        <Button color="red" onClick={handleDelete}>지우기</Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
