import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacePage } from "@/components/PlacePage";
import { VenueFollowButton } from "@/components/ui/VenueFollowButton";
import { VenueRoute } from "@/components/ui/VenueRoute";
import { getVenuePage } from "@/lib/places";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site";

/** 공간(장소) 페이지 /venues/<id> (specs/012, 디자인 계획 D4). 좌표가 확인된 공개 장소만 */
interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const page = await getVenuePage((await params).id);
    if (!page) return { title: "찾을 수 없는 페이지 | 피카 pica", robots: { index: false } };
    const { venue, upcoming } = page;
    const where = [venue.region, venue.district].filter(Boolean).join(" ");
    const title = `${venue.name} 공연·전시 일정 ${upcoming.length}건 | 피카 pica`;
    const description = `${where ? `${where} ` : ""}${venue.name}에서 열리는 공연·전시·행사 ${upcoming.length}건과 지난 행사를 모았습니다.`;
    const url = `/venues/${venue.id}`;
    return {
        title, description, alternates: { canonical: url },
        ...(upcoming.length === 0 && { robots: { index: false, follow: true } }),
        openGraph: { title, description, url, type: "website", siteName: "피카 pica", locale: "ko_KR", images: [DEFAULT_OG_IMAGE.url] },
    };
}

export default async function VenuePage({ params }: Props) {
    const page = await getVenuePage((await params).id);
    if (!page) notFound();
    const { venue, upcoming, past, hosts } = page;
    const facts = [
        ...(venue.capacity ? [{ label: "객석", value: `${venue.capacity.toLocaleString()}석` }] : []),
        { label: "휴관일", value: venue.closed_days || "정보 없음" },
    ];
    return (
        <PlacePage
            eyebrow={`공간 · ${[venue.region, venue.district].filter(Boolean).join(" ") || "지역 정보 없음"}`}
            kindIcon="venue"
            name={venue.name}
            partnerSince={venue.partner_since}
            hosts={hosts}
            admin={{ table: "venues", id: venue.id }}
            facts={facts}
            actions={<><VenueFollowButton venueId={venue.id} icon /><VenueRoute name={venue.name} region={venue.region} lat={venue.lat} lng={venue.lng} appname={new URL(SITE_URL).host} block /></>}
            calendarQuery={`venue=${venue.id}`}
            upcoming={upcoming}
            past={past}
            note="휴관일·객석은 공식 안내로 확인한 값만 적습니다. 일정과 예매는 각 행사의 원본 안내 페이지에서 확인해 주세요."
        />
    );
}
