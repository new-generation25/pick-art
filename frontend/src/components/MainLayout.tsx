"use client";

import { AppShell, Burger, Group, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Header } from "./ui/Header";
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
        >
            <AppShell.Header>
                <Header />
            </AppShell.Header>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}
