"use client";

// 출처·단체 › 출처 (specs/019 A0·A5). 정기 실행(매일 08:20·15:00)이 읽는 곳의 목록.
//   건강 상태: 마지막 회차 결과, 발견 0건이 이어진 횟수, 정의 만료 의심, 켜진 경고 → «살펴볼 것»에 모은다
//   동의 단계(인스타 계정): 없음·임시·상시·철회 — 소규모 단체·예술인 게시물을 싣는 조건
//   쉬게 함(웹·블로그): 이유를 적으면 정기 실행이 건너뛰고 경고를 켜지 않는다
// 운영 주소에서는 이 PC의 수집기를 직접 돌릴 수 없어 «지금 실행»은 두지 않는다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import {
    Container, Title, Text, Button, Group, Stack,
    TextInput, Select, Badge, ActionIcon, Paper,
    SimpleGrid, Modal, LoadingOverlay, Box, Tooltip
} from "@mantine/core";
import { runStatusTone, splitCollectorAlerts, type CollectorAlert, type CollectorRun } from "@/lib/opsStats";
import { todayKST } from "@/lib/utils";
import { CONSENT_HINT, CONSENT_LABEL, type Consent } from "../inbox/ConsentGroups";
import { consentRank, fetchSiteConsents, instaHandle, SITE_CONSENT_HINT, SITE_CONSENT_LABEL, type SiteConsent } from "@/lib/siteConsent";

interface SourceItem {
    id: string;
    name?: string;
    value: string;
    type: string;
    created_at: string;
    role?: string | null;          // official 기관 · group 단체 · artist 예술인 · informant 정보 계정 · dormant 휴면
    score?: number | null;         // 인스타그램 계정 채점(100점)
    score_detail?: string | null;  // 채점 근거
    consent: Consent;
    consent_at: string | null;
    consent_evidence: string | null;
    paused_reason: string | null;
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
type Filter = "watch" | "webpage" | "naver_blog" | "instagram" | "all";
type Health = { last?: CollectorRun; zeroStreak: number; alert?: string };

function runTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

/** 출처 이름별 건강 상태: 마지막 회차 줄, 발견 0건이 최근 몇 회 이어졌는지 */
function healthBySource(runs: CollectorRun[], alerts: CollectorAlert[]): Map<string, Health> {
    const by = new Map<string, CollectorRun[]>();
    for (const r of runs) if (r?.source && r.run_at) by.set(r.source, [...(by.get(r.source) || []), r]);
    const open = splitCollectorAlerts(alerts, Date.now(), 7).open;
    const out = new Map<string, Health>();
    for (const [name, list] of by) {
        list.sort((a, b) => Date.parse(b.run_at) - Date.parse(a.run_at));
        let zero = 0;
        for (const r of list) { if (runStatusTone(r.status) === "ok" && (r.found ?? 0) === 0 && !(r.note || "").includes("일시 중지")) zero++; else break; }
        out.set(name, { last: list[0], zeroStreak: zero, alert: open.find(a => a.target === name)?.text });
    }
    return out;
}

/** 실행 기록은 출처 이름으로 남는다. 인스타 계정은 계정별 기록이 없어(한 묶음으로 수집) 같은 이름의 웹 출처 기록을 붙이지 않는다 */
const healthOf = (health: Map<string, Health>, i: { type: string; name?: string }) => i.type === "instagram" ? undefined : health.get(i.name || "");

const needsLook = (h: Health | undefined, paused: boolean) => !!h && !paused && (runStatusTone(h.last?.status) === "bad" || !!h.last?.expired_def || h.zeroStreak >= 2 || !!h.alert);

export default function SourcesPage() {
    const [items, setItems] = useState<SourceItem[]>([]);
    const [health, setHealth] = useState<Map<string, Health>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<Filter>("watch");
    const [consentFilter, setConsentFilter] = useState<Consent | "">("");
    const [consentFirst, setConsentFirst] = useState(false);   // 동의 받은 계정을 위로
    const [site, setSite] = useState<Record<string, SiteConsent>>({});
    useEffect(() => { let off = false; (async () => { const m = await fetchSiteConsents(); if (!off) setSite(m); })(); return () => { off = true; }; }, []);
    const [shown, setShown] = useState(60);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SourceItem | null>(null);
    const [form, setForm] = useState({ name: "", value: "", type: "webpage", consent: "none" as Consent, consent_evidence: "", paused_reason: "" });
    const [deleting, setDeleting] = useState<SourceItem | null>(null);
    const [saveError, setSaveError] = useState("");

    const fetchItems = useCallback(async () => {
        const [w, snap] = await Promise.all([
            supabase.from("whitelist").select("id,name,value,type,created_at,role,score,score_detail,consent,consent_at,consent_evidence,paused_reason").order("created_at", { ascending: false }).limit(3000),
            supabase.from("ops_snapshots").select("name,data").in("name", ["collector_runs", "collector_alerts"]),
        ]);
        setError(w.error ? `출처를 읽지 못했습니다: ${w.error.message}` : "");
        setItems((w.data || []) as SourceItem[]);
        const rowsOf = (name: string) => ((snap.data || []).find(r => r.name === name)?.data as { rows?: unknown[] } | undefined)?.rows || [];
        setHealth(healthBySource(rowsOf("collector_runs") as CollectorRun[], rowsOf("collector_alerts") as CollectorAlert[]));
        setIsLoading(false);
    }, []);

    useEffect(() => { (async () => { await fetchItems(); })(); }, [fetchItems]);

    const openModal = (item?: SourceItem) => {
        setEditingItem(item || null);
        setForm(item
            ? { name: item.name || "", value: item.value || "", type: item.type || "webpage", consent: item.consent || "none", consent_evidence: item.consent_evidence || "", paused_reason: item.paused_reason || "" }
            : { name: "", value: "", type: filter === "all" || filter === "watch" ? "webpage" : filter, consent: "none", consent_evidence: "", paused_reason: "" });
        setSaveError("");
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.value.trim()) { setSaveError("주소를 넣어 주세요."); return; }
        const insta = form.type === "instagram";
        if (insta && form.consent !== "none" && !form.consent_evidence.trim()) { setSaveError("동의 근거(받은 댓글·DM 주소나 받은 날)를 적어 주세요."); return; }
        const payload: Record<string, unknown> = { name: form.name.trim(), value: form.value.trim(), type: form.type };
        if (insta) {
            const changed = !editingItem || editingItem.consent !== form.consent;
            payload.consent = form.consent;
            payload.consent_evidence = form.consent === "none" ? null : form.consent_evidence.trim().slice(0, 500);
            if (changed) payload.consent_at = form.consent === "none" ? null : todayKST();
        } else {
            payload.paused_reason = form.paused_reason.trim().slice(0, 300) || null;
        }
        const result = editingItem
            ? await supabase.from("whitelist").update(payload).eq("id", editingItem.id).select("id")
            : await supabase.from("whitelist").insert([payload]).select("id");
        if (result.error || !result.data?.length) { setSaveError(result.error?.message || "저장하지 못했습니다(권한 확인)"); return; }
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
        const c: Record<string, number> = { watch: 0 };
        for (const i of items) {
            c[i.type] = (c[i.type] || 0) + 1;
            if (needsLook(healthOf(health, i), !!i.paused_reason)) c.watch++;
        }
        return c;
    }, [items, health]);

    const list = useMemo(() => {
        const s = searchTerm.trim().toLowerCase();
        const out = items
            .filter(i => filter === "all" || (filter === "watch" ? needsLook(healthOf(health, i), !!i.paused_reason) : i.type === filter))
            .filter(i => !consentFilter || (i.type === "instagram" && i.consent === consentFilter))
            .filter(i => !s || i.name?.toLowerCase().includes(s) || i.value?.toLowerCase().includes(s));
        if (!consentFirst) return out;
        // 동의 받은 계정 먼저: 확정 동의 → 상시 → 임시 → 사이트 신청 → 없음 → 철회 (인스타가 아닌 출처는 그 뒤, 원래 순서 유지)
        const rank = (i: typeof out[number]) => i.type === "instagram" ? consentRank(i.consent, site[instaHandle(i.value)]) : 9;
        return out.map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map(x => x.i);
    }, [items, filter, consentFilter, searchTerm, health, consentFirst, site]);

    const chips: { key: Filter; label: string }[] = [
        { key: "watch", label: `살펴볼 것 ${counts.watch || 0}` },
        { key: "webpage", label: `웹 ${counts.webpage || 0}` },
        { key: "naver_blog", label: `블로그 ${counts.naver_blog || 0}` },
        { key: "instagram", label: `인스타 ${counts.instagram || 0}` },
        { key: "all", label: `전체 ${items.length}` },
    ];

    return (
        <Box py={24}>
            <Container size="lg">
                <Group justify="space-between" mb="lg" wrap="wrap">
                    <Stack gap={0}>
                        <Title order={2} fw={900}>출처</Title>
                        <Text c="dimmed" size="sm">정기 실행(매일 08:20·15:00)이 읽는 곳입니다. «살펴볼 것»은 마지막 회차에서 실패했거나 발견 0건이 2회 이어진 곳입니다.</Text>
                    </Stack>
                    <Button leftSection={<Plus size={16} />} onClick={() => openModal()}>출처 추가</Button>
                </Group>

                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {chips.map(c => (
                        <button key={c.key} type="button" aria-pressed={filter === c.key} onClick={() => { setFilter(c.key); setShown(60); if (c.key !== "instagram" && c.key !== "all") setConsentFilter(""); }}
                            className={`h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold ${filter === c.key ? "bg-accent text-on-accent" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                            {c.label}
                        </button>
                    ))}
                </div>
                <Group mb="lg" wrap="wrap" gap="sm">
                    <TextInput placeholder="이름·주소로 찾기" leftSection={<Search size={16} />} value={searchTerm} onChange={(e) => { setSearchTerm(e.currentTarget.value); setShown(60); }} radius="xl" style={{ flex: "1 1 220px", maxWidth: 320 }} />
                    {(filter === "instagram" || filter === "all") && (
                        <Select aria-label="동의 단계로 거르기" placeholder="동의 단계 전체" clearable radius="xl" w={170}
                            data={(Object.keys(CONSENT_LABEL) as Consent[]).map(c => ({ value: c, label: CONSENT_LABEL[c] }))}
                            value={consentFilter || null} onChange={v => { setConsentFilter((v as Consent) || ""); setShown(60); }} />
                    )}
                    {(filter === "instagram" || filter === "all") && (
                        <button type="button" aria-pressed={consentFirst} onClick={() => { setConsentFirst(v => !v); setShown(60); }}
                            className={`h-9 rounded-full px-3.5 text-[13.5px] font-semibold ${consentFirst ? "bg-ink text-paper" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                            동의 받은 계정 먼저
                        </button>
                    )}
                </Group>

                {error && <Text c="red" size="sm" mb="md" role="alert">{error}</Text>}

                <Box pos="relative" mih={120}>
                    <LoadingOverlay visible={isLoading} />
                    {!isLoading && list.length === 0 && <Text c="dimmed" ta="center" py="xl">{filter === "watch" ? "살펴볼 출처가 없습니다." : "조건에 맞는 출처가 없습니다."}</Text>}
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {list.slice(0, shown).map((item) => {
                            const h = healthOf(health, item);
                            const run = h?.last;
                            const tone = run ? runStatusTone(run.status) : null;
                            return (
                                <Paper key={item.id} withBorder p="md" radius="md">
                                    <Stack gap="xs">
                                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                                            <Group gap={4}>
                                                <Badge variant="light" size="sm">{TYPE_LABEL[item.type] || item.type}</Badge>
                                                {item.role && ROLE_LABEL[item.role] && (
                                                    <Badge variant="light" size="sm" color={ROLE_LABEL[item.role].color}>{ROLE_LABEL[item.role].label}</Badge>
                                                )}
                                                {item.score != null && (
                                                    <Badge variant="filled" size="sm" color={item.score >= 80 ? "green" : item.score >= 60 ? "yellow" : "gray"}>{item.score}점</Badge>
                                                )}
                                                {item.type === "instagram" && site[instaHandle(item.value)] && (
                                                    <Tooltip label={SITE_CONSENT_HINT[site[instaHandle(item.value)].status]} multiline w={260}>
                                                        <Badge variant={site[instaHandle(item.value)].status === "confirmed" ? "filled" : "outline"} size="sm" color="green">{SITE_CONSENT_LABEL[site[instaHandle(item.value)].status]}</Badge>
                                                    </Tooltip>
                                                )}
                                                {item.type === "instagram" && item.consent !== "none" && (
                                                    <Tooltip label={`${CONSENT_HINT[item.consent]}${item.consent_at ? ` (${item.consent_at})` : ""}`} multiline w={260}>
                                                        <Badge variant={item.consent === "withdrawn" ? "default" : "filled"} size="sm" color="teal">{CONSENT_LABEL[item.consent]}</Badge>
                                                    </Tooltip>
                                                )}
                                                {item.paused_reason && <Badge variant="default" size="sm">쉬는 중</Badge>}
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
                                        {item.paused_reason && <Text size="xs" c="dimmed">쉬는 이유: {item.paused_reason}</Text>}
                                        {run && (
                                            <Text size="xs" c={tone === "bad" ? "red" : tone === "ok" ? "teal" : "dimmed"} mt={4}>
                                                마지막 실행 {runTime(run.run_at)} · {tone === "ok" ? `발견 ${run.found ?? 0}건(새 ${run.new ?? 0})` : (run.note || run.status || "기록 없음")}
                                                {run.expired_def ? " · 정의 만료 의심" : ""}
                                                {h && h.zeroStreak >= 2 ? ` · 발견 0건 ${h.zeroStreak}회 연속` : ""}
                                            </Text>
                                        )}
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </SimpleGrid>
                    {list.length > shown && (
                        <Group justify="center" mt="lg">
                            <Button variant="default" radius="xl" onClick={() => setShown(n => n + 60)}>더 보기 ({shown}/{list.length})</Button>
                        </Group>
                    )}
                </Box>
            </Container>

            <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "출처 고치기" : "출처 추가"}>
                <Stack>
                    <TextInput label="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <TextInput label="주소" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
                    <Select label="종류" data={TYPE_OPTIONS} value={form.type} onChange={(v) => setForm({ ...form, type: v || "webpage" })} allowDeselect={false} />
                    {form.type === "instagram" ? (
                        <>
                            <Select label="동의 단계" allowDeselect={false} description={CONSENT_HINT[form.consent]}
                                data={(Object.keys(CONSENT_LABEL) as Consent[]).map(c => ({ value: c, label: CONSENT_LABEL[c] }))}
                                value={form.consent} onChange={v => setForm({ ...form, consent: (v as Consent) || "none" })} />
                            {form.consent !== "none" && <TextInput label="동의 근거" placeholder="받은 댓글·DM 주소, 받은 날" value={form.consent_evidence} onChange={e => setForm({ ...form, consent_evidence: e.target.value })} maxLength={500} />}
                        </>
                    ) : (
                        <TextInput label="쉬게 함(이유)" placeholder="비워 두면 정기 실행이 읽습니다" value={form.paused_reason} onChange={e => setForm({ ...form, paused_reason: e.target.value })} maxLength={300}
                            description="이유를 적으면 다음 회차부터 건너뛰고 경고를 켜지 않습니다. 예: 누리집 개편 중, 행사 게시판 없음" />
                    )}
                    {form.type === "webpage" && !editingItem && <Text size="xs" c="dimmed">웹 출처는 정의 파일(collector/sources)이 있어야 읽힙니다. 주소만 넣으면 다음 회차에 «정의 파일 없음» 경고가 켜집니다.</Text>}
                    {saveError && <Text size="sm" c="red" role="alert">{saveError}</Text>}
                    <Button onClick={handleSave}>저장</Button>
                </Stack>
            </Modal>

            <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="출처 지우기" centered>
                <Stack>
                    <Text size="sm">«{deleting?.name || deleting?.value}»를 출처 목록에서 지웁니다. 되돌릴 수 없습니다. 이미 수집·공개된 행사는 그대로 남습니다. 잠시 멈추려면 지우지 말고 «쉬게 함»을 쓰세요.</Text>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setDeleting(null)}>취소</Button>
                        <Button color="red" onClick={handleDelete}>지우기</Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
