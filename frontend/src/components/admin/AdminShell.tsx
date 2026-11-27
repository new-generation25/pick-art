"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Building2, CalendarDays, Inbox, ListChecks, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isLoggingOut } from "@/lib/logout";
import { Avatar } from "@/components/ui/Avatar";
import { fetchAdminCounts, menuBadges, type AdminCounts } from "@/lib/adminCounts";

/**
 * 관리자 틀 (specs/019 A1). 메뉴 다섯: 오늘 할 일 · 대기함 · 행사 · 출처·단체 · 현황.
 * 맨 위 줄은 공개 화면 머리 줄과 같은 짜임이다(운영자 2026-11-28 «상단은 메인페이지 디자인을 따라가야»):
 *   왼쪽 까치 그림 + pica. + «관리» 꼬리표(누르면 사이트 홈 — 운영자 2026-11-28 «피카 로고 누르면 홈으로 가기»), 오른쪽 관리자 원 하나(누르면 /me — 로그아웃은 거기 있다). «사이트 보기» 알약은 뺐다(운영자 2026-11-28 «빼» — 로고가 사이트 홈으로 간다).
 * 메뉴는 공개 홈의 칩 줄과 같은 흰 알약. PC는 머리 줄 아래 한 줄, 휴대폰은 아래 탭. 한 메뉴에 화면이 여럿이면 그 아래 줄에 칩으로 보인다.
 * 관리자 확인이 끝나기 전에는 화면(children)을 그리지 않는다 — 화면이 그려지지 않으면 그 화면의 조회도 나가지 않는다.
 * 데이터 보호 자체는 DB 정책(profiles.role='admin')이 맡는다.
 */
// count: 메뉴 숫자를 이루는 건수가 이 화면의 것일 때, 둘째 줄 칩에도 같은 숫자를 보인다(운영자 11/27)
//   대기함 숫자 = 리플렛 + 신고·제보 + 협약 신청(사람이 보내고 기다리는 것), 현황 숫자 = 켜진 경고(운영 현황 화면 맨 위)
type Page = { href: string; label: string; count?: "leaflets" | "reports" | "partners" | "alerts" };
type Section = { key: string; label: string; short: string; icon: LucideIcon; pages: Page[] };

export const ADMIN_SECTIONS: Section[] = [
    { key: "todo", label: "오늘 할 일", short: "할 일", icon: ListChecks, pages: [{ href: "/admin", label: "오늘 할 일" }] },
    {
        key: "queue", label: "대기함", short: "대기함", icon: Inbox, pages: [
            { href: "/admin/inbox", label: "공개 판단" },
            { href: "/admin/leaflets", label: "리플렛", count: "leaflets" },
            { href: "/admin/reports", label: "신고·제보", count: "reports" },
            { href: "/admin/partners", label: "협약 신청", count: "partners" },
            { href: "/admin/refine", label: "세부 갈래·안내 그림" },
        ],
    },
    { key: "events", label: "행사", short: "행사", icon: CalendarDays, pages: [{ href: "/admin/events", label: "찾기·고치기" }, { href: "/admin/events/new", label: "새 행사" }] },
    {
        key: "sources", label: "출처·단체", short: "출처", icon: Building2, pages: [
            { href: "/admin/sources", label: "출처" },
            { href: "/admin/orgs", label: "단체" },
            { href: "/admin/venues", label: "공간·장소 확인" },
        ],
    },
    {
        key: "status", label: "현황", short: "현황", icon: Activity, pages: [
            { href: "/admin/status", label: "운영 현황", count: "alerts" },
            { href: "/admin/insta", label: "인스타그램" },
            { href: "/admin/counts", label: "노출·클릭" },
            { href: "/admin/members", label: "회원" },
            { href: "/admin/storage", label: "저장공간" },
        ],
    },
];

function sectionOf(pathname: string | null): Section {
    const p = pathname || "/admin";
    return ADMIN_SECTIONS.find(s => s.pages.some(pg => pg.href !== "/admin" && (p === pg.href || p.startsWith(pg.href + "/")))) || ADMIN_SECTIONS[0];
}

type Ctx = { counts: AdminCounts | null; reload: () => Promise<void>; email: string };
const AdminContext = createContext<Ctx>({ counts: null, reload: async () => { }, email: "" });
export const useAdmin = () => useContext(AdminContext);

export function AdminShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState<"checking" | "admin">("checking");
    const [email, setEmail] = useState("");
    const [counts, setCounts] = useState<AdminCounts | null>(null);

    const reload = useCallback(async () => { setCounts(await fetchAdminCounts()); }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;
            if (!session?.user) { router.replace("/login?next=/admin"); return; }
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
            if (cancelled) return;
            if (profile?.role !== "admin") { router.replace("/"); return; }   // 관리자가 아니면 관리자 화면에 머물 수 없다
            setEmail(session.user.email || "");
            setState("admin");
            setCounts(await fetchAdminCounts());
        })();
        return () => { cancelled = true; };
    }, [router]);

    // 다른 탭에서 로그아웃했거나 로그인 기한이 끝나면 관리자 화면에 머물지 않는다. 그대로 두면 화면은 남고
    // 저장만 «row-level security» 오류로 실패한다(운영자 2026-11-27 «협약확인 선택했는데 확정이 안됨»)
    useEffect(() => {
        const { data } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT" && !isLoggingOut()) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        });
        return () => data.subscription.unsubscribe();
    }, []);

    if (state !== "admin") {
        return (
            <div className="pica-public flex min-h-screen items-center justify-center" data-pica-theme="paper">
                <p className="text-[15px] font-semibold text-ink-soft" role="status">관리자 확인 중…</p>
            </div>
        );
    }

    const current = sectionOf(pathname);
    const badges = menuBadges(counts);
    const badgeOf = (key: string) => key === "queue" ? badges.queue : key === "status" ? badges.status : 0;
    // 메뉴 숫자에 붙는 글자와 풀이: 대기함은 건수, 현황은 «경고 n»(숫자만 있으면 뜻을 알 수 없다 — 운영자 11/27)
    const badgeText = (key: string, n: number) => key === "status" ? `경고 ${n}` : String(n);
    const firstAlert = counts?.routine.openAlerts[0]?.text || (counts?.routine.missed.state === "missed" ? "정기 실행이 제때 돌지 않았습니다" : "");
    const badgeHint = (key: string, n: number) => key === "status"
        ? `켜진 경고 ${n}건${firstAlert ? ` — ${firstAlert}` : ""} (운영 현황 맨 위에서 확인)`
        : `받고 기다리는 것 ${n}건 (리플렛·신고·제보·협약 신청)`;
    const pageCount = (pg: Page) => !pg.count ? 0 : pg.count === "alerts" ? badges.status : (counts?.items.find(i => i.key === pg.count)?.count || 0);
    // 둘째 줄 칩은 주소가 가장 길게 맞는 하나만 켠다(/admin/events/new 에서 «찾기·고치기»까지 켜지지 않게)
    const matches = (href: string) => href === "/admin" ? pathname === "/admin" : !!pathname && (pathname === href || pathname.startsWith(href + "/"));
    const best = current.pages.filter(pg => matches(pg.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
    const isPage = (href: string) => href === best;

    return (
        <AdminContext.Provider value={{ counts, reload, email }}>
                <div className="pica-public pica-admin" data-pica-theme="paper">
                    <header className="fixed inset-x-0 top-0 z-[100] border-b border-line bg-paper">
                        {/* 첫 줄: 공개 화면 머리 줄과 같은 높이(60px)·여백 */}
                        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-2 pl-[18px] pr-[10px] sm:px-6">
                            <Link href="/" className="flex shrink-0 items-center gap-2 no-underline" aria-label="pica 홈">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/icons/logo-mark.png" alt="" width={40} height={36} className="block h-9 w-auto flex-none" />
                                <span className="pica-num text-[24px] font-bold leading-none tracking-[-0.6px] text-ink">pica<span className="text-accent">.</span></span>
                                <span className="rounded-full bg-[var(--pk-accent-soft)] px-2.5 py-[3px] text-[12.5px] font-bold leading-none text-accent">관리</span>
                            </Link>
                            <Link href="/me" aria-label="내 정보" className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
                                <Avatar admin size={44} />
                            </Link>
                        </div>
                        {/* 메뉴 줄(PC): 공개 홈의 칩 줄과 같은 흰 알약. 고른 메뉴만 짙은 초록 */}
                        <nav className="mx-auto hidden h-12 max-w-6xl items-center gap-1.5 px-6 md:flex" aria-label="관리자 메뉴">
                            {ADMIN_SECTIONS.map(s => {
                                const on = s.key === current.key;
                                const n = badgeOf(s.key);
                                return (
                                    <Link key={s.key} href={s.pages[0].href} aria-current={on ? "page" : undefined} title={n > 0 ? badgeHint(s.key, n) : undefined}
                                        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold no-underline ${on ? "bg-accent text-white" : "bg-card text-ink shadow-[0_1px_5px_rgba(30,26,21,.13)] hover:bg-paper"}`}>
                                        <s.icon size={15} aria-hidden />{s.label}
                                        {n > 0 && <span className={`pica-num whitespace-nowrap rounded-full px-1.5 text-[11.5px] font-bold leading-[18px] ${on ? "bg-white text-accent" : "bg-accent text-white"}`}>{badgeText(s.key, n)}</span>}
                                    </Link>
                                );
                            })}
                        </nav>
                        {current.pages.length > 1 && (
                            <nav className="mx-auto flex h-11 max-w-6xl items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6" aria-label={`${current.label} 안의 화면`}>
                                {current.pages.map(pg => {
                                    const n = pageCount(pg);
                                    return (
                                        <Link key={pg.href} href={pg.href} aria-current={isPage(pg.href) ? "page" : undefined}
                                            title={n > 0 && pg.count === "alerts" ? badgeHint("status", n) : undefined}
                                            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] no-underline ${isPage(pg.href) ? "bg-[var(--pk-accent-soft)] font-bold text-accent" : "bg-card font-semibold text-ink shadow-[0_1px_5px_rgba(30,26,21,.13)]"}`}>
                                            {pg.label}
                                            {n > 0 && <span className="pica-num whitespace-nowrap rounded-full bg-accent px-1.5 text-[11px] font-bold leading-[17px] text-white">{pg.count === "alerts" ? `경고 ${n}` : n}</span>}
                                        </Link>
                                    );
                                })}
                            </nav>
                        )}
                    </header>

                    <main className={`${current.pages.length > 1 ? "pt-[104px] md:pt-[152px]" : "pt-[60px] md:pt-[108px]"} pb-[84px] md:pb-10`}>
                        {/* 본문 틀 하나 (운영자 2026-11-28 «너비 맞춰»): 머리 줄과 같은 폭(max-w-6xl)·좌우 여백. 화면마다 폭을 따로 주지 않는다 */}
                        <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
                    </main>

                    <nav className="fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom,0px)] md:hidden" aria-label="관리자 메뉴">
                        {ADMIN_SECTIONS.map(s => {
                            const on = s.key === current.key;
                            const n = badgeOf(s.key);
                            return (
                                <Link key={s.key} href={s.pages[0].href} aria-current={on ? "page" : undefined} aria-label={n > 0 ? `${s.label} — ${badgeHint(s.key, n)}` : undefined}
                                    className={`relative flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11.5px] no-underline ${on ? "font-bold text-accent" : "font-semibold text-ink-soft"}`}>
                                    <s.icon size={20} aria-hidden strokeWidth={on ? 2.4 : 1.9} />
                                    {s.short}
                                    {n > 0 && <span className="pica-num absolute right-[calc(50%-22px)] top-1.5 min-w-[17px] rounded-full bg-accent px-1 text-center text-[10.5px] font-bold leading-[17px] text-white">{n}</span>}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
        </AdminContext.Provider>
    );
}
