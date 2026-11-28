"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container, Title, Text, Paper, Group, Badge, Button, SegmentedControl, Stack, Textarea, TextInput, Radio, Anchor, Loader, Modal } from "@mantine/core";
import { opensDetail } from "@/app/admin/inbox/notes";
import { supabase } from "@/lib/supabase";
import { appendOrgNote } from "@/lib/orgNotes";
import { todayKST } from "@/lib/utils";
import { APPLICANT_LABEL, STATUS_LABEL, orgNormName } from "@/lib/partnerAgreement";
import { agreementHandle, instaHandle, setSourceConsent } from "@/lib/siteConsent";
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
    fields?: string[] | null;   // 활동 분야(선택, 2026-11-28 부터 받음)
    id: string; org_name: string; representative: string | null; reg_no: string | null; official_url: string;
    insta_handle: string | null; region: string | null; contact_private: string; contact_public: string | null;
    image_use: "yes" | "no"; extras: { monthly_report?: boolean; grant_alerts?: boolean; grant_profile?: string };
    terms_version: string; status: "new" | "confirmed" | "rejected" | "withdrawn"; org_id: string | null;
    admin_note: string | null; created_at: string; handled_at: string | null; withdraw_requested_at: string | null; user_id: string | null;
    orgs?: { name: string } | null;
};
type Org = { id: string; name: string; kind: string; insta_handle: string | null; partner_since: string | null };

// 인스타 댓글·DM 으로 받은 허락 (운영자 2026-11-28 «협약신청에 실제 협약 신청 외에, 댓글동의자 목록도 넣어»).
// 근거는 출처(whitelist)의 동의 단계·근거 문구다. 사이트 협약 신청으로 상시 동의가 된 계정은 위 신청 목록에 있으므로 뺀다.
// 운영자 기준(2026-11-28): «확정은 협약을 맺은 곳만 상시동의고, 댓글은 모두 임시동의» — 댓글·DM 허락은 늘 임시(그 행사 한 건).
type CommentConsent = { id: string; value: string; name: string | null; role: string | null; consent: "standing" | "temporary"; consent_at: string | null; consent_evidence: string | null };
const fromSiteAgreement = (ev: string | null) => /^사이트 협약/.test(ev || "");

function CommentConsents() {
    const [rows, setRows] = useState<CommentConsent[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        supabase.from("whitelist").select("id,value,name,role,consent,consent_at,consent_evidence")
            .in("consent", ["standing", "temporary"]).order("consent").order("consent_at", { ascending: false }).limit(500)
            .then(({ data, error }) => {
                if (error) { setError(error.message); setRows([]); return; }
                setRows(((data || []) as CommentConsent[]).filter(r => !fromSiteAgreement(r.consent_evidence)));
            });
    }, []);
    const standing = rows?.filter(r => r.consent === "standing").length ?? 0;
    return (
        <section aria-labelledby="comment-consents" className="mt-12">
            <Title order={2} size="h3" id="comment-consents">댓글로 받은 허락 {rows && <span className="pica-num text-accent">{rows.length}</span>}</Title>
            <Text c="dimmed" size="sm" mt={4} mb="md">
                정식 협약 신청이 아니라, 피카 인스타 계정이 단 허락 댓글·DM에 답한 계정입니다. 댓글·DM 허락은 모두 «임시»(그 행사 한 건만)이고, 앞으로의 소식까지 싣는 «상시»는 위의 협약 신청을 확인한 곳만입니다.
                단계를 바꾸려면 <Anchor component={Link} href="/admin/sources" size="sm">출처</Anchor>에서 그 계정의 동의 단계를 고릅니다.
            </Text>
            {error && <Text className="pica-err" mb="md">{error}</Text>}
            {rows === null ? <Loader size="sm" /> : rows.length === 0 ? <p className="pica-empty">댓글로 받은 허락이 없습니다.</p> : (
                <div className="overflow-x-auto rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
                        <thead>
                            <tr className="border-b border-line text-[12.5px] text-ink-soft">
                                <th className="px-4 py-2.5 font-semibold">계정</th>
                                <th className="px-3 py-2.5 font-semibold">동의 단계</th>
                                <th className="px-3 py-2.5 font-semibold">날짜</th>
                                <th className="px-4 py-2.5 font-semibold">근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const h = instaHandle(r.value);
                                const off = r.consent === "standing";
                                return (
                                    <tr key={r.id} className={i < rows.length - 1 ? "border-b border-line" : ""}>
                                        <td className="px-4 py-2.5 align-top">
                                            <a href={`https://www.instagram.com/${h}/`} target="_blank" rel="noopener noreferrer" className="pica-ig">@{h}</a>
                                            {r.name && <span className="block text-[12.5px] text-ink-soft">{r.name}{r.role === "artist" ? " · 작가" : r.role === "group" ? " · 단체" : ""}</span>}
                                        </td>
                                        <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ minWidth: 150 }}>
                                            <Badge variant="light" color={r.consent === "standing" ? "teal" : "gray"} style={{ maxWidth: "none", overflow: "visible" }}>{r.consent === "standing" ? "상시" : "임시 · 그 행사 한 건"}</Badge>
                                            {off && <span className="mt-1 block text-[12px] font-semibold text-[#9a4b12]">기준과 다름 — 댓글 허락은 임시, 상시는 협약만</span>}
                                        </td>
                                        <td className="px-3 py-2.5 align-top whitespace-nowrap pica-num">{r.consent_at || "—"}</td>
                                        <td className="px-4 py-2.5 align-top text-ink-soft" style={{ overflowWrap: "anywhere" }}>{r.consent_evidence || "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {rows && rows.length > 0 && <Text size="xs" c="dimmed" mt="xs">임시 {rows.length - standing}곳{standing > 0 ? ` · 기준과 다른 상시 ${standing}곳` : ""}. 답글 원문과 게시물 주소는 아직 DB에 없어 여기 보이지 않습니다.</Text>}
        </section>
    );
}

const COLOR: Record<string, string> = { new: "red", confirmed: "teal", rejected: "gray", withdrawn: "dark" };
const NEW_ORG = "__new__";

function when(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const safeUrl = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);

/** 신청 상태·구분 배지 묶음 — 목록 카드와 자세히 보기 창이 같이 쓴다 */
function StatusBadges({ a }: { a: Agreement }) {
    return (
        <Group gap="xs" wrap="wrap">
            <Badge color={COLOR[a.status]} variant={a.status === "new" ? "filled" : "light"}>{STATUS_LABEL[a.status]}</Badge>
            {a.withdraw_requested_at && a.status !== "withdrawn" && <Badge color="orange" variant="filled">철회 요청 {when(a.withdraw_requested_at)}</Badge>}
            {a.applicant_type && <Badge variant="light" color={a.applicant_type === "person" ? "grape" : "blue"}>{APPLICANT_LABEL[a.applicant_type]}</Badge>}
            <Badge variant="outline" color="gray">{a.image_use === "yes" ? "이미지 사용 동의" : "이미지 비동의(글만)"}</Badge>
            <Badge variant="outline" color="gray" style={{ textTransform: "none" }}>{a.terms_version}</Badge>
            <Badge variant="outline" color="gray">{a.user_id ? "회원" : "로그인 없이"}</Badge>
        </Group>
    );
}

/** 단체 찾기 + 고르기 + 협약 확인 */
function ConfirmBox({ a, note, onDone, onError }: { a: Agreement; note: string; onDone: (notice: string) => void; onError: (m: string) => void }) {
    const ih = agreementHandle(a);   // 계정 칸이 비어도 공식 주소(instagram.com/@계정 포함)에서 읽은 계정
    const [q, setQ] = useState(a.org_name);
    const [found, setFound] = useState<Org[] | null>(null);
    const [pick, setPick] = useState<string>("");
    const [busy, setBusy] = useState(false);

    const search = useCallback(async (text: string) => {
        const t = text.trim().replace(/[%,()]/g, "");
        const ors = [t && `name.ilike.%${t}%`, `norm_name.eq.${orgNormName(text) || "-"}`, ih && `insta_handle.eq.${ih}`].filter(Boolean).join(",");
        const { data, error } = await supabase.from("orgs").select("id,name,kind,insta_handle,partner_since").or(ors).limit(8);
        if (error) { onError(error.message); return; }
        const list = (data || []) as Org[];
        setFound(list);
        const exact = list.find(o => (ih && o.insta_handle === ih) || orgNormName(o.name) === orgNormName(a.org_name));
        setPick(exact ? exact.id : list.length ? "" : NEW_ORG);
    }, [ih, a.org_name, onError]);

    useEffect(() => { search(a.org_name); }, [search, a.org_name]);

    const confirm = async () => {
        if (!pick) return;
        setBusy(true);
        try {
            let orgId = pick;
            let org: Partial<Org> = {};
            if (pick === NEW_ORG) {
                const { data, error } = await supabase.from("orgs")
                    .insert({ name: a.org_name.trim(), norm_name: orgNormName(a.org_name), kind: a.applicant_type === "person" ? "개인" : "단체", insta_handle: agreementHandle(a) })
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
            // 계정 칸이 비어도 공식 주소(instagram.com/@계정 포함)에서 읽은 계정을 단체에 붙인다
            const handle = agreementHandle(a);
            if (handle && !org.insta_handle) patch.insta_handle = handle;
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
                        <Radio value={NEW_ORG} label={`새로 만들기(${a.applicant_type === "person" ? "개인" : "단체"}): «${a.org_name}»${ih ? ` · @${ih}` : ""}`} />
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
    const [detailId, setDetailId] = useState<string | null>(null);   // 자세히 보기 창에 띄운 신청
    const detail = rows?.find(r => r.id === detailId) || null;

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
                    {/* 목록은 요약 카드: 누르면 자세히 보기 창에서 신청 내용 전부를 보고 처리한다 (운영자 2026-11-28 «클릭하면 카드형태로 자세히 볼수 있어야 하는데. 클릭이 안됨») */}
                    {rows.map(a => (
                        <Paper key={a.id} withBorder p="md" radius="md" style={{ cursor: "pointer" }}
                            onClick={e => { if (opensDetail(e)) setDetailId(a.id); }}>
                            <Group justify="space-between" mb={6} wrap="wrap">
                                <StatusBadges a={a} />
                                <Text size="xs" c="dimmed">{when(a.created_at)}{a.handled_at ? ` · 처리 ${when(a.handled_at)}` : ""}</Text>
                            </Group>
                            <Text fw={800} size="lg">
                                <button type="button" onClick={() => setDetailId(a.id)} style={{ all: "unset", cursor: "pointer" }} aria-label={`${a.org_name} 협약 신청 자세히 보기`}>{a.org_name}</button>
                                {a.region ? <Text span size="sm" c="dimmed"> · {a.region}</Text> : null}
                            </Text>
                            <Text size="sm" mt={4} style={{ overflowWrap: "anywhere" }}>
                                공식: {safeUrl(a.official_url) ? <Anchor href={safeUrl(a.official_url)!} target="_blank" size="sm">{a.official_url}</Anchor> : a.official_url}
                                {agreementHandle(a) && <> · <Anchor href={`https://www.instagram.com/${agreementHandle(a)}/`} target="_blank" size="sm">@{agreementHandle(a)}</Anchor></>}
                            </Text>
                            <Group gap="xs" mt="sm">
                                <Button size="xs" radius="xl" color="teal" variant={a.status === "new" || a.withdraw_requested_at ? "filled" : "light"} onClick={() => setDetailId(a.id)}>
                                    {a.status === "new" ? "자세히 보고 처리하기" : "자세히 보기"}
                                </Button>
                                {a.admin_note && <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>메모: {a.admin_note}</Text>}
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            )}
            <Modal opened={!!detail} onClose={() => { setDetailId(null); setOpen(null); }} size="lg" centered
                title={<span className="text-[13px] font-semibold text-ink-soft">협약 신청 자세히 보기</span>} classNames={{ content: "pica-portal" }}>
                {detail && (() => {
                    const a = detail;
                    const rowsOf: [string, React.ReactNode][] = [
                        ["신청한 쪽", `${a.applicant_type ? APPLICANT_LABEL[a.applicant_type] : "구분 없음(11/28 이전 신청)"} · ${a.user_id ? "회원으로 보냄" : "로그인 없이 보냄"}`],
                        ["이름", a.org_name],
                        ["지역", a.region || "—"],
                        ["활동 분야", a.fields?.length ? a.fields.join(" · ") : "고르지 않음"],
                        ["대표자", a.representative || "—"],
                        ["고유번호", a.reg_no || "—"],
                        ["공식 누리집·SNS", safeUrl(a.official_url) ? <Anchor href={safeUrl(a.official_url)!} target="_blank" size="sm" style={{ overflowWrap: "anywhere" }}>{a.official_url}</Anchor> : a.official_url],
                        ["인스타그램", agreementHandle(a) ? <Anchor href={`https://www.instagram.com/${agreementHandle(a)}/`} target="_blank" size="sm">@{agreementHandle(a)}</Anchor> : "—"],
                        ["담당자 연락처(비공개)", <b key="c">{a.contact_private}</b>],
                        ["공개 연락처", a.contact_public || "—"],
                        ["이미지 사용", a.image_use === "yes" ? "포스터·사진 사용 동의" : "이미지 비동의(글만)"],
                        ["선택 항목", [a.extras?.monthly_report && "월간 정리 메일", a.extras?.grant_alerts && `지원사업 알림${a.extras.grant_profile ? `(${a.extras.grant_profile})` : ""}`].filter(Boolean).join(" · ") || "—"],
                        ["약관", a.terms_version],
                        ["신청", `${when(a.created_at)} · 번호 ${a.id.slice(0, 8)}`],
                        ["처리", a.handled_at ? `${STATUS_LABEL[a.status]} ${when(a.handled_at)}` : "아직 처리 전"],
                        ...(a.withdraw_requested_at ? [["철회 요청", when(a.withdraw_requested_at)] as [string, React.ReactNode]] : []),
                        ["연결한 단체", a.org_id ? <Anchor key="o" component={Link} href={`/orgs/${a.org_id}`} target="_blank" size="sm">{a.orgs?.name || "단체 페이지"}</Anchor> : "—"],
                    ];
                    return (
                        <Stack gap="sm">
                            <StatusBadges a={a} />
                            <dl className="m-0 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
                                {rowsOf.map(([k, v]) => (
                                    <div key={k} className="contents">
                                        <dt className="text-[12.5px] font-semibold text-ink-soft">{k}</dt>
                                        <dd className="m-0 text-ink" style={{ overflowWrap: "anywhere" }}>{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            <Textarea
                                size="xs" autosize minRows={2} label="처리 메모(관리자만 봄)" placeholder="확인한 근거, 연락한 날 등"
                                value={notes[a.id] ?? a.admin_note ?? ""}
                                onChange={e => { const v = e.currentTarget.value; setNotes(n => ({ ...n, [a.id]: v })); }}
                            />
                            <Group gap="xs">
                                {a.status === "new" && <Button size="xs" radius="xl" color="teal" variant={open === a.id ? "light" : "filled"} onClick={() => setOpen(open === a.id ? null : a.id)}>협약 확인…</Button>}
                                {a.status === "new" && <Button size="xs" radius="xl" variant="default" onClick={() => setStatus(a, "rejected")}>반려</Button>}
                                {a.status === "rejected" && <Button size="xs" radius="xl" variant="subtle" onClick={() => setStatus(a, "new")}>다시 열기</Button>}
                                {(a.status === "confirmed" || (a.status === "new" && a.withdraw_requested_at)) && (
                                    <Button size="xs" radius="xl" color="orange" variant={a.withdraw_requested_at ? "filled" : "subtle"} onClick={() => withdraw(a)}>철회 처리</Button>
                                )}
                            </Group>
                            {open === a.id && a.status === "new" && (
                                <ConfirmBox a={a} note={notes[a.id] ?? ""} onError={setError} onDone={(m) => { setOpen(null); setDetailId(null); setNotice(m); refresh(); }} />
                            )}
                        </Stack>
                    );
                })()}
            </Modal>
            <CommentConsents />
        </Container>
    );
}
