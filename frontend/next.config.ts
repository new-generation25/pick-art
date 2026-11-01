import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버(webpack)는 컴파일이 끝나고 잠시 쉬는 동안 캐시를 .next/dev/cache/webpack/*.pack.gz 로 직렬화하는데,
  // 이때 메모리가 2초 만에 1.8GB → 3.9GB로 튀었다(2026-11-01 12:38 실측, 요청 로그 없음, pack 파일 쓰기 시각과 일치).
  // 개발 중에는 디스크 캐시를 쓰지 않고 메모리 캐시만 쓴다. 재시작 후 첫 컴파일이 조금 느려지는 대신 이 급증이 없어진다.
  webpack: (config, { dev }) => {
    if (dev) config.cache = Object.freeze({ type: "memory" as const });
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
