"use client";

import { AppShell, Burger, Group, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Header } from "./ui/Header";
import { SiteFooter } from "./ui/SiteFooter";
import { usePathname } from "next/navigation";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [opened, { toggle }] = useDisclosure();
    const pathname = usePathname();

    // Admin routes handle their own layout (AdminHeader)
    if (pathname?.startsWith("/admin")) {
        return <>{children}</>;
    }


    return (
        <AppShell
            header={{ height: 60 }}
            padding={0} // 패딩을 0으로 설정하여 디자인 제어권 확보 (Tailwind나 내부 컨테이너로 처리)
            className="pica-public"
            data-pica-theme="paper" // 공개 화면 테마: paper(확정, specs/014) / riso(이전) / lantern / mural (globals.css 의 테마 묶음)
        >
            <AppShell.Header>
                <Header />
            </AppShell.Header>

            <AppShell.Main>
                {children}
                <SiteFooter />
            </AppShell.Main>
        </AppShell>
    );
}
