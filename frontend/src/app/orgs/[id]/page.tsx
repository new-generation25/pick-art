import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacePage } from "@/components/PlacePage";
import { getOrgPage } from "@/lib/places";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

/**
 * 단체 페이지 /orgs/<id> (specs/012). 그 단체가 주최·주관했거나 그 계정이 올린 공개 행사.
 * 소규모 단체(작가·단체 계정)는 동의 전이라 검색엔진에 올리지 않는다(운영자 11/26 «검색 제외 조건으로 공개»)
 */
interface Props { params: Promise<{ id: string }> }

const KIND_LABEL = { 기관: "기관", 단체: "단체", 계정: "인스타그램 계정" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const page = await getOrgPage((await params).id);
    if (!page) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };
    const { org, upcoming, past } = page;
    const title = `${org.name} 공연·전시 일정 | 피카 pica`;
    const description = `${org.name}의 다가오는 행사 ${upcoming.length}건과 지난 행사 ${past.length}건을 공식 안내 링크와 함께 모았습니다.`;
    const url = `/orgs/${org.id}`;
    return {
        title, description, alternates: { canonical: url },
        ...((org.small || upcoming.length + past.length === 0) && { robots: { index: false, follow: false } }),
        openGraph: { title, description, url, type: "website", siteName: "피카 pica", locale: "ko_KR", images: [DEFAULT_OG_IMAGE.url] },
    };
}

export default async function OrgPage({ params }: Props) {
    const page = await getOrgPage((await params).id);
    if (!page) notFound();
    const { org, roles, upcoming, past } = page;
    const facts = [
        { label: "구분", value: KIND_LABEL[org.kind] ?? org.kind },
        ...(roles.length ? [{ label: "맡은 일", value: roles.map(r => r === "게시" ? "소식 올림" : r).join(" · ") }] : []),
        ...(org.insta_handle ? [{
            label: "인스타그램",
            value: <a className="underline underline-offset-4 hover:text-accent" href={`https://www.instagram.com/${encodeURIComponent(org.insta_handle)}/`} target="_blank" rel="noopener noreferrer">@{org.insta_handle}</a>,
        }] : []),
    ];
    return (
        <PlacePage
            eyebrow={org.kind === "기관" ? "기관" : "단체"}
            name={org.name}
            facts={facts}
            calendarQuery={`org=${org.id}`}
            upcoming={upcoming}
            past={past}
            note="공연 정보는 단체의 것입니다. 단체에서 요청하시면 7일 안에 내립니다. 정보가 틀렸으면 각 행사의 «정보가 틀렸어요»로 알려 주세요."
        />
    );
}
