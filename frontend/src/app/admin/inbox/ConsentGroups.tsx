"use client";

// «동의 필요»를 계정별로 묶어 보여 준다 (specs/019 FR-016). 소규모 단체·예술인 게시물은 허락이 있어야 실린다.
//   임시 동의(그 행사 한 건): 그 글에서 «공개 후보로 옮기기»
//   상시 동의(앞으로의 소식까지): 계정의 동의 단계를 «상시»로 → 다음 정기 실행의 정리가 날짜 있는 글을 공개 후보로 옮긴다
// 동의 단계는 출처(whitelist)의 consent 칸에 남는다. 인스타 세션이 댓글·DM으로 받은 허락도 같은 칸에 적힌다.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { todayKST } from "@/lib/utils";
import { consentRank, fetchSiteConsents, SITE_CONSENT_HINT, SITE_CONSENT_LABEL, type SiteConsent } from "@/lib/siteConsent";
import { ReviewQueue, type ReviewChange, type ReviewPost } from "./ReviewQueue";

export type Consent = "none" | "temporary" | "standing" | "withdrawn";
export const CONSENT_LABEL: Record<Consent, string> = { none: "동의 없음", temporary: "임시 동의", standing: "상시 동의", withdrawn: "철회" };
export const CONSENT_HINT: Record<Consent, string> = {
    none: "허락을 받은 적이 없습니다.",
    temporary: "그 행사 한 건만 허락했습니다. 다른 글은 다시 물어야 합니다.",
    standing: "앞으로 올리는 소식까지 허락했습니다. 날짜 있는 글은 다음 정리에서 공개 후보로 갑니다.",
    withdrawn: "허락을 거뒀습니다. 다시 묻지 않고, 이 계정 글은 싣지 않습니다.",
};

type Source = { id: string; name: string | null; value: string; consent: Consent; consent_at: string | null; consent_evidence: string | null };

type Sort = "consent" | "dated" | "count" | "name";
const SORTS: { key: Sort; label: string }[] = [
    { key: "consent", label: "동의 받은 계정 먼저" },
    { key: "dated", label: "날짜 있는 글 많은 순" },
    { key: "count", label: "글 많은 순" },
    { key: "name", label: "계정 이름순" },
];

const accountOf = (p: ReviewPost) => (p.content?.ai_suggestion?.account || "").replace(/^@/, "").toLowerCase();
const handleOf = (value: string) => (value.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1] || "").toLowerCase();

function ConsentBox({ source, onSaved }: { source: Source; onSaved: (s: Source) => void }) {
    const [tier, setTier] = useState<Consent>(source.consent);
    const [evidence, setEvidence] = useState(source.consent_evidence || "");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const save = async () => {
        if (tier !== "none" && !evidence.trim()) { setMsg("근거(받은 댓글·DM 주소나 받은 날의 메모)를 적어 주세요."); return; }
        setBusy(true); setMsg("");
        const patch = { consent: tier, consent_at: tier === "none" ? null : todayKST(), consent_evidence: tier === "none" ? null : evidence.trim().slice(0, 500) };
        const { data, error } = await supabase.from("whitelist").update(patch).eq("id", source.id).select("id");
        setBusy(false);
        if (error || !data?.length) { setMsg(`저장하지 못했습니다: ${error?.message || "권한 확인"}`); return; }
        setMsg("저장했습니다.");
        onSaved({ ...source, ...patch });
    };

    return (
        <div className="mb-3 rounded-xl border border-dashed border-line px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">계정의 동의 단계</span>
                <select className="h-9 max-w-full rounded-lg border border-line bg-paper px-2 text-[14px] text-ink" value={tier} onChange={e => setTier(e.currentTarget.value as Consent)} aria-label="동의 단계">
                    {(Object.keys(CONSENT_LABEL) as Consent[]).map(c => <option key={c} value={c}>{CONSENT_LABEL[c]}</option>)}
                </select>
                <input className="h-9 min-w-0 flex-1 basis-[220px] rounded-lg border border-line bg-paper px-2 text-[14px] text-ink" placeholder="근거: 받은 댓글·DM 주소, 받은 날" value={evidence} onChange={e => setEvidence(e.currentTarget.value)} maxLength={500} aria-label="동의 근거" />
                <button type="button" disabled={busy || (tier === source.consent && evidence === (source.consent_evidence || ""))} onClick={save} className="h-9 rounded-full bg-accent px-3.5 text-[13.5px] font-bold text-on-accent disabled:opacity-40">저장</button>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-soft" role="status">
                {msg || CONSENT_HINT[tier]}{source.consent_at && tier === source.consent ? ` (${source.consent_at})` : ""}
            </p>
        </div>
    );
}

export function ConsentGroups({ posts, loading, onChanged, actor, onOpen }: { posts: ReviewPost[]; loading: boolean; onChanged: (changes: ReviewChange[]) => void; actor: string; onOpen?: (post: ReviewPost) => void }) {
    const [sources, setSources] = useState<Record<string, Source>>({});
    const [open, setOpen] = useState<string | null>(null);
    const [site, setSite] = useState<Record<string, SiteConsent>>({});   // 사이트에서 받은 동의(정식 협약)
    const [sort, setSort] = useState<Sort>("consent");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [{ data }, siteMap] = await Promise.all([
                supabase.from("whitelist").select("id,name,value,consent,consent_at,consent_evidence").eq("type", "instagram").limit(2000),
                fetchSiteConsents(),
            ]);
            if (cancelled) return;
            const map: Record<string, Source> = {};
            for (const r of (data || []) as Source[]) { const h = handleOf(r.value); if (h) map[h] = r; }
            setSources(map); setSite(siteMap);
        })();
        return () => { cancelled = true; };
    }, []);

    const groups = useMemo(() => {
        const by = new Map<string, ReviewPost[]>();
        for (const p of posts) { const a = accountOf(p) || "(계정 모름)"; by.set(a, [...(by.get(a) || []), p]); }
        const byDated = (x: { dated: number; list: ReviewPost[]; account: string }, y: typeof x) => y.dated - x.dated || y.list.length - x.list.length || x.account.localeCompare(y.account);
        const rank = (account: string) => consentRank(sources[account]?.consent, site[account]);
        return [...by.entries()].map(([account, list]) => ({ account, list, dated: list.filter(p => /^20\d\d-\d\d-\d\d$/.test(p.content?.ai_suggestion?.date_start || "")).length }))
            .sort((x, y) => sort === "consent" ? rank(x.account) - rank(y.account) || byDated(x, y)
                : sort === "count" ? y.list.length - x.list.length || x.account.localeCompare(y.account)
                    : sort === "name" ? x.account.localeCompare(y.account)
                        : byDated(x, y));
    }, [posts, sort, sources, site]);

    // 동의 단계별 계정 수(이 목록에 글이 있는 계정만)
    const tally = useMemo(() => {
        const t = { confirmed: 0, standing: 0, temporary: 0, applied: 0, none: 0, withdrawn: 0 };
        for (const g of groups) {
            const r = consentRank(sources[g.account]?.consent, site[g.account]);
            t[(["confirmed", "standing", "temporary", "applied", "none", "withdrawn"] as const)[r]]++;
        }
        return t;
    }, [groups, sources, site]);

    if (loading) return <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">불러오는 중…</p>;
    if (posts.length === 0) return <p className="py-10 text-center text-[15px] font-semibold text-ink-soft">동의를 기다리는 글이 없습니다.</p>;

    return (
        <div>
            <p className="px-1 text-[13px] text-ink-soft">
                소규모 단체·예술인 계정의 글 {posts.length}건, 계정 {groups.length}곳입니다. 허락을 받은 글만 «공개 후보로 옮기기»를 누르고, 앞으로의 소식까지 허락한 계정은 동의 단계를 «상시 동의»로 바꿉니다.
            </p>
            <p className="mt-1 px-1 text-[13px] text-ink">
                <b>확정 동의 {tally.confirmed}곳</b> · 상시 {tally.standing}곳 · 임시 {tally.temporary}곳 · 사이트 신청(확인 전) {tally.applied}곳 · 없음 {tally.none}곳{tally.withdrawn ? ` · 철회 ${tally.withdrawn}곳` : ""}
                <span className="ml-1.5 text-[12.5px] text-ink-soft">확정 동의 = 피카 사이트 협약 페이지에서 동의서를 보내고 운영자가 확인한 계정</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="정렬">
                <span className="px-1 text-[12.5px] font-semibold text-ink-soft">정렬</span>
                {SORTS.map(s => (
                    <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}
                        className={`h-8 rounded-full px-3 text-[13px] font-semibold ${sort === s.key ? "bg-ink text-paper" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                        {s.label}
                    </button>
                ))}
            </div>
            <div className="mt-3 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_4px_rgba(30,26,21,.08)]">
                {groups.map((g, i) => {
                    const src = sources[g.account];
                    const st = site[g.account];
                    const isOpen = open === g.account;
                    return (
                        <div key={g.account} className={i < groups.length - 1 ? "border-b border-line" : ""}>
                            <button type="button" onClick={() => setOpen(isOpen ? null : g.account)} aria-expanded={isOpen}
                                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-soft">
                                {isOpen ? <ChevronDown size={16} className="shrink-0 text-ink-soft" aria-hidden /> : <ChevronRight size={16} className="shrink-0 text-ink-soft" aria-hidden />}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold text-ink">@{g.account}{src?.name ? <span className="ml-1.5 text-[13px] font-medium text-ink-soft">{src.name}</span> : null}</span>
                                    <span className="block text-[12.5px] text-ink-soft">날짜 있는 글 {g.dated}건{g.list.length > g.dated ? ` · 날짜 없는 글 ${g.list.length - g.dated}건` : ""}</span>
                                </span>
                                {st && (
                                    <span title={SITE_CONSENT_HINT[st.status]} className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold ${st.status === "confirmed" ? "bg-accent text-on-accent" : "border border-accent text-accent"}`}>{SITE_CONSENT_LABEL[st.status]}</span>
                                )}
                                {src && src.consent !== "none" && (
                                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold ${src.consent === "withdrawn" ? "bg-soft text-ink-soft" : "bg-[var(--pk-accent-soft)] text-accent"}`}>{CONSENT_LABEL[src.consent]}</span>
                                )}
                                <span className="pica-num shrink-0 text-[17px] font-semibold text-accent">{g.list.length}</span>
                            </button>
                            {isOpen && (
                                <div className="bg-paper px-3 pb-2 pt-3">
                                    {st && (
                                        <p className="mb-2 rounded-xl bg-[var(--pk-accent-soft)] px-3 py-2 text-[13px] text-ink">
                                            <b>{SITE_CONSENT_LABEL[st.status]}</b> — {SITE_CONSENT_HINT[st.status]}{st.at ? ` (${st.at}, ${st.orgName})` : ` (${st.orgName})`}
                                        </p>
                                    )}
                                    {src
                                        ? <ConsentBox source={src} onSaved={s => setSources(m => ({ ...m, [g.account]: s }))} />
                                        : <p className="mb-3 px-1 text-[12.5px] text-ink-soft">이 계정은 출처 목록에 없어 동의 단계를 적을 수 없습니다. 글마다 «공개 후보로 옮기기»로 처리해 주세요.</p>}
                                    <ReviewQueue bucket="consent" posts={g.list} loading={false} onChanged={onChanged} compact actor={actor} onOpen={onOpen} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
