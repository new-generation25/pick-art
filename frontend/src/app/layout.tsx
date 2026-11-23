import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

const DESCRIPTION = "이번 주 가까운 곳에서 열리는 공연·전시·축제를 공식 출처로 확인해 날짜순으로 알려 드립니다. 피카(pica)는 픽아트의 준말입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "피카 pica | 가까운 공연·전시·축제",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // 앱처럼 설치(PWA): 매니페스트는 app/manifest.ts, 아이폰 「홈 화면에 추가」는 아래 apple 아이콘·appleWebApp
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "피카",
    statusBarStyle: "default",
  },
  openGraph: {
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
    url: "/",
    title: "피카 pica | 가까운 공연·전시·축제",
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "피카 pica | 가까운 공연·전시·축제",
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: "#F6EFDF",
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
        {/* Vercel Web Analytics — 방문 수와 유입 경로(utm 포함). 쿠키를 쓰지 않는다 */}
        <Analytics />
      </body>
    </html>
  );
}
