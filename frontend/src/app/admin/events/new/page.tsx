"use client";

// 행사 › 새 행사 (specs/019 A4). 수집되지 않은 행사를 운영자가 직접 넣는다. 칸은 공통 양식(EventFields)이다.
// 제보(/admin/reports)에서 넘어오면 제보에 적힌 제목·날짜·장소·주소가 채워져 열린다(?title=&start=&end=&venue=&region=&url=&report=).
// 헌장 I: 원본에서 확인한 내용만 넣는다. 원본 안내 주소가 없으면 다른 사람이 확인할 길이 없으므로 주소를 꼭 받는다.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Checkbox, FileInput, Group, Stack, Text, TextInput } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS, regionFromText } from "@/lib/regions";
import { EMPTY_EVENT, EventFields, checkEvent, eventColumns, type EventDraft } from "@/components/admin/EventFields";

const ISO = /^20\d\d-\d\d-\d\d$/;

export default function NewEventPage() {
    return <Suspense fallback={null}><NewEvent /></Suspense>;
}

function NewEvent() {
    const router = useRouter();
    const sp = useSearchParams();
    const reportId = sp.get("report");
    const [draft, setDraft] = useState<EventDraft>(() => {
        const region = sp.get("region") || "";
        return {
            ...EMPTY_EVENT,
            title: sp.get("title") || "",
            venue: sp.get("venue") || "",
            region: (GN_REGIONS as readonly string[]).includes(region) ? region : (regionFromText(region) || regionFromText(sp.get("venue")) || ""),
            date_start: ISO.test(sp.get("start") || "") ? sp.get("start")! : "",
            date_end: ISO.test(sp.get("end") || "") ? sp.get("end")! : "",
            original_url: /^https?:\/\//.test(sp.get("url") || "") ? sp.get("url")! : "",
        };
    });
    const [posterUrl, setPosterUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [doneId, setDoneId] = useState<string | null>(null);
    // 제보자가 «제보: ○○»로 보여도 된다고 적은 이름(specs/020). 켜 둔 채 저장하면 행사 화면에 보인다
    const [credit, setCredit] = useState("");
    const [showCredit, setShowCredit] = useState(true);

    useEffect(() => {
        if (!reportId) return;
        supabase.from("reports").select("credit_name").eq("id", reportId).maybeSingle()
            .then(({ data }) => setCredit(((data as { credit_name?: string | null } | null)?.credit_name || "").trim()));
    }, [reportId]);

    const save = async () => {
        const bad = checkEvent(draft);
        if (!draft.original_url.trim()) bad.push("원본 안내 주소");
        if (bad.length) { setMsg(`${bad.join(" · ")}을(를) 채워 주세요.`); return; }
        if (posterUrl && !/^https?:\/\//.test(posterUrl)) { setMsg("포스터 주소는 http로 시작해야 합니다."); return; }
        setBusy(true); setMsg("");
        let poster = posterUrl.trim();
        if (file) {
            const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
            const path = `event-posters/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const up = await supabase.storage.from("event-images").upload(path, file);
            if (up.error) { setBusy(false); setMsg(`포스터를 올리지 못했습니다: ${up.error.message}`); return; }
            poster = supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
        }
        const { data, error } = await supabase.from("events").insert({
            ...eventColumns(draft),
            poster_image_url: poster || null,
            source: "manual", status: "PUBLISHED", published_at: new Date().toISOString(),
            ...(credit && showCredit ? { tip_credit: credit } : {}),
            ...(draft.subcategory ? { subcategory_by: "admin", subcategory_pending: false, subcategory_evidence: "운영자 확정" } : {}),
        }).select("id").single();
        if (error || !data) { setBusy(false); setMsg(`저장하지 못했습니다: ${error?.message || "권한 확인"}`); return; }
        // 제보에서 넘어왔으면 그 제보를 «반영함»으로 닫고, 등록한 행사를 event_id 칸으로 잇는다(주간 쿠폰 집계가 이 칸을 본다, specs/020)
        if (reportId) {
            await supabase.from("reports").update({ status: "done", handled_at: new Date().toISOString(), event_id: data.id, admin_note: `행사로 등록 ${data.id.slice(0, 8)}` }).eq("id", reportId).eq("status", "new");
        }
        setBusy(false);
        setDoneId(data.id);
    };

    if (doneId) {
        return (
            <div className="max-w-2xl pt-6">
                <h1 className="pica-display text-[25px] text-ink">등록했습니다</h1>
                <p className="mt-2 text-[14.5px] text-ink">공개 화면에는 몇 분 안에 나옵니다.{reportId ? " 넘어온 제보는 «반영함»으로 닫았습니다." : ""}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`/events/${doneId}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-bold text-on-accent no-underline">행사 보기</a>
                    <button type="button" onClick={() => { setDoneId(null); setDraft(EMPTY_EVENT); setPosterUrl(""); setFile(null); setCredit(""); router.replace("/admin/events/new"); }} className="h-10 rounded-full border border-line bg-card px-4 text-[14px] font-semibold text-ink">하나 더 넣기</button>
                    <Link href="/admin/events" className="flex h-10 items-center rounded-full border border-line bg-card px-4 text-[14px] font-semibold text-ink no-underline">행사 목록</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl pt-4">
            <h1 className="pica-display text-[25px] leading-tight text-ink">새 행사</h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">
                수집되지 않은 행사를 직접 넣습니다. 원본 안내에서 확인한 내용만 적고, 모르는 칸은 비워 둡니다.
                {reportId && " 제보에 적힌 내용을 채워 두었습니다 — 원본 주소를 열어 확인한 뒤 저장해 주세요."}
            </p>
            <div className="mt-4 rounded-[14px] bg-card p-4 shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                <Stack gap="sm">
                    <EventFields value={draft} onChange={setDraft} urlNote="공식 안내·예매 페이지 주소. 꼭 넣어 주세요." />
                    <FileInput label="포스터 파일" placeholder="공식 포스터 파일 고르기(없어도 됨)" accept="image/*" value={file} onChange={setFile} clearable
                        description="공식 출처의 포스터만. 현장 사진·휴대폰으로 찍은 사진은 쓰지 않습니다." />
                    {!file && <TextInput label="또는 포스터 그림 주소" value={posterUrl} onChange={e => setPosterUrl(e.currentTarget.value)} placeholder="https://" />}
                    {credit && (
                        <Checkbox checked={showCredit} onChange={e => setShowCredit(e.currentTarget.checked)}
                            label={`행사 화면에 «제보: ${credit}» 보이기`} description="제보한 분이 이름을 남겼습니다. 끄면 이름이 나오지 않습니다." />
                    )}
                    {msg && <Text size="sm" className="pica-err" role="alert">{msg}</Text>}
                    <Group justify="flex-end">
                        <Button component={Link} href="/admin/events" variant="default">취소</Button>
                        <Button loading={busy} onClick={save}>공개로 등록</Button>
                    </Group>
                </Stack>
            </div>
        </div>
    );
}
