"use client";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { Box } from "@mantine/core";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Box>
            <AdminHeader />
            <Box pt={70}>
                {children}
            </Box>
        </Box>
    );
}
