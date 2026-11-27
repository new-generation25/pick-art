"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, Textarea, TextInput, Radio, Anchor, Loader } from "@mantine/core";
import { supabase } from "@/lib/supabase";
import { appendOrgNote } from "@/lib/orgNotes";
import { todayKST } from "@/lib/utils";
import { APPLICANT_LABEL, STATUS_LABEL, orgNormName } from "@/lib/partnerAgreement";
import { agreementHandle, setSourceConsent } from "@/lib/siteConsent";
import { useAdmin } from "@/components/admin/AdminShell";

// 정식 협약 신청 검토 (specs/016). 관리자 RLS 로 읽고 고친다.
// «협약 확인»을 눌러야만 단체(orgs)에 partner_since 가 생긴다 — 신청만으로는 협약 표시를 하지 않는다(헌장 I).
// 운영자 2026-11-27 «협약신청 확인되면 상시동의로 전환»: 확인하면 그 인스타 계정의 출처 동의 단계를 상시로, 철회 처리하면 철회로 바꾼다.

/** 출처 동의 단계를 바꾼 결과를 운영자에게 보일 한 줄 */
async function switchConsent(a: { id: string; insta_handle: string | null; official_url: string; terms_version: string }, tier: "standing" | "withdrawn"): Promise<string> {
    const handle = agreementHandle(a);
    if (!handle) return "인스타그램 계정이 적혀 있지 않아 출처의 동의 단계는 바꾸지 않았습니다.";
    const evidence = tier === "standing" ? `사이트 협약 신청 ${a.id.slice(0, 8)} 확인(${a.terms_version})` : `사이트 협약 철회(신청 ${a.id.slice(0, 8)})`;
    const r = await setSourceConsent(handle, tier, evidence, todayKST());
    const word = tier === "standing" ? "상시 동의" : "철회";
    if (r.error) return `출처 @${handle} 의 동의 단계를 바꾸지 못했습니다: ${r.error}`;
    if (!r.changed) return `출처에 @${handle} 계정이 없어 동의 단계를 바꾸지 못했습니다. «출처»에 이 계정을 추가한 뒤 동의 단계를 «${word}»로 골라 주세요.`;
    return `출처 @${handle} 의 동의 단계를 «${word}»로 바꿨습니다.`;
}
type Agreement = {
    applicant_type: "person" | "org" | null;   // 개인/단체 구분(2026-11-28 부터 받음, 그 전 신청은 null)
    id: string; org_name: string; representative: string | null; reg_no: string | null; official_url: string;
    insta_handle: string | null; region: string | null; contact_private: string; contact_public: string | null;
    image_use: "yes" | "no"; extras: { monthly_report?: boolean; grant_alerts?: boolean; grant_profile?: string };
    terms_version: string; status: "new" | "confirmed" | "rejected" | "withdrawn"; org_id: string | null;
    admin_note: string | null; created_at: string; handled_at: string | null; withdraw_requested_at: string | null; user_id: string | null;
    orgs?: { name: string } | null;
};
type Org = { id: string; name: string; kind: string; insta_handle: string | null; partner_since: string | null };

const COLOR: Record<string, string> = { new: "red", confirmed: "teal", rejected: "gray", withdrawn: "dark" };
const NEW_ORG = "__new__";

function when(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const safeUrl = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);

/** 단체 찾기 + 고르기 + 협약 확인 */
function ConfirmBox({ a, note, onDone, onError }: { a: Agreement; note: string; onDone: (notice: string) => void; onError: (m: string) => void }) {
    const [q, setQ] = useState(a.org_name);
    const [found, setFound] = useState<Org[] | null>(null);
    const [pick, setPick] = useState<string>("");
    const [busy, setBusy] = useState(false);

    const search = useCallback(async (text: string) => {
        const t = text.trim().replace(/[%,()]/g, "");
        const ors = [t && `name.ilike.%${t}%`, `norm_name.eq.${orgNormName(text) || "-"}`, a.insta_handle && `insta_handle.eq.${a.insta_handle}`].filter(Boolean).join(",");
        const { data, error } = await supabase.from("orgs").select("id,name,kind,insta_handle,partner_since").or(ors).limit(8);
        if (error) { onError(error.message); return; }
        const list = (data || []) as Org[];
        setFound(list);
        const exact = list.find(o => (a.insta_handle && o.insta_handle === a.insta_handle) || orgNormName(o.name) === orgNormName(a.org_name));
        setPick(exact ? exact.id : list.length ? "" : NEW_ORG);
    }, [a.insta_handle, a.org_name, onError]);

    useEffect(() => { search(a.org_name); }, [search, a.org_name]);

    const confirm = async () => {
        if (!pick) return;
        setBusy(true);
        try {
            let orgId = pick;
            let org: Partial<Org> = {};
            if (pick === NEW_ORG) {
                const { data, error } = await supabase.from("orgs")
                    .insert({ name: a.org_name.trim(), norm_name: orgNormName(a.org_name), kind: a.applicant_type === "person" ? "개인" : "단체", insta_handle: a.insta_handle })
                    .select("id").single();
                if (error || !data) throw new Error(`단체 만들기 실패: ${error?.message || "권한"} (같은 이름·인스타 계정의 단체가 이미 있으면 검색해서 고르세요)`);
                orgId = data.id;
            } else {
                const { data } = await supabase.from("orgs").select("partner_since,insta_handle").eq("id", orgId).maybeSingle();
                org = data || {};
            }
            const today = todayKST();
            const patch: Record<string, unknown> = {};
            if (!org.partner_since) patch.partner_since = today;
            if (a.insta_handle && !org.insta_handle) patch.insta_handle = a.insta_handle;
            if (Object.keys(patch).length) {
                const o = await supabase.from("orgs").update(patch).eq("id", orgId).select("id");
                if (o.error || !o.data?.length) throw new Error(`단체 협약 표시 실패: ${o.error?.message || "권한"}`);
            }
            // 메모는 관리자만 읽는 표에 남긴다(orgs 는 누구나 읽는 표라 메모 칸을 두지 않는다, specs/019 A0)
            const noteErr = await appendOrgNote(orgId, `${today} 협약 신청 ${a.id.slice(0, 8)} 확인(${a.terms_version})`);
            if (noteErr) throw new Error(`단체 메모 저장 실패: ${noteErr}`);
            const r = await supabase.from("partner_agreements")
                .update({ status: "confirmed", org_id: orgId, handled_at: new Date().toISOString(), admin_note: note || a.admin_note })
                .eq("id", a.id).select("id");
            if (r.error || !r.data?.length) throw new Error(`신청 상태 저장 실패: ${r.error?.message || "권한"}`);
            onDone(`«${a.org_name}» 협약을 확인했습니다. ${await switchConsent(a, "standing")}`);
        } catch (e) {
            onError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Paper withBorder p="sm" mt="sm" radius="md" bg="gray.0">
            <Group gap="xs" align="flex-end">
                <TextInput size="xs" label="연결할 단체 찾기" value={q} onChange={e => setQ(e.currentTarget.value)} style={{ flex: 1 }} />
                <Button size="xs" variant="default" onClick={() => search(q)}>찾기</Button>
            </Group>
            {found === null ? <Loader size="xs" mt="xs" /> : (
                <Radio.Group value={pick} onChange={setPick} mt="xs">
                    <Stack gap={4}>
                        {found.map(o => (
                            <Radio key={o.id} value={o.id} label={
                                <span>{o.name} <Text span size="xs" c="dimmed">({o.kind}{o.insta_handle ? ` · @${o.insta_handle}` : ""}{o.partner_since ? ` · ${o.partner_since}부터 협약` : ""})</Text>
                                    {" "}<Anchor component={Link} href={`/orgs/${o.id}`} target="_blank" size="xs">페이지</Anchor></span>
                            } />
                        ))}
                        <Radio value={NEW_ORG} label={`새로 만들기(${a.applicant_type === "person" ? "개인" : "단체"}): «${a.org_name}»${a.insta_handle ? ` · @${a.insta_handle}` : ""}`} />
                    </Stack>
                </Radio.Group>
            )}
            <Button size="xs" color="teal" mt="sm" loading={busy} disabled={!pick} onClick={confirm}>협약 확인 (단체에 오늘부터 협약 표시 · 출처는 상시 동의로)</Button>
        </Paper>
    );
}

export default function AdminPartnersPage() {
    const [filter, setFilter] = useState<"todo" | "all">("todo");
    const [rows, setRows] = useState<Agreement[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [open, setOpen] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);   // 방금 한 처리의 결과(출처 동의 단계 포함)

    const load = useCallback(async () => {
        let q = supabase.from("partner_agreements").select("*, orgs(name)").order("created_at", { ascending: false }).limit(200);
        if (filter === "todo") q = q.or("status.eq.new,and(withdraw_requested_at.not.is.null,status.neq.withdrawn)");
        const { data, error } = await q;
        if (error) setError(error.message);
        setRows((data || []) as Agreement[]);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    // 처리한 뒤에는 목록과 함께 메뉴의 대기 숫자도 다시 읽는다 (운영자 2026-11-28 «협약이 완료되면 숫자1 지워져야 함»)
    const { reload: reloadCounts } = useAdmin();
    const refresh = useCallback(() => { load(); reloadCounts(); }, [load, reloadCounts]);

    const setStatus = async (a: Agreement, status: "rejected" | "new") => {
        const { data, error } = await supabase.from("partner_agreements")
            .update({ status, admin_note: notes[a.id] ?? a.admin_note, handled_at: status === "new" ? null : new Date().toISOString() })
            .eq("id", a.id).select("id");
        if (error || !data?.length) { setError(error?.message || "저장하지 못했습니다(권한 확인)"); return; }
        refresh();
    };

    /** 철회 처리: 신청은 withdrawn, 연결한 단체의 협약 표시를 푼다 */
    const withdraw = async (a: Agreement) => {
        if (!window.confirm(`«${a.org_name}» 협약을 철회 처리할까요? 연결한 단체의 협약 표시를 지웁니다. 단체 행사 정보 내리기는 따로 해야 합니다.`)) return;
        if (a.org_id) {
            const { data: org } = await supabase.from("orgs").select("partner_since").eq("id", a.org_id).maybeSingle();
            const o = await supabase.from("orgs").update({ partner_since: null }).eq("id", a.org_id).select("id");
            if (o.error || !o.data?.length) { setError(`단체 협약 표시 풀기 실패: ${o.error?.message || "권한"}`); return; }
            const noteErr = await appendOrgNote(a.org_id, `${org?.partner_since ? org.partner_since + "~" : ""}${todayKST()} 철회(신청 ${a.id.slice(0, 8)})`);
            if (noteErr) { setError(`단체 메모 저장 실패: ${noteErr}`); return; }
        }
        const { data, error } = await supabase.from("partner_agreements")
            .update({ status: "withdrawn", handled_at: new Date().toISOString(), admin_note: notes[a.id] ?? a.admin_note })
            .eq("id", a.id).select("id");
        if (error || !data?.length) { setError(error?.message || "저장하지 못했습니다(권한 확인)"); return; }
        setNotice(`«${a.org_name}» 협약을 철회 처리했습니다. ${await switchConsent(a, "withdrawn")}`);
        refresh();
    };

    return (
        <Container fluid px={0} pt={32} pb={80}>
            <Group justify="space-between" align="flex-end" mb="lg">
                <div>
                    <Title order={1} fw={900}>협약 신청</Title>
                    <Text c="dimmed" size="sm">
                        /partners 맨 아래 «동의하고 파트너십 맺기»에서 단체가 보낸 정보 제공 협약 신청. 공식 누리집·SNS로 단체를 확인한 뒤 단체(orgs)에 연결해 «협약 확인»합니다.
                        확인하면 그 인스타 계정의 출처 동의 단계가 «상시 동의»로 바뀌어, 다음 정기 실행부터 그 계정 게시물이 동의 받은 것으로 처리됩니다.
                        철회 요청은 7일 안에 «철회 처리»하고 단체 행사 정보를 내립니다(출처 동의 단계는 «철회»로 바뀝니다).
                    </Text>
                </div>
                <SegmentedControl value={filter} onChange={v => setFilter(v as "todo" | "all")} data={[{ label: "할 것", value: "todo" }, { label: "전체", value: "all" }]} />
            </Group>
            {error && <Text className="pica-err" mb="md">{error}</Text>}
            {notice && <p className="pica-info mb-4" role="status">{notice}</p>}
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? (
                <Text c="dimmed">{filter === "todo" ? "확인할 협약 신청이 없습니다." : "아직 협약 신청이 없습니다."}</Text>
            ) : (
                <Stack gap="md">
                    {rows.map(a => (
                        <Paper key={a.id} withBorder p="md" radius="md">
                            <Group justify="space-between" mb={6}>
                                <Group gap="xs">
                                    <Badge color={COLOR[a.status]} variant={a.status === "new" ? "filled" : "light"}>{STATUS_LABEL[a.status]}</Badge>
                                    {a.withdraw_requested_at && a.status !== "withdrawn" && <Badge color="orange" variant="filled">철회 요청 {when(a.withdraw_requested_at)}</Badge>}
                                    {a.applicant_type && <Badge variant="light" color={a.applicant_type === "person" ? "grape" : "blue"}>{APPLICANT_LABEL[a.applicant_type]}</Badge>}
                                    <Badge variant="outline" color="gray">{a.image_use === "yes" ? "이미지 사용 동의" : "이미지 비동의(글만)"}</Badge>
                                    <Badge variant="outline" color="gray" style={{ textTransform: "none" }}>{a.terms_version}</Badge>
                                    <Badge variant="outline" color="gray">{a.user_id ? "회원" : "로그인 없이"}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">{when(a.created_at)}{a.handled_at ? ` · 처리 ${when(a.handled_at)}` : ""}</Text>
                            </Group>
                            <Text fw={800} size="lg">{a.org_name}{a.region ? <Text span size="sm" c="dimmed"> · {a.region}</Text> : null}</Text>
                            <Stack gap={2} mt={4}>
                                {(a.representative || a.reg_no) && <Text size="sm">{[a.representative && `대표자 ${a.representative}`, a.reg_no && `고유번호 ${a.reg_no}`].filter(Boolean).join(" · ")}</Text>}
                                <Text size="sm">공식: {safeUrl(a.official_url) ? <Anchor href={safeUrl(a.official_url)!} target="_blank" size="sm">{a.official_url}</Anchor> : a.official_url}
                                    {a.insta_handle && <> · <Anchor href={`https://www.instagram.com/${a.insta_handle}/`} target="_blank" size="sm">@{a.insta_handle}</Anchor></>}</Text>
                                <Text size="sm">담당자 연락처(비공개): <b>{a.contact_private}</b>{a.contact_public ? ` · 공개 연락처: ${a.contact_public}` : ""}</Text>
                                {(a.extras?.monthly_report || a.extras?.grant_alerts) && (
                                    <Text size="sm" c="dimmed">선택: {[a.extras.monthly_report && "월간 정리 메일", a.extras.grant_alerts && `지원사업 알림${a.extras.grant_profile ? `(${a.extras.grant_profile})` : ""}`].filter(Boolean).join(" · ")}</Text>
                                )}
                                {a.org_id && <Text size="sm">연결한 단체: <Anchor component={Link} href={`/orgs/${a.org_id}`} target="_blank" size="sm">{a.orgs?.name || "단체 페이지"}</Anchor></Text>}
                            </Stack>
                            <Textarea
                                mt="sm" size="xs" autosize minRows={1} placeholder="처리 메모(관리자만 봄): 확인한 근거, 연락한 날 등"
                                value={notes[a.id] ?? a.admin_note ?? ""}
                                onChange={e => { const v = e.currentTarget.value; setNotes(n => ({ ...n, [a.id]: v })); }}
                            />
                            <Group gap="xs" mt="sm">
                                {a.status === "new" && <Button size="xs" color="teal" variant={open === a.id ? "light" : "filled"} onClick={() => setOpen(open === a.id ? null : a.id)}>협약 확인…</Button>}
                                {a.status === "new" && <Button size="xs" variant="default" onClick={() => setStatus(a, "rejected")}>반려</Button>}
                                {a.status === "rejected" && <Button size="xs" variant="subtle" onClick={() => setStatus(a, "new")}>다시 열기</Button>}
                                {(a.status === "confirmed" || (a.status === "new" && a.withdraw_requested_at)) && (
                                    <Button size="xs" color="orange" variant={a.withdraw_requested_at ? "filled" : "subtle"} onClick={() => withdraw(a)}>철회 처리</Button>
                                )}
                            </Group>
                            {open === a.id && a.status === "new" && (
                                <ConfirmBox a={a} note={notes[a.id] ?? ""} onError={setError} onDone={(m) => { setOpen(null); setNotice(m); refresh(); }} />
                            )}
                        </Paper>
                    ))}
                </Stack>
            )}
        </Container>
    );
}
