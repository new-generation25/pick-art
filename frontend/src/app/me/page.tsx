"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CalendarPlus, ChevronRight, Info, Mail, MapPin, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/site";
import { todayKST } from "@/lib/utils";
import { loginHref } from "@/lib/reports";
import { ShelfTile, type ShelfCard } from "@/components/ui/Shelf";

type Profile = {
    nickname: string; phone: string; region: string; interests: string[];
    email_notifications: boolean; new_event_notifications: boolean; auto_region: boolean;
};

/**
 * 내 정보 (specs/014 US6, 시안 f01): 프로필 · 찜한 행사 · 내 지역 · 관심 분야 · 캘린더 · 알림 · 안내 · 계정.
 * 예전 /saved · /settings 의 기능을 한 화면에 모았다. 저장하는 칸(profiles·favorites)은 예전과 같고, 바꾸면 바로 저장한다.
 */
export default function MePage() {
    const router = useRouter();
    const [state, setState] = useState<"loading" | "login" | "ready">("loading");
    const [user, setUser] = useState<any>(null);
    const [p, setP] = useState<Profile | null>(null);
    const [saved, setSaved] = useState<ShelfCard[]>([]);
    const [editing, setEditing] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setState("login"); return; }
            setUser(session.user);
            const [{ data: profile }, { data: favs }] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
                supabase.from("favorites")
                    .select("created_at, events(id,title,category,event_date_start,event_date_end,venue,region,poster_image_url,poster_placeholder,source,is_free,status)")
                    .order("created_at", { ascending: false }),
            ]);
            setP({
                nickname: profile?.nickname || `픽아트회원${session.user.id.slice(0, 4)}`,
                phone: profile?.phone || "",
                region: profile?.region || "",
                interests: profile?.interests || [],
                email_notifications: profile?.email_notifications ?? true,
                new_event_notifications: profile?.new_event_notifications ?? true,
                auto_region: profile?.auto_region ?? true,
            });
            const today = todayKST();
            const rows = (favs || []).map((f: any) => f.events).filter((e: any) => e && e.status === "PUBLISHED");
            const ended = (e: any) => (e.event_date_end || e.event_date_start || today) < today;
            rows.sort((a: any, b: any) => Number(ended(a)) - Number(ended(b)) || (a.event_date_start || "").localeCompare(b.event_date_start || ""));
            setSaved(rows.map((e: any) => ({
                id: e.id, title: e.title, category: e.category, start: e.event_date_start, end: e.event_date_end,
                venue: e.venue || e.region, imageUrl: e.poster_image_url, posterPlaceholder: e.poster_placeholder, source: e.source,
                price: e.is_free ? "무료" : null, isEnded: ended(e),
            })));
            setState("ready");
            // 예전 주소(/saved → #saved, /settings → #settings)로 왔으면 그 칸으로
            if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 50);
        })();
    }, []);

    const save = async (patch: Partial<Profile>) => {
        if (!user || !p) return;
        const next = { ...p, ...patch };
        setP(next);
        const { error } = await supabase.from("profiles").upsert({ id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "id" });
        setMsg(error ? `저장하지 못했습니다: ${error.message}` : "저장했습니다");
        setTimeout(() => setMsg(""), 2500);
    };
    const logout = async () => { await supabase.auth.signOut(); router.push("/"); };

    if (state === "loading") return <main className="min-h-screen" />;
    if (state === "login") {
        return (
            <main className="mx-auto min-h-screen max-w-xl px-4 pt-6">
                <h1 className="pica-display text-[24px] text-ink">내 정보</h1>
                <p className="mt-3 text-[15px] text-ink-soft">로그인하면 찜한 행사, 내 지역, 관심 분야, 알림을 한곳에서 관리할 수 있어요.</p>
                <Link href={loginHref("/me")} className="mt-4 inline-flex h-12 items-center rounded-xl bg-accent px-6 text-[15px] font-bold text-on-accent">로그인</Link>
                <p className="mt-6 text-[14px]"><Link href="/calendar" className="underline">로그인 없이 캘린더로 받기</Link></p>
            </main>
        );
    }

    const ics = `${SITE_URL}/calendar.ics?${new URLSearchParams({ ...(p!.region && GN_REGIONS.includes(p!.region) ? { region: p!.region } : {}), ...(p!.interests.length === 1 ? { category: p!.interests[0] } : {}) })}`.replace(/\?$/, "");
    const webcal = ics.replace(/^https?:\/\//, "webcal://");
    const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
            className={`relative h-7 w-[46px] flex-none rounded-full transition-colors ${on ? "bg-accent" : "bg-[#D6CDBE]"}`}>
            <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${on ? "left-[21px]" : "left-[3px]"}`} />
        </button>
    );
    const Line = ({ icon: Icon, title, sub, right }: { icon: typeof Bell; title: string; sub?: string; right?: React.ReactNode }) => (
        <div className="flex min-h-14 items-center gap-3 border-b border-line py-2 text-[15px] last:border-b-0">
            <Icon className="h-5 w-5 flex-none text-ink-soft" aria-hidden />
            <span className="min-w-0 flex-1"><b className="block font-bold">{title}</b>{sub && <small className="block text-[12.5px] leading-[1.4] text-ink-soft">{sub}</small>}</span>
            {right}
        </div>
    );
    const card = "mx-4 mt-3.5 rounded-[14px] bg-card px-3.5 py-1 shadow-[0_1px_4px_rgba(30,26,21,.08)]";

    return (
        <main className="mx-auto min-h-screen max-w-xl pb-10">
            <div className="px-4 pb-2">
                <div className="-mx-2.5 flex h-[52px] items-center">
                    <Link href="/" className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-[14px] font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="h-5 w-5" aria-hidden /> 행사 목록</Link>
                </div>
                <div className="flex items-center gap-3.5">
                    <span className="grid h-[60px] w-[60px] flex-none place-items-center rounded-full bg-ink text-white"><UserRound className="h-7 w-7" aria-hidden /></span>
                    <div className="min-w-0">
                        <h1 className="pica-display text-[24px] leading-[1.2] text-ink">{p!.nickname}</h1>
                        <p className="mt-[3px] truncate text-[13px] text-ink-soft">{user?.email}</p>
                    </div>
                    <button type="button" onClick={() => setEditing(v => !v)} className="ml-auto flex h-[34px] items-center whitespace-nowrap rounded-full bg-card px-3 text-[13px] font-bold shadow-[inset_0_0_0_1.5px_var(--pk-line)]">{editing ? "닫기" : "고치기"}</button>
                </div>
                {editing && (
                    <div className="mt-3 grid gap-2 rounded-xl bg-card p-3 shadow-[0_0_0_1px_var(--pk-line)]">
                        <label className="text-[13px] font-semibold text-ink-soft">닉네임
                            <input defaultValue={p!.nickname} onBlur={e => save({ nickname: e.currentTarget.value.trim() || p!.nickname })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-ink" /></label>
                        <label className="text-[13px] font-semibold text-ink-soft">연락처 (선택 · 공개되지 않음)
                            <input defaultValue={p!.phone} onBlur={e => save({ phone: e.currentTarget.value.trim() })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-ink" /></label>
                    </div>
                )}
            </div>

            {/* 찜한 행사 */}
            <div id="saved" className="flex scroll-mt-20 items-baseline justify-between px-4 pb-2.5 pt-6">
                <h2 className="pica-display text-[21px] text-ink">찜한 행사<span className="pica-num ml-1.5 text-[18px] text-accent">{saved.length}</span></h2>
            </div>
            {saved.length === 0 ? (
                <p className="px-4 text-[14px] text-ink-soft">아직 찜한 행사가 없어요. 행사 상세의 하트를 누르면 여기에 모입니다.</p>
            ) : (
                <div className="pica-shelf-row">{saved.map(c => <ShelfTile key={c.id} c={c} />)}</div>
            )}

            {/* 내 지역 · 관심 분야 · 캘린더 · 알림 */}
            <div id="settings" className="scroll-mt-20">
                <div className={card}>
                    <Line icon={MapPin} title="내 지역" sub="홈에 들어오면 이 지역 행사부터"
                        right={<select value={p!.region} onChange={e => save({ region: e.currentTarget.value })} aria-label="내 지역"
                            className="rounded-lg bg-transparent text-[14px] font-bold text-accent">
                            <option value="">고르기</option>{[...GN_REGIONS, "기타"].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>} />
                    <Line icon={MapPin} title="내 지역 먼저 보기" sub="홈 필터에서 언제든 바꿀 수 있어요"
                        right={<Toggle on={p!.auto_region} onChange={v => save({ auto_region: v })} label="내 지역 먼저 보기" />} />
                </div>

                <div className={card}>
                    <p className="pb-0.5 pt-3 text-[13px] font-bold text-ink-soft">관심 분야</p>
                    <div className="flex flex-wrap gap-1.5 pb-3.5 pt-1">
                        {CATEGORIES.map(c => {
                            const on = p!.interests.includes(c);
                            return (
                                <button key={c} type="button" aria-pressed={on}
                                    onClick={() => save({ interests: on ? p!.interests.filter(x => x !== c) : [...p!.interests, c] })}
                                    className={`h-[34px] rounded-full px-[13px] text-[13.5px] font-semibold ${on ? "bg-accent text-white" : "bg-card shadow-[inset_0_0_0_1.5px_var(--pk-line)]"}`}>{c}</button>
                            );
                        })}
                    </div>
                </div>

                <div className={card}>
                    <Line icon={CalendarPlus} title="캘린더로 받기" sub={`${p!.region || "전체 지역"} · ${p!.interests.length === 1 ? p!.interests[0] : "전체 분야"} 행사가 내 캘린더에 저절로 들어와요`} />
                    <div className="flex gap-2 pb-3">
                        <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" className="flex h-[42px] flex-1 items-center justify-center rounded-[10px] bg-accent-soft text-[14px] font-bold text-accent">구글 캘린더</a>
                        <a href={webcal} className="flex h-[42px] flex-1 items-center justify-center rounded-[10px] bg-accent-soft text-[14px] font-bold text-accent">애플·기타</a>
                    </div>
                    <p className="pb-3 text-[12px] text-ink-soft"><Link href="/calendar" className="underline">지역·분야를 따로 골라 구독하기</Link></p>
                </div>

                <div className={card}>
                    <Line icon={Bell} title="새 행사 알림" sub="관심 분야 새 행사가 올라오면" right={<Toggle on={p!.new_event_notifications} onChange={v => save({ new_event_notifications: v })} label="새 행사 알림" />} />
                    <Line icon={Mail} title="이메일 알림" sub="중요한 안내만" right={<Toggle on={p!.email_notifications} onChange={v => save({ email_notifications: v })} label="이메일 알림" />} />
                </div>
            </div>
            <p className="mx-4 mt-2 h-5 text-[12.5px] text-accent" aria-live="polite">{msg}</p>

            <div className={card}>
                <Link href="/partners" className="no-underline text-ink"><Line icon={Info} title="단체·공간 안내" sub="공연·전시 정보를 보내는 방법" right={<ChevronRight className="h-5 w-5 text-ink-soft" />} /></Link>
                <Link href="/about" className="no-underline text-ink"><Line icon={Info} title="피카가 고르는 기준" right={<ChevronRight className="h-5 w-5 text-ink-soft" />} /></Link>
            </div>

            <div className={card}>
                <Line icon={UserRound} title="계정 정보" sub={`가입일 ${user?.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "-"}`} />
                <p className="flex gap-3 pb-3 text-[12.5px] text-ink-soft"><Link href="/terms" className="underline">이용약관</Link><Link href="/privacy" className="underline">개인정보 처리방침</Link></p>
            </div>
            <button type="button" onClick={logout} className="mx-auto mt-5 block text-[14px] font-semibold text-ink-soft underline underline-offset-[3px]">로그아웃</button>
        </main>
    );
}
