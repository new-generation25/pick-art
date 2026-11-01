import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "픽아트 | pica - 경남 문화예술 큐레이션",
  description: "경남의 전시, 공연, 행사를 가장 빠르고 정확하게 찾아보세요. 픽아트(pica)가 당신의 예술 생활을 안내합니다.",
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
        {/* Pretendard (OFL) — 공개 화면 본문 글꼴. 쓰이는 글자 묶음만 내려받는 dynamic subset */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 리소 테마 제목·날짜 글꼴 (Black Han Sans, OFL) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap" />
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
