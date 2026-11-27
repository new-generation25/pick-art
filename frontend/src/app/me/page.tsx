"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Building2, CalendarPlus, ChevronRight, Heart, Info, MapPin, Sparkles, Sun, UserRound } from "lucide-react";
import { PushButton } from "@/components/ui/PushButton";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/site";
import { todayKST } from "@/lib/utils";
import { loginHref, POINTS_NOTE, TIP_EVENT_NAME, TIP_POINTS } from "@/lib/reports";
import { fetchMyLedger, fetchMyPoints, POINT_REASON, type LedgerRow, type MyPoints } from "@/lib/points";
import { ShelfTile, type ShelfCard } from "@/components/ui/Shelf";
import { KakaoLinkCard } from "@/components/me/KakaoLinkCard";
import { Avatar } from "@/components/ui/Avatar";
import { removeAvatar, uploadAvatar } from "@/lib/avatar";

type Profile = {
    nickname: string; phone: string; region: string; interests: string[];
    email_notifications: boolean; new_event_notifications: boolean; auto_region: boolean;
    push_favorites: boolean; push_weekend: boolean; push_venues: boolean;
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
    const [venues, setVenues] = useState<{ id: string; name: string; region: string | null }[]>([]);
    const [editing, setEditing] = useState(false);
    // 프로필 사진 (specs/022): 본인만 올리고 지운다. 관리자는 사진이 없으면 까치 그림
    const [avatarPath, setAvatarPath] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [photoBusy, setPhotoBusy] = useState(false);
    const [points, setPoints] = useState<MyPoints | null>(null);
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setState("login"); return; }
            setUser(session.user);
            // 활동 포인트 (specs/021): 못 읽어도 나머지 화면은 그대로 그린다
            fetchMyPoints().then(setPoints);
            fetchMyLedger(session.user.id).then(setLedger);
            const [{ data: profile }, { data: favs }, { data: follows }] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
                supabase.from("favorites")
                    .select("created_at, events(id,title,category,event_date_start,event_date_end,venue,region,poster_image_url,poster_placeholder,source,is_free,status)")
                    .order("created_at", { ascending: false }),
                supabase.from("venue_follows").select("venue_id, created_at").order("created_at", { ascending: false }),
            ]);
            // 찜한 장소 이름 (공개 뷰: 좌표가 확인된 장소만 보인다. 안 보이면 «장소»로)
            const vids = (follows || []).map((f: { venue_id: string }) => f.venue_id);
            if (vids.length) {
                const { data: vs } = await supabase.from("public_venues").select("id,name,region").in("id", vids);
                const byId = new Map((vs || []).map((v: { id: string; name: string; region: string | null }) => [v.id, v]));
                setVenues(vids.map((id: string) => byId.get(id) ?? { id, name: "장소", region: null }));
            }
            setAvatarPath(profile?.avatar_path || null);
            setIsAdmin(profile?.role === "admin");
            setP({
                nickname: profile?.nickname || `픽아트회원${session.user.id.slice(0, 4)}`,
                phone: profile?.phone || "",
                region: profile?.region || "",
                interests: profile?.interests || [],
                email_notifications: profile?.email_notifications ?? true,
                new_event_notifications: profile?.new_event_notifications ?? true,
                auto_region: profile?.auto_region ?? true,
                push_favorites: profile?.push_favorites ?? true,
                push_weekend: profile?.push_weekend ?? true,
                push_venues: profile?.push_venues ?? true,
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

    const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";   // 같은 파일을 다시 골라도 반응하게
        if (!file || !user) return;
        setPhotoBusy(true);
        try {
            setAvatarPath(await uploadAvatar(user.id, file, avatarPath));
            setMsg("사진을 바꿨어요");
        } catch (err) {
            const m = (err as Error).message;
            setMsg(m === "decode" ? "이 사진을 열지 못했어요. jpg·png 파일로 골라 주세요." : "사진을 올리지 못했어요. 잠시 뒤 다시 해 주세요.");
        }
        setPhotoBusy(false);
        setTimeout(() => setMsg(""), 3500);
    };
    const dropPhoto = async () => {
        if (!user || !avatarPath) return;
        setPhotoBusy(true);
        try { await removeAvatar(user.id, avatarPath); setAvatarPath(null); setMsg("사진을 지웠어요"); }
        catch { setMsg("사진을 지우지 못했어요. 잠시 뒤 다시 해 주세요."); }
        setPhotoBusy(false);
        setTimeout(() => setMsg(""), 3500);
    };

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
                    <Avatar path={avatarPath} admin={isAdmin} size={60} />
                    <div className="min-w-0">
                        <h1 className="pica-display text-[24px] leading-[1.2] text-ink">{p!.nickname}</h1>
                        <p className="mt-[3px] truncate text-[13px] text-ink-soft">{user?.email || (user?.app_metadata?.provider === "kakao" ? "카카오 계정으로 로그인" : "")}</p>
                    </div>
                    <button type="button" onClick={() => setEditing(v => !v)} className="ml-auto flex h-[34px] items-center whitespace-nowrap rounded-full bg-card px-3 text-[13px] font-bold shadow-[inset_0_0_0_1.5px_var(--pk-line)]">{editing ? "닫기" : "고치기"}</button>
                </div>
                {editing && (
                    <div className="mt-3 grid gap-2 rounded-xl bg-card p-3 shadow-[0_0_0_1px_var(--pk-line)]">
                        {isAdmin ? (
                            <p className="text-[13px] leading-[1.4] text-ink-soft"><b className="font-semibold">프로필 사진</b> · 관리자 계정은 까치 그림으로 고정돼요.</p>
                        ) : (
                        <div>
                            <p className="text-[13px] font-semibold text-ink-soft">프로필 사진</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <label className={`flex h-[38px] cursor-pointer items-center rounded-full bg-accent-soft px-3.5 text-[13.5px] font-bold text-accent ${photoBusy ? "pointer-events-none opacity-50" : ""}`}>
                                    {photoBusy ? "올리는 중…" : avatarPath ? "사진 바꾸기" : "사진 올리기"}
                                    <input type="file" accept="image/*" onChange={pickPhoto} disabled={photoBusy} className="sr-only" />
                                </label>
                                {avatarPath && (
                                    <button type="button" onClick={dropPhoto} disabled={photoBusy} className="h-[38px] rounded-full bg-card px-3.5 text-[13.5px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--pk-line)] disabled:opacity-50">사진 지우기</button>
                                )}
                            </div>
                            <p className="mt-1 text-[12.5px] leading-[1.4] text-ink-soft">가운데를 정사각으로 잘라 작게 줄여 저장해요. 지금은 내 화면에만 보여요.</p>
                        </div>
                        )}
                        <label className="text-[13px] font-semibold text-ink-soft">닉네임
                            <input defaultValue={p!.nickname} onBlur={e => save({ nickname: e.currentTarget.value.trim() || p!.nickname })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-ink" /></label>
                        <label className="text-[13px] font-semibold text-ink-soft">연락처 (선택 · 공개되지 않음)
                            <input defaultValue={p!.phone} onBlur={e => save({ phone: e.currentTarget.value.trim() })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-ink" /></label>
                    </div>
                )}
            </div>

            {/* 활동 포인트 (specs/021): 제보가 피카에 실리면 100P. 쓰임은 운영자가 정한 문구 그대로 */}
            <div id="points" className={`${card} scroll-mt-20 !py-3.5`}>
                <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 flex-none text-accent" aria-hidden />
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-ink-soft">활동 포인트</p>
                        <p className="pica-num text-[26px] font-bold leading-[1.15] text-ink">{(points?.points ?? 0).toLocaleString()}<span className="ml-0.5 text-[16px]">P</span></p>
                    </div>
                    {points?.rank != null && (
                        <p className="flex-none text-right text-[13px] leading-[1.4] text-ink-soft">순위<br /><b className="pica-num text-[17px] text-accent">{points.rank}위</b><span className="text-[12px]"> / {points.ranked}명</span></p>
                    )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{POINTS_NOTE}</p>
                {ledger.length > 0 ? (
                    <ul className="mt-2 border-t border-line pt-1.5">
                        {ledger.map(l => (
                            <li key={l.id} className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]">
                                <span className="min-w-0 text-ink">{POINT_REASON[l.reason] || "포인트"}<span className="ml-2 text-[12px] text-ink-soft">{new Date(l.created_at).toLocaleDateString("ko-KR")}</span></span>
                                <b className="pica-num flex-none text-accent">{l.amount > 0 ? "+" : ""}{l.amount.toLocaleString()}P</b>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 border-t border-line pt-2.5 text-[13.5px] leading-relaxed text-ink">
                        <Link href="/tip" className="font-bold text-accent underline underline-offset-4">{TIP_EVENT_NAME}</Link>에서 피카에 없는 행사를 알려 주세요. 피카에 실리면 {TIP_POINTS}포인트가 쌓여요.
                    </p>
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

            {/* 찜한 장소 (specs/018): 새 행사가 올라오면 휴대폰 알림 */}
            <div id="venues" className="flex scroll-mt-20 items-baseline justify-between px-4 pb-2.5 pt-6">
                <h2 className="pica-display text-[21px] text-ink">찜한 장소<span className="pica-num ml-1.5 text-[18px] text-accent">{venues.length}</span></h2>
            </div>
            {venues.length === 0 ? (
                <p className="px-4 text-[14px] text-ink-soft">아직 찜한 장소가 없어요. 공간 정보나 행사 상세의 장소 하트를 누르면, 그 장소에 새 행사가 올라올 때 알려 드려요.</p>
            ) : (
                <div className="flex flex-wrap gap-2 px-4">
                    {venues.map(v => (
                        <Link key={v.id} href={`/venues/${v.id}`} className="pica-chip"><Heart size={14} fill="currentColor" className="text-accent" aria-hidden />{v.name}{v.region && <span className="text-[12px] font-medium text-ink-soft">{v.region}</span>}</Link>
                    ))}
                </div>
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

                {/* 휴대폰 알림 (specs/018): 예전 «새 행사·이메일 알림» 토글은 실제로 보내는 곳이 없어 이것으로 바꿨다 */}
                <div className={card}>
                    <Line icon={Bell} title="휴대폰 알림" sub="이 기기로 받아요. 기기마다 따로 켜요" />
                    <div className="pb-2"><PushButton /></div>
                    <Line icon={Heart} title="찜한 행사 전날" sub="찜한 행사가 시작하기 하루 전 아침" right={<Toggle on={p!.push_favorites} onChange={v => save({ push_favorites: v })} label="찜한 행사 전날 알림" />} />
                    <Line icon={Building2} title="찜한 장소 새 행사" sub="찜한 장소에 새 행사가 올라오면" right={<Toggle on={p!.push_venues} onChange={v => save({ push_venues: v })} label="찜한 장소 새 행사 알림" />} />
                    <Line icon={Sun} title="주말 행사 요약" sub={`금요일 오후, ${p!.region || "내 지역"}의 이번 주말 행사`} right={<Toggle on={p!.push_weekend} onChange={v => save({ push_weekend: v })} label="주말 행사 요약 알림" />} />
                </div>
            </div>
            <p className="mx-4 mt-2 h-5 text-[12.5px] text-accent" aria-live="polite">{msg}</p>

            <KakaoLinkCard className={card} />

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
