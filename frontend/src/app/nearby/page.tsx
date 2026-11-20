import type { Metadata } from "next";
import { Suspense } from "react";
import { getNearbyRows } from "@/lib/nearbyData";
import { todayKST } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import { NearbyClient } from "./NearbyClient";

export const metadata: Metadata = {
    title: "내 주변 공연·전시·축제",
    description: "지금 있는 곳에서 가까운 순서로, 이번 주에 열리는 공연·전시·축제를 보여 드립니다.",
    alternates: { canonical: "/nearby" },
};

// 행사 목록만 서버에서 받는다. 위치·거리 계산은 브라우저에서만 한다(specs/002-nearby-events FR-003)
export const revalidate = 600;

export default async function NearbyPage() {
    const rows = await getNearbyRows();
    return (
        <Suspense fallback={null}>
            <NearbyClient rows={rows} today={todayKST()} appname={new URL(SITE_URL).host} />
        </Suspense>
    );
}
