"use client";

import { Checkbox, Group, Select, Stack, TextInput, Textarea, Anchor } from "@mantine/core";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/categories";

/**
 * 행사 칸 하나로 (specs/019 FR-019). 새 행사·고치기·리플렛 등록이 같이 쓴다.
 * 칸과 목록(경남 18 시군 + 부산, 분야 5개와 세부 갈래)을 한 곳에 두어 화면마다 달라지지 않게 한다.
 * 저장 규칙(출처 표시·포스터·상태)은 부르는 쪽이 맡는다.
 */
export type EventDraft = {
    title: string;
    category: string;
    subcategory: string;
    region: string;
    venue: string;
    date_start: string;
    date_end: string;
    price_info: string;
    is_free: boolean;
    original_url: string;
    description: string;
};

export const EMPTY_EVENT: EventDraft = {
    title: "", category: "", subcategory: "", region: "", venue: "", date_start: "", date_end: "",
    price_info: "", is_free: false, original_url: "", description: "",
};

const ISO = /^20\d\d-\d\d-\d\d$/;

/** 빠진 칸·잘못된 값의 이름들. 비어 있으면 저장해도 된다 */
export function checkEvent(d: EventDraft): string[] {
    const bad: string[] = [];
    if (!d.title.trim()) bad.push("제목");
    if (!d.category) bad.push("분야");
    if (!d.region) bad.push("지역");
    if (!ISO.test(d.date_start)) bad.push("시작일");
    if (d.date_end && !ISO.test(d.date_end)) bad.push("끝나는 날");
    if (ISO.test(d.date_start) && ISO.test(d.date_end) && d.date_end < d.date_start) bad.push("끝나는 날(시작일보다 앞)");
    if (d.original_url && !/^https?:\/\//.test(d.original_url)) bad.push("원본 주소(http로 시작)");
    return bad;
}

/** DB(events) 줄에 넣을 값. 끝나는 날이 비면 시작일과 같게 한다 */
export function eventColumns(d: EventDraft) {
    return {
        title: d.title.trim(),
        category: d.category,
        subcategory: d.subcategory || null,
        region: d.region,
        venue: d.venue.trim() || null,
        event_date_start: d.date_start,
        event_date_end: d.date_end || d.date_start,
        price_info: d.price_info.trim() || null,
        is_free: d.is_free,
        original_url: d.original_url.trim() || null,
        description: d.description.trim() || null,
    };
}

export function EventFields({ value, onChange, urlNote, descriptionLabel = "상세 안내" }: {
    value: EventDraft;
    onChange: (next: EventDraft) => void;
    urlNote?: string;
    descriptionLabel?: string;
}) {
    const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => onChange({ ...value, [k]: v });
    const subs = SUBCATEGORIES[value.category] || [];
    return (
        <Stack gap={8}>
            <TextInput label="제목" value={value.title} onChange={e => set("title", e.currentTarget.value)} required />
            <Group grow align="flex-start">
                <Select label="분야" data={CATEGORIES} value={value.category || null} allowDeselect={false} required
                    onChange={x => onChange({ ...value, category: x ?? "", subcategory: "" })} />
                <Select label="세부 갈래" data={subs} value={value.subcategory || null} onChange={x => set("subcategory", x ?? "")} disabled={!subs.length} clearable placeholder={subs.length ? "고르기(없어도 됨)" : "분야를 먼저"} />
            </Group>
            <Group grow align="flex-start">
                <Select label="지역" data={[...GN_REGIONS]} value={value.region || null} onChange={x => set("region", x ?? "")} searchable required />
                <TextInput label="장소" value={value.venue} onChange={e => set("venue", e.currentTarget.value)} />
            </Group>
            <Group grow align="flex-start">
                <TextInput label="시작일" type="date" value={value.date_start} onChange={e => set("date_start", e.currentTarget.value)} required />
                <TextInput label="끝나는 날" type="date" value={value.date_end} min={value.date_start || undefined} onChange={e => set("date_end", e.currentTarget.value)} description="비우면 시작일과 같게" />
            </Group>
            <Group align="flex-end" wrap="wrap">
                <TextInput label="관람료" value={value.price_info} onChange={e => set("price_info", e.currentTarget.value)} style={{ flex: "1 1 200px" }} placeholder="예: 전석 20,000원" />
                <Checkbox label="무료" checked={value.is_free} onChange={e => set("is_free", e.currentTarget.checked)} mb={8} />
            </Group>
            <TextInput label="원본 안내 주소" value={value.original_url} onChange={e => set("original_url", e.currentTarget.value)} placeholder="https://"
                description={urlNote}
                rightSection={/^https?:\/\//.test(value.original_url) ? <Anchor href={value.original_url} target="_blank" rel="noopener noreferrer" size="xs">열기</Anchor> : null} rightSectionWidth={44} />
            <Textarea label={descriptionLabel} value={value.description} autosize minRows={2} maxRows={10} onChange={e => set("description", e.currentTarget.value)} />
        </Stack>
    );
}
