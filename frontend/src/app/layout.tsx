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
  // 검색엔진 소유 확인. 구글은 DNS TXT(picka.news)로 확인해 여기에 없다
  verification: {
    other: { "naver-site-verification": "d77666d31e3b3ea3e9c7e14019b583d47830e180" },
  },
};

// 휴대폰 맨 위(시간 표시줄)·사파리 주소줄 색: 다크 모드 휴대폰에서도 화면 바탕(종이 #F4EFE6)과 같게 (11/27 «앱 최상단이 검정»).
// colorScheme light: 이 사이트는 밝은 화면 하나뿐이라 브라우저가 어두운 기본색을 쓰지 않게 한다
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EFE6" },
    { media: "(prefers-color-scheme: dark)", color: "#F4EFE6" },
  ],
  colorScheme: "light",
};

const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily: inter.style.fontFamily,
  // 버튼은 어디서나 알약 모양 (운영자 2026-11-28 «전체적인 버튼을 반원 둥근형으로 통일해»). 관리자 화면의 Mantine 버튼도 같게
  components: { Button: { defaultProps: { radius: 'xl' } } },
});

import { MainLayout } from "@/components/MainLayout";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
        {/* 화면 제목(Gowun Batang 700)·숫자(Space Grotesk) 글꼴, OFL (specs/014, BRAND_GUIDE 3절 «화면 글꼴») */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Space+Grotesk:wght@500;600;700&display=swap" />
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
