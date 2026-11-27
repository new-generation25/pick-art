"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Building2, CalendarDays, ExternalLink, Inbox, ListChecks, LogOut, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAdminCounts, menuBadges, type AdminCounts } from "@/lib/adminCounts";

/**
 * 관리자 틀 (specs/019 A1). 메뉴 다섯: 오늘 할 일 · 대기함 · 행사 · 출처·단체 · 현황.
 * 휴대폰은 아래 탭, PC는 맨 위 줄. 한 메뉴에 화면이 여럿이면 둘째 줄에 칩으로 보인다.
 * 관리자 확인이 끝나기 전에는 화면(children)을 그리지 않는다 — 화면이 그려지지 않으면 그 화면의 조회도 나가지 않는다.
 * 데이터 보호 자체는 DB 정책(profiles.role='admin')이 맡는다.
 */
type Page = { href: string; label: string };
type Section = { key: string; label: string; short: string; icon: LucideIcon; pages: Page[] };

export const ADMIN_SECTIONS: Section[] = [
    { key: "todo", label: "오늘 할 일", short: "할 일", icon: ListChecks, pages: [{ href: "/admin", label: "오늘 할 일" }] },
    {
        key: "queue", label: "대기함", short: "대기함", icon: Inbox, pages: [
            { href: "/admin/inbox", label: "공개 판단" },
            { href: "/admin/leaflets", label: "리플렛" },
            { href: "/admin/reports", label: "신고·제보" },
            { href: "/admin/partners", label: "협약 신청" },
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
            { href: "/admin/status", label: "운영 현황" },
            { href: "/admin/counts", label: "노출·클릭" },
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

    const logout = async () => { await supabase.auth.signOut(); router.push("/"); };

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
    // 둘째 줄 칩은 주소가 가장 길게 맞는 하나만 켠다(/admin/events/new 에서 «찾기·고치기»까지 켜지지 않게)
    const matches = (href: string) => href === "/admin" ? pathname === "/admin" : !!pathname && (pathname === href || pathname.startsWith(href + "/"));
    const best = current.pages.filter(pg => matches(pg.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
    const isPage = (href: string) => href === best;

    return (
        <AdminContext.Provider value={{ counts, reload, email }}>
                <div className="pica-public pica-admin" data-pica-theme="paper">
                    <header className="fixed inset-x-0 top-0 z-[100] border-b border-line bg-paper">
                        <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-2 px-4">
                            <Link href="/admin" className="flex items-baseline gap-1.5 no-underline" aria-label="관리자 첫 화면">
                                <span className="pica-display text-[21px] leading-none text-ink">pica<span className="text-accent">.</span></span>
                                <span className="text-[12.5px] font-semibold text-ink-soft">관리</span>
                            </Link>
                            <nav className="ml-5 hidden items-center gap-1 md:flex" aria-label="관리자 메뉴">
                                {ADMIN_SECTIONS.map(s => {
                                    const on = s.key === current.key;
                                    const n = badgeOf(s.key);
                                    return (
                                        <Link key={s.key} href={s.pages[0].href} aria-current={on ? "page" : undefined}
                                            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold no-underline ${on ? "bg-accent text-on-accent" : "text-ink hover:bg-soft"}`}>
                                            <s.icon size={15} aria-hidden />{s.label}
                                            {n > 0 && <span className={`pica-num rounded-full px-1.5 text-[11.5px] font-bold ${on ? "bg-on-accent text-accent" : "bg-accent text-on-accent"}`}>{n}</span>}
                                        </Link>
                                    );
                                })}
                            </nav>
                            <div className="ml-auto flex items-center gap-1">
                                <Link href="/" className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-ink-soft no-underline hover:bg-soft hover:text-ink">
                                    <ExternalLink size={14} aria-hidden />사이트
                                </Link>
                                <button type="button" onClick={logout} className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-ink-soft hover:bg-soft hover:text-ink">
                                    <LogOut size={14} aria-hidden />로그아웃
                                </button>
                            </div>
                        </div>
                        {current.pages.length > 1 && (
                            <nav className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" aria-label={`${current.label} 안의 화면`}>
                                {current.pages.map(pg => (
                                    <Link key={pg.href} href={pg.href} aria-current={isPage(pg.href) ? "page" : undefined}
                                        className={`flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold no-underline ${isPage(pg.href) ? "bg-ink text-paper" : "bg-card text-ink shadow-[0_1px_4px_rgba(30,26,21,.1)]"}`}>
                                        {pg.label}
                                    </Link>
                                ))}
                            </nav>
                        )}
                    </header>

                    <main className={`${current.pages.length > 1 ? "pt-[92px]" : "pt-[52px]"} pb-[84px] md:pb-10`}>
                        {children}
                    </main>

                    <nav className="fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom,0px)] md:hidden" aria-label="관리자 메뉴">
                        {ADMIN_SECTIONS.map(s => {
                            const on = s.key === current.key;
                            const n = badgeOf(s.key);
                            return (
                                <Link key={s.key} href={s.pages[0].href} aria-current={on ? "page" : undefined}
                                    className={`relative flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold no-underline ${on ? "text-accent" : "text-ink-soft"}`}>
                                    <s.icon size={20} aria-hidden strokeWidth={on ? 2.4 : 1.9} />
                                    {s.short}
                                    {n > 0 && <span className="pica-num absolute right-[calc(50%-22px)] top-1.5 min-w-[17px] rounded-full bg-accent px-1 text-center text-[10.5px] font-bold leading-[17px] text-on-accent">{n}</span>}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
        </AdminContext.Provider>
    );
}
