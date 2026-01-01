import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3001"),
  title: "경남 아트 네비게이터 | Gyeongnam Art Navi",
  description: "경남 지역의 모든 문화예술 정보를 한눈에",
};

const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily: inter.style.fontFamily,
});

import { MainLayout } from "@/components/MainLayout";

// ... (other imports)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={cn(
        "min-h-screen bg-neutral-50 font-sans antialiased text-neutral-900",
        inter.className
      )}>
        <MantineProvider theme={theme}>
          <MainLayout>
            {children}
          </MainLayout>
        </MantineProvider>
      </body>
    </html>
  );
}
